// Демо-данные для показа офису (PLAN.md §9): сотрудники, два шаблона и заказы на разных этапах.
// Всё создаётся через сервисы приложения — с теми же проверками и записями в журнал, что и из
// интерфейса; затем время событий «разносится» по последним неделям, чтобы история выглядела живой.
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { count } from 'drizzle-orm';
import {
  type Order,
  type Permission,
  passwordProblem,
  type StageField,
  type StageValues,
} from '@webmotiv/shared';
import type { PasswordHasher } from '../auth/passwords.ts';
import { loadAccess } from '../auth/session-store.ts';
import { generateTemporaryPassword } from '../auth/temporary-password.ts';
import { ADMIN_ROLE, ensureAdminRole } from '../bootstrap.ts';
import type { AppDb } from '../db/db.ts';
import { orders, roles, stages, templates, userRoles, users } from '../db/schema.ts';
import { recordEvent } from '../events/event-log.ts';
import { FilesService } from '../orders/files-service.ts';
import { OrdersService, type Viewer } from '../orders/orders-service.ts';
import type { DataPaths } from '../paths.ts';
import { StagesService } from '../stages/stages-service.ts';
import { TemplatesService } from '../templates/templates-service.ts';
import { type Actor, findUserByLogin } from '../users/users-service.ts';

export const DEMO_FILES_DIR = path.resolve(import.meta.dirname, '../../demo');

export class SeedError extends Error {}

/** Должности офиса для демо; «Видеть все заказы» есть у всех. На чистой установке только «Администратор». */
export const DEMO_ROLES: { name: string; permissions: readonly Permission[] }[] = [
  {
    name: 'Руководитель',
    permissions: [
      'orders.create',
      'orders.view_all',
      'orders.manage',
      'templates.manage',
      'audit.view',
    ],
  },
  { name: 'Менеджер', permissions: ['orders.create', 'orders.view_all'] },
  { name: 'Бухгалтер', permissions: ['orders.view_all'] },
  { name: 'Закупщик', permissions: ['orders.view_all'] },
  { name: 'Склад', permissions: ['orders.view_all'] },
];

/** Роль «Администратор» и демо-роли, которых ещё нет; существующие роли не трогает. */
export function ensureDemoRoles(db: AppDb): void {
  ensureAdminRole(db);
  const existing = new Set(
    db
      .select({ name: roles.name })
      .from(roles)
      .all()
      .map((role) => role.name),
  );
  const missing = DEMO_ROLES.filter((role) => !existing.has(role.name));
  if (missing.length === 0) return;
  const now = new Date();
  db.insert(roles)
    .values(
      missing.map((role) => ({
        name: role.name,
        permissions: [...role.permissions],
        createdAt: now,
        updatedAt: now,
      })),
    )
    .run();
}

const DEMO_USERS = [
  { key: 'admin', login: 'admin', fullName: 'Белова Ольга Николаевна', role: ADMIN_ROLE },
  { key: 'manager', login: 'manager', fullName: 'Смирнов Алексей Викторович', role: 'Менеджер' },
  { key: 'manager2', login: 'manager2', fullName: 'Кравцова Елена Павловна', role: 'Менеджер' },
  { key: 'buh', login: 'buh', fullName: 'Петрова Анна Сергеевна', role: 'Бухгалтер' },
  { key: 'zakup', login: 'zakup', fullName: 'Соколов Дмитрий Андреевич', role: 'Закупщик' },
  { key: 'sklad', login: 'sklad', fullName: 'Кузнецов Павел Валерьевич', role: 'Склад' },
] as const;

type UserKey = (typeof DEMO_USERS)[number]['key'];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---- Поля этапов (§9) ----

const field = <T extends StageField['type']>(
  type: T,
  label: string,
  required: boolean,
  extra: Record<string, unknown> = {},
) => ({ id: randomUUID(), type, label, required, hint: '', ...extra }) as StageField;

const SHIPPING = {
  pickup: { id: randomUUID(), label: 'Самовывоз' },
  carrier: { id: randomUUID(), label: 'Транспортная компания' },
  courier: { id: randomUUID(), label: 'Курьер' },
};

const F = {
  contact: field('text', 'Контакт покупателя', false),
  items: field('textarea', 'Перечень позиций', true),
  request: field('file', 'Заявка покупателя', false, { multiple: true }),
  invoiceNumber: field('text', 'Номер счёта', true),
  amount: field('number', 'Сумма', true, { hint: 'С НДС, ₽' }),
  invoice: field('file', 'Счёт', true, { multiple: false }),
  paidOn: field('date', 'Дата оплаты', true),
  payment: field('file', 'Платёжное поручение', false, { multiple: false }),
  supplier: field('text', 'Поставщик', true),
  expectedOn: field('date', 'Ожидаемая дата поступления', true),
  supplierOrder: field('file', 'Заказ поставщику', false, { multiple: false }),
  arrivedOn: field('date', 'Дата поступления', true),
  allArrived: field('checkbox', 'Всё пришло', true),
  shipping: field('select', 'Способ отправки', true, { options: Object.values(SHIPPING) }),
  track: field('text', 'Трек-номер', false),
  upd: field('file', 'УПД', true, { multiple: false }),
};

type StageKey = 'intake' | 'invoice' | 'payment' | 'purchase' | 'arrival' | 'shipment' | 'closing';

const STAGES: Record<
  StageKey,
  { name: string; description: string; role: string | null; fields: StageField[] }
> = {
  intake: {
    name: 'Приём заказа',
    description: 'Что и кому нужно: позиции, контакт, заявка покупателя.',
    role: null,
    fields: [F.contact, F.items, F.request],
  },
  invoice: {
    name: 'Счёт',
    description: 'Выставить счёт по перечню позиций.',
    role: 'Бухгалтер',
    fields: [F.invoiceNumber, F.amount, F.invoice],
  },
  payment: {
    name: 'Оплата',
    description: 'Отметить, когда деньги пришли на счёт.',
    role: 'Бухгалтер',
    fields: [F.paidOn, F.payment],
  },
  purchase: {
    name: 'Закупка у поставщика',
    description: 'Заказать недостающие позиции у поставщика.',
    role: 'Закупщик',
    fields: [F.supplier, F.expectedOn, F.supplierOrder],
  },
  arrival: {
    name: 'Поступление на склад',
    description: 'Принять товар от поставщика и сверить с заказом.',
    role: 'Склад',
    fields: [F.arrivedOn, F.allArrived],
  },
  shipment: {
    name: 'Отгрузка',
    description: 'Собрать и отправить заказ покупателю.',
    role: 'Склад',
    fields: [F.shipping, F.track, F.upd],
  },
  closing: {
    name: 'Закрытие',
    description: 'Убедиться, что покупатель получил заказ, и закрыть его.',
    role: null,
    fields: [],
  },
};

const TEMPLATES = {
  supply: {
    name: 'Заказ под поставку',
    description: 'Позиций нет на складе: счёт, оплата, закупка у поставщика, отгрузка.',
    stages: [
      'intake',
      'invoice',
      'payment',
      'purchase',
      'arrival',
      'shipment',
      'closing',
    ] as StageKey[],
  },
  stock: {
    name: 'Заказ со склада',
    description: 'Всё есть на складе: счёт, оплата и сразу отгрузка.',
    stages: ['intake', 'invoice', 'payment', 'shipment', 'closing'] as StageKey[],
  },
};

// ---- Заказы ----

const ITEMS = [
  'STM32F103C8T6 — 200 шт\nРезистор 0805 10 кОм 1% — 5000 шт\nКонденсатор 0805 100 нФ X7R — 5000 шт\nLM1117-3.3 SOT-223 — 200 шт\nUSB Type-C 16 pin — 200 шт',
  'ATmega328P-AU — 50 шт\nКварц 16 МГц HC-49S — 50 шт\nСветодиод 0603 зелёный — 500 шт',
  'Реле HF46F-G/12-HS1 — 120 шт\nОптопара PC817 — 300 шт\nДиод 1N4007 — 1000 шт',
  'ESP32-WROOM-32E — 30 шт\nAMS1117-3.3 — 30 шт\nРазъём PLS-40 — 60 шт',
  'Транзистор IRLZ44N — 400 шт\nДрайвер IR2104 — 100 шт\nКонденсатор 1000 мкФ 35 В — 200 шт',
  'Микросхема MAX485 — 150 шт\nTVS-диод SMBJ6.5CA — 300 шт',
];

interface DemoOrder {
  template: keyof typeof TEMPLATES;
  responsible: 'manager' | 'manager2';
  customer: string;
  contact: string;
  comment?: string;
  /** Когда заказ создан — дней назад. */
  daysAgo: number;
  /** Сколько этапов уже выполнено. */
  done: number;
  /** Текущий этап частично заполнен (черновик). */
  draft?: boolean;
  /** Отменён руководителем с этой причиной. */
  cancel?: string;
}

const ORDERS: DemoOrder[] = [
  {
    template: 'supply',
    responsible: 'manager',
    customer: 'ООО «Альфа-Прибор»',
    contact: 'Николаев Сергей, +7 812 000-00-00',
    daysAgo: 24,
    done: 7,
  },
  {
    template: 'stock',
    responsible: 'manager2',
    customer: 'АО «Северный завод»',
    contact: 'snab@example.ru',
    daysAgo: 19,
    done: 5,
  },
  {
    template: 'stock',
    responsible: 'manager',
    customer: 'ООО «Квант»',
    contact: 'Иван, +7 900 000-00-01',
    daysAgo: 15,
    done: 2,
    cancel: 'Покупатель нашёл позиции дешевле, счёт не оплачен.',
  },
  {
    template: 'supply',
    responsible: 'manager',
    customer: 'ООО «Техносвязь»',
    contact: 'Громова Ирина, отдел закупок',
    comment: 'Отгрузка частями не нужна — только всё сразу.',
    daysAgo: 13,
    done: 5,
  },
  {
    template: 'supply',
    responsible: 'manager2',
    customer: 'ИП Орлов А. В.',
    contact: '+7 921 000-00-02',
    daysAgo: 10,
    done: 4,
  },
  {
    template: 'supply',
    responsible: 'manager',
    customer: 'ООО «Вектор-Электроника»',
    contact: 'zakupki@example.ru',
    daysAgo: 8,
    done: 3,
    draft: true,
  },
  {
    template: 'stock',
    responsible: 'manager',
    customer: 'НИИ «Импульс»',
    contact: 'Лаборатория № 3, Ефимов П. Л.',
    daysAgo: 6,
    done: 2,
  },
  {
    template: 'supply',
    responsible: 'manager2',
    customer: 'ООО «Сигнал Плюс»',
    contact: 'Тарасова Мария',
    daysAgo: 4,
    done: 1,
  },
  {
    template: 'stock',
    responsible: 'manager2',
    customer: 'ООО «Медтехника»',
    contact: '+7 495 000-00-03',
    comment: 'Срочно: покупатель ждёт к пятнице.',
    daysAgo: 2,
    done: 1,
    draft: true,
  },
  {
    template: 'supply',
    responsible: 'manager',
    customer: 'ООО «Робот-Лаб»',
    contact: 'Дьяченко Олег',
    daysAgo: 0,
    done: 0,
    draft: true,
  },
];

/** Паузы между шагами заказа (часы) — по кругу; похоже на рабочий ритм. */
const STEP_HOURS = [1.5, 20, 3, 26, 2, 44, 5, 22, 1];

// ---- Время ----

/** Все отметки времени, которые сервисы ставят «сейчас». */
const TIMESTAMPS: Record<string, string[]> = {
  users: ['created_at'],
  roles: ['created_at', 'updated_at'],
  stages: ['created_at', 'updated_at'],
  templates: ['created_at', 'updated_at'],
  orders: ['created_at', 'updated_at', 'completed_at'],
  order_stages: ['updated_at', 'completed_at'],
  files: ['uploaded_at'],
  events: ['at'],
};

/**
 * Выполнить шаг «как будто» в момент `at`: всё, что шаг записал с отметкой «сейчас», получает
 * время `at`. Моменты шагов — в прошлом, поэтому следующие шаги их не задевают.
 */
async function at<T>(db: AppDb, when: Date, step: () => T | Promise<T>): Promise<T> {
  const since = Date.now();
  const result = await step();
  for (const [table, columns] of Object.entries(TIMESTAMPS)) {
    for (const column of columns) {
      db.$client
        .prepare(`UPDATE ${table} SET ${column} = ? WHERE ${column} >= ?`)
        .run(when.getTime(), since);
    }
  }
  return result;
}

/** Ближайшее рабочее время: будни, 9:30–18:00. */
function workTime(ms: number): number {
  const date = new Date(ms);
  if (date.getHours() >= 18) date.setDate(date.getDate() + 1);
  if (date.getHours() >= 18 || date.getHours() < 9) date.setHours(9, 30 + (ms % 7) * 4, 0, 0);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return date.getTime();
}

/** Утро рабочего дня `daysAgo` дней назад (выходные — к пятнице), плюс `minutes`. */
function workMorning(now: Date, daysAgo: number, minutes: number): number {
  const date = new Date(now.getTime() - daysAgo * DAY);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() - 1);
  date.setHours(9, minutes, 0, 0);
  return date.getTime();
}

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// ---- Сид ----

export interface SeedResult {
  password: string;
  users: { login: string; fullName: string; role: string }[];
  orders: number;
}

export async function seedDemo(
  db: AppDb,
  hasher: PasswordHasher,
  paths: DataPaths,
  // ДЕМО-TIMEWEB: `password` — только для показа на Timeweb (DEMO_PASSWORD), убрать до релиза.
  { now = new Date(), password: fixedPassword }: { now?: Date; password?: string } = {},
): Promise<SeedResult> {
  // Сотрудники могут уже быть (например, свой администратор) — они остаются. А этапы, шаблоны
  // и заказы — только демо: в базу, где они есть, демо не подмешивается.
  const used = [orders, stages, templates].some(
    (table) => (db.select({ count: count() }).from(table).get()?.count ?? 0) > 0,
  );
  if (used) {
    throw new SeedError(
      'В базе уже есть этапы, шаблоны или заказы — демо-данные добавляются только в базу без них. ' +
        'Удалите каталог данных (или укажите другой DATA_DIR) и запустите снова.',
    );
  }
  const taken = DEMO_USERS.filter((user) => findUserByLogin(db, user.login)).map(
    (user) => user.login,
  );
  if (taken.length > 0) {
    throw new SeedError(`Логины демо-сотрудников уже заняты: ${taken.join(', ')}.`);
  }
  ensureDemoRoles(db);
  const roleIds = new Map(
    db
      .select()
      .from(roles)
      .all()
      .map((role) => [role.name, role.id]),
  );

  // ДЕМО-TIMEWEB: пароль задан (DEMO_PASSWORD) — проверяем по тем же правилам, что и пароли сотрудников.
  const fixedProblem =
    fixedPassword === undefined
      ? null
      : DEMO_USERS.map((user) => passwordProblem(fixedPassword, { login: user.login })).find(
          Boolean,
        );
  if (fixedProblem) throw new SeedError(`Пароль демо-сотрудников не подходит: ${fixedProblem}.`);
  let password = fixedPassword ?? generateTemporaryPassword();
  while (passwordProblem(password)) password = generateTemporaryPassword();

  // Сотрудники — месяц назад.
  const ids = {} as Record<UserKey, number>;
  for (const [index, user] of DEMO_USERS.entries()) {
    const roleId = roleIds.get(user.role);
    if (roleId === undefined) throw new SeedError(`Нет роли «${user.role}».`);
    const passwordHash = await hasher.hash(password);
    ids[user.key] = await at(db, new Date(workMorning(now, 30, 40 + index * 10)), () =>
      db.transaction((tx) => {
        const created = tx
          .insert(users)
          .values({
            login: user.login,
            fullName: user.fullName,
            passwordHash,
            mustChangePassword: false,
            createdAt: new Date(),
          })
          .returning()
          .get();
        tx.insert(userRoles).values({ userId: created.id, roleId }).run();
        recordEvent(tx, {
          actorId: index === 0 ? null : (ids.admin ?? null),
          action: 'user.created',
          entityType: 'user',
          entityId: created.id,
          payload: {
            login: created.login,
            fullName: created.fullName,
            roles: [user.role],
            ...(index === 0 ? { via: 'setup' } : {}),
          },
        });
        return created.id;
      }),
    );
  }

  const access = loadAccess(db, Object.values(ids));
  const viewer = (key: UserKey): Viewer => {
    const entry = access.get(ids[key]);
    return {
      id: ids[key],
      ip: null,
      permissions: entry?.permissions ?? new Set(),
      roleIds: entry?.roles.map((role) => role.id) ?? [],
    };
  };
  const adminActor: Actor = { id: ids.admin, ip: null, permissions: 'all' };

  // Этапы и шаблоны — администратор, за 4 недели до сегодня.
  const stagesService = new StagesService(db);
  const templatesService = new TemplatesService(db);
  const stageIds = {} as Record<StageKey, number>;
  let clock = workMorning(now, 28, 60);
  for (const [key, stage] of Object.entries(STAGES) as [StageKey, (typeof STAGES)[StageKey]][]) {
    const executorRoleId = stage.role === null ? null : (roleIds.get(stage.role) ?? null);
    clock += 0.2 * HOUR;
    stageIds[key] = (
      await at(db, new Date(clock), () =>
        stagesService.create(
          {
            name: stage.name,
            description: stage.description,
            executor: executorRoleId === null ? 'responsible' : 'role',
            executorRoleId,
            fields: stage.fields,
          },
          adminActor,
        ),
      )
    ).id;
  }
  const templateIds = {} as Record<keyof typeof TEMPLATES, number>;
  for (const [key, template] of Object.entries(TEMPLATES) as [
    keyof typeof TEMPLATES,
    (typeof TEMPLATES)[keyof typeof TEMPLATES],
  ][]) {
    clock += 0.5 * HOUR;
    templateIds[key] = (
      await at(db, new Date(clock), () =>
        templatesService.create(
          {
            name: template.name,
            description: template.description,
            stageIds: template.stages.map((stage) => stageIds[stage]),
          },
          adminActor,
        ),
      )
    ).id;
  }

  // Заказы: шаги всех заказов — в общем порядке времени, чтобы журнал шёл по порядку.
  const ordersService = new OrdersService(db);
  const filesService = new FilesService(db, paths);
  const schedule: { when: number; run: () => Promise<unknown> }[] = [];
  for (const [index, demo] of ORDERS.entries()) {
    const responsible = viewer(demo.responsible);
    const template = TEMPLATES[demo.template];
    // Шаги — в рабочее время, но не позже, чем «только что».
    const latest = now.getTime() - 60_000;
    let time = Math.min(workMorning(now, demo.daysAgo, 20 + ((index * 97) % 300)), latest);
    let step = 0;
    const next = () => {
      time += (STEP_HOURS[(index + step++) % STEP_HOURS.length] ?? 1) * HOUR;
      time = Math.min(workTime(time), latest);
      return time;
    };
    // id заказа и этапов появятся при создании; версия — перед каждым изменением.
    let order: Order | null = null;
    const current = (as: Viewer) => {
      if (!order) throw new SeedError('Заказ ещё не создан.');
      return ordersService.get(order.id, as);
    };

    schedule.push({
      when: time,
      run: async () => {
        order = ordersService.create(
          {
            templateId: templateIds[demo.template],
            customer: demo.customer,
            comment: demo.comment ?? '',
          },
          responsible,
        );
      },
    });

    const fill = Math.min(demo.done + (demo.draft ? 1 : 0), template.stages.length);
    for (let position = 0; position < fill; position++) {
      const key = template.stages[position];
      if (!key) break;
      const executor = STAGES[key].role === null ? responsible : viewer(executorOf(key));
      const isDraft = position >= demo.done;
      const when = next();
      const { values, files } = stageData(key, index, demo, new Date(when));
      const stageId = (as: Viewer) => {
        const stage = current(as).stages[position];
        if (!stage) throw new SeedError(`Нет этапа ${position + 1}.`);
        return stage.id;
      };

      schedule.push({
        when,
        run: async () => {
          const saved = isDraft ? firstHalf(values) : values;
          const fresh = current(executor);
          if (Object.keys(saved).length > 0) {
            ordersService.saveStage(
              fresh.id,
              stageId(executor),
              { version: fresh.version, values: saved },
              executor,
            );
          }
          for (const file of isDraft ? [] : files) {
            await filesService.upload(
              {
                orderId: fresh.id,
                stageId: stageId(executor),
                fieldId: file.fieldId,
                fileName: file.name,
                stream: createReadStream(path.join(DEMO_FILES_DIR, file.source)),
                truncated: () => false,
              },
              executor,
            );
          }
        },
      });
      if (!isDraft) {
        // «Готово» — через четверть часа; следующий шаг заказа отсчитывается от него.
        time = Math.min(workTime(when + 15 * 60_000), latest);
        schedule.push({
          when: time,
          run: async () => {
            const fresh = current(executor);
            ordersService.completeStage(fresh.id, stageId(executor), fresh.version, executor);
          },
        });
      }
    }

    if (demo.cancel) {
      const reason = demo.cancel;
      schedule.push({
        when: next(),
        run: async () => {
          const fresh = current(viewer('admin'));
          ordersService.cancel(fresh.id, { version: fresh.version, reason }, viewer('admin'));
        },
      });
    }
  }
  // sort устойчивая: шаги одного заказа с одинаковым временем не меняются местами.
  schedule.sort((a, b) => a.when - b.when);
  for (const step of schedule) await at(db, new Date(step.when), step.run);

  return {
    password,
    users: DEMO_USERS.map(({ login, fullName, role }) => ({ login, fullName, role })),
    orders: ORDERS.length,
  };
}

function executorOf(stage: StageKey): UserKey {
  switch (STAGES[stage].role) {
    case 'Бухгалтер':
      return 'buh';
    case 'Закупщик':
      return 'zakup';
    case 'Склад':
      return 'sklad';
    default:
      throw new SeedError(`У этапа «${STAGES[stage].name}» нет роли-исполнителя.`);
  }
}

/** Черновик: заполнена только первая половина полей. */
function firstHalf(values: StageValues): StageValues {
  const entries = Object.entries(values);
  return Object.fromEntries(entries.slice(0, Math.max(1, Math.ceil(entries.length / 2))));
}

interface DemoFile {
  fieldId: string;
  name: string;
  source: string;
}

function stageData(
  key: StageKey,
  index: number,
  demo: DemoOrder,
  when: Date,
): { values: StageValues; files: DemoFile[] } {
  const invoiceNumber = String(412 + index * 7);
  const amount = [
    79_250, 18_430.5, 46_900, 152_000, 33_780, 9_640, 61_315, 27_000, 104_500, 12_200,
  ];
  switch (key) {
    case 'intake':
      return {
        values: { [F.contact.id]: demo.contact, [F.items.id]: ITEMS[index % ITEMS.length] ?? '' },
        files:
          index % 2 === 0
            ? [{ fieldId: F.request.id, name: 'Заявка покупателя.docx', source: 'zayavka.docx' }]
            : [],
      };
    case 'invoice':
      return {
        values: { [F.invoiceNumber.id]: invoiceNumber, [F.amount.id]: amount[index] ?? 10_000 },
        files: [{ fieldId: F.invoice.id, name: `Счёт ${invoiceNumber}.pdf`, source: 'schet.pdf' }],
      };
    case 'payment':
      return {
        values: { [F.paidOn.id]: isoDate(when) },
        files:
          index % 3 === 0
            ? []
            : [{ fieldId: F.payment.id, name: 'Платёжное поручение.pdf', source: 'platezhka.pdf' }],
      };
    case 'purchase':
      return {
        values: {
          [F.supplier.id]: index % 2 === 0 ? 'ООО «Электрон-Опт»' : 'ООО «ЧипСнаб»',
          [F.expectedOn.id]: isoDate(new Date(when.getTime() + 7 * DAY)),
        },
        files: [{ fieldId: F.supplierOrder.id, name: 'Заказ поставщику.pdf', source: 'zakaz.pdf' }],
      };
    case 'arrival':
      return {
        values: { [F.arrivedOn.id]: isoDate(when), [F.allArrived.id]: true },
        files: [],
      };
    case 'shipment': {
      const carrier = index % 3 !== 1;
      return {
        values: {
          [F.shipping.id]: carrier ? SHIPPING.carrier.id : SHIPPING.pickup.id,
          ...(carrier ? { [F.track.id]: `10${String(48_213_907 + index * 1_117)}` } : {}),
        },
        files: [{ fieldId: F.upd.id, name: 'УПД.pdf', source: 'upd.pdf' }],
      };
    }
    case 'closing':
      return { values: {}, files: [] };
  }
}
