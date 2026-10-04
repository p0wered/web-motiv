import { randomUUID } from 'node:crypto';
import type { StageField } from '@webmotiv/shared';
import { createStage, createTemplate } from './catalog.ts';
import { addUser, CSRF, createTestApp, loginAs, type TestApp } from './test-app.ts';

export const PDF = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');

/** Тело multipart с одним файлом — для app.inject. */
export function multipart(fileName: string, content: Buffer) {
  const boundary = `----webmotiv${randomUUID()}`;
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        'Content-Type: application/octet-stream\r\n\r\n',
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}

const field = (type: StageField['type'], label: string, required: boolean, extra = {}) =>
  ({ id: randomUUID(), type, label, required, hint: '', ...extra }) as StageField;

/**
 * Офис для тестов заказов: менеджер ведёт заказ, бухгалтер выставляет счёт, склад отгружает.
 * Шаблон: «Приём» (ответственный) → «Счёт» (Бухгалтер) → «Отгрузка» (Склад).
 */
export async function setupOffice() {
  const t: TestApp = await createTestApp();
  await addUser(t, { login: 'admin', roles: ['Администратор'] });
  const admin = await loginAs(t, 'admin');

  // Роль без права видеть все заказы — для проверки видимости.
  await t.app.inject({
    method: 'POST',
    url: '/api/roles',
    headers: admin,
    payload: { name: 'Склад без обзора', permissions: [] },
  });
  await addUser(t, { login: 'manager', roles: ['Менеджер'] });
  await addUser(t, { login: 'buh', roles: ['Бухгалтер'] });
  await addUser(t, { login: 'sklad', roles: ['Склад без обзора'] });
  await addUser(t, { login: 'stranger', roles: [] });

  const fields = {
    items: field('textarea', 'Позиции', true),
    invoice: field('text', 'Номер счёта', true),
    invoiceFile: field('file', 'Счёт', true, { multiple: false }),
    shipped: field('checkbox', 'Отгружено', true),
  };
  const priem = (await createStage(t, admin, { name: 'Приём', fields: [fields.items] })).json();
  const schet = (
    await createStage(t, admin, {
      name: 'Счёт',
      roleName: 'Бухгалтер',
      fields: [fields.invoice, fields.invoiceFile],
    })
  ).json();
  const otgruzka = (
    await createStage(t, admin, {
      name: 'Отгрузка',
      roleName: 'Склад без обзора',
      fields: [fields.shipped],
    })
  ).json();
  const template = (
    await createTemplate(t, admin, 'Тестовый заказ', [priem.id, schet.id, otgruzka.id])
  ).json();

  const as = {
    admin,
    manager: await loginAs(t, 'manager'),
    buh: await loginAs(t, 'buh'),
    sklad: await loginAs(t, 'sklad'),
    stranger: await loginAs(t, 'stranger'),
  };
  return { t, as, fields, template, stageIds: { priem: priem.id, schet: schet.id } };
}

export async function createOrder(
  t: TestApp,
  headers: Record<string, string>,
  templateId: number,
  customer = 'ООО «Ромашка»',
) {
  return t.app.inject({
    method: 'POST',
    url: '/api/orders',
    headers,
    payload: { templateId, customer },
  });
}

export { CSRF };
