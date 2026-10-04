// Схема БД (PLAN.md §4). Миграции генерирует drizzle-kit: `npm run db:generate`.
// До первого релиза схему можно менять как угодно и пересоздавать миграции заново.
import {
  ORDER_STAGE_STATUSES,
  ORDER_STATUSES,
  type Permission,
  STAGE_EXECUTORS,
  type StageField,
  type StageValues,
} from '@webmotiv/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/** Время — миллисекунды Unix в INTEGER, в коде — Date. */
const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    login: text('login').notNull(),
    fullName: text('full_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    /** Временный пароль от администратора: при входе сотрудник задаёт свой. */
    mustChangePassword: integer('must_change_password', { mode: 'boolean' })
      .notNull()
      .default(true),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: timestamp('created_at').notNull(),
    lastLoginAt: timestamp('last_login_at'),
  },
  (t) => [uniqueIndex('users_login_unique').on(sql`lower(${t.login})`)],
);

export const roles = sqliteTable('roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  permissions: text('permissions', { mode: 'json' }).$type<Permission[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const userRoles = sqliteTable(
  'user_roles',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index('user_roles_role').on(t.roleId)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 от токена из cookie; сам токен не хранится. */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull(),
    lastSeenAt: timestamp('last_seen_at').notNull(),
    idleExpiresAt: timestamp('idle_expires_at').notNull(),
    absoluteExpiresAt: timestamp('absolute_expires_at').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user').on(t.userId), index('sessions_idle').on(t.idleExpiresAt)],
);

/** Библиотека этапов. */
export const stages = sqliteTable(
  'stages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    executor: text('executor', { enum: STAGE_EXECUTORS }).notNull(),
    executorRoleId: integer('executor_role_id').references(() => roles.id),
    fields: text('fields', { mode: 'json' }).$type<StageField[]>().notNull().default([]),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [
    check(
      'stages_executor_role',
      sql`(${t.executor} = 'role') = (${t.executorRoleId} IS NOT NULL)`,
    ),
  ],
);

/** Шаблоны — последовательности этапов. */
export const templates = sqliteTable('templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});

export const templateStages = sqliteTable(
  'template_stages',
  {
    templateId: integer('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    stageId: integer('stage_id')
      .notNull()
      .references(() => stages.id),
    position: integer('position').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.templateId, t.position] }),
    index('template_stages_stage').on(t.stageId),
  ],
);

export const orders = sqliteTable(
  'orders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Автономер вида 2026-0001. */
    number: text('number').notNull().unique(),
    customer: text('customer').notNull(),
    comment: text('comment').notNull().default(''),
    /** Номер и покупатель в нижнем регистре — для поиска: LIKE в SQLite не знает кириллицу. */
    searchText: text('search_text').notNull().default(''),
    templateId: integer('template_id')
      .notNull()
      .references(() => templates.id),
    responsibleId: integer('responsible_id')
      .notNull()
      .references(() => users.id),
    status: text('status', { enum: ORDER_STATUSES }).notNull().default('active'),
    /** Растёт при каждом изменении: защита от тихой перезаписи чужих правок. */
    version: integer('version').notNull().default(0),
    createdBy: integer('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
    completedAt: timestamp('completed_at'),
  },
  (t) => [
    index('orders_status').on(t.status),
    index('orders_responsible').on(t.responsibleId),
    index('orders_template').on(t.templateId),
  ],
);

/** Этапы заказа — снимок этапов шаблона на момент создания заказа. */
export const orderStages = sqliteTable(
  'order_stages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id),
    position: integer('position').notNull(),
    sourceStageId: integer('source_stage_id').references(() => stages.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    executor: text('executor', { enum: STAGE_EXECUTORS }).notNull(),
    executorRoleId: integer('executor_role_id').references(() => roles.id),
    fields: text('fields', { mode: 'json' }).$type<StageField[]>().notNull(),
    values: text('values', { mode: 'json' }).$type<StageValues>().notNull().default({}),
    status: text('status', { enum: ORDER_STAGE_STATUSES }).notNull().default('pending'),
    completedBy: integer('completed_by').references(() => users.id),
    completedAt: timestamp('completed_at'),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('order_stages_position').on(t.orderId, t.position),
    index('order_stages_active').on(t.status, t.executor, t.executorRoleId),
  ],
);

export const files = sqliteTable(
  'files',
  {
    /** UUID — он же имя файла в data/files. */
    id: text('id').primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id),
    orderStageId: integer('order_stage_id')
      .notNull()
      .references(() => orderStages.id),
    fieldId: text('field_id').notNull(),
    originalName: text('original_name').notNull(),
    mime: text('mime').notNull(),
    size: integer('size').notNull(),
    sha256: text('sha256').notNull(),
    uploadedBy: integer('uploaded_by')
      .notNull()
      .references(() => users.id),
    uploadedAt: timestamp('uploaded_at').notNull(),
  },
  (t) => [index('files_order_stage').on(t.orderStageId)],
);

/** Журнал событий: только добавление. История заказа — выборка по order_id. */
export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: timestamp('at').notNull(),
    /** Пусто — система или неизвестный пользователь (например, неудачный вход). */
    actorId: integer('actor_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    orderId: integer('order_id').references(() => orders.id),
    ip: text('ip'),
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  },
  (t) => [
    index('events_at').on(t.at),
    index('events_order').on(t.orderId),
    index('events_actor').on(t.actorId),
  ],
);
