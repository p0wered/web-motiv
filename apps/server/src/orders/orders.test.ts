import { describe, expect, it } from 'vitest';
import { createOrder, multipart, PDF, setupOffice } from '../test-support/orders.ts';
import type { TestApp } from '../test-support/test-app.ts';

type Headers = Record<string, string>;

async function getOrder(t: TestApp, headers: Headers, id: number) {
  return t.app.inject({ url: `/api/orders/${id}`, headers });
}

async function save(
  t: TestApp,
  headers: Headers,
  order: { id: number; version: number },
  stageId: number,
  values: object,
) {
  return t.app.inject({
    method: 'PUT',
    url: `/api/orders/${order.id}/stages/${stageId}`,
    headers,
    payload: { version: order.version, values },
  });
}

async function complete(
  t: TestApp,
  headers: Headers,
  order: { id: number; version: number },
  stageId: number,
) {
  return t.app.inject({
    method: 'POST',
    url: `/api/orders/${order.id}/stages/${stageId}/complete`,
    headers,
    payload: { version: order.version },
  });
}

async function upload(
  t: TestApp,
  headers: Headers,
  orderId: number,
  stageId: number,
  fieldId: string,
  name: string,
  content: Buffer,
) {
  const body = multipart(name, content);
  return t.app.inject({
    method: 'POST',
    url: `/api/orders/${orderId}/stages/${stageId}/fields/${fieldId}/files`,
    headers: { ...headers, ...body.headers },
    payload: body.payload,
  });
}

describe('заказы', () => {
  it('создание: номер по году, снимок этапов, первый этап открыт', async () => {
    const { t, as, template } = await setupOffice();
    const first = (await createOrder(t, as.manager, template.id)).json();
    const second = (await createOrder(t, as.manager, template.id, 'ИП Иванов')).json();
    const year = new Date().getFullYear();
    expect(first.number).toBe(`${year}-0001`);
    expect(second.number).toBe(`${year}-0002`);
    expect(first.stages.map((s: { name: string; status: string }) => [s.name, s.status])).toEqual([
      ['Приём', 'active'],
      ['Счёт', 'pending'],
      ['Отгрузка', 'pending'],
    ]);
    expect(first.responsible.login).toBe('manager');
    expect(first.stages[0].canEdit).toBe(true);
  });

  it('создавать может только сотрудник с правом', async () => {
    const { t, as, template } = await setupOffice();
    expect((await createOrder(t, as.buh, template.id)).statusCode).toBe(403);
  });

  it('правка шаблона не меняет уже созданный заказ', async () => {
    const { t, as, template, stageIds } = await setupOffice();
    const order = (await createOrder(t, as.manager, template.id)).json();
    await t.app.inject({
      method: 'PATCH',
      url: `/api/stages/${stageIds.priem}`,
      headers: as.admin,
      payload: { name: 'Приём заказа (новое)', fields: [] },
    });
    const after = (await getOrder(t, as.manager, order.id)).json();
    expect(after.stages[0].name).toBe('Приём');
    expect(after.stages[0].fields).toHaveLength(1);
  });

  it('полный путь: каждый этап — своим сотрудником, чужой — не заполнить', async () => {
    const { t, as, template, fields } = await setupOffice();
    let order = (await createOrder(t, as.manager, template.id)).json();
    const [priem, schet, otgruzka] = order.stages;

    // Обязательное поле пустое — «Готово» нельзя.
    const early = await complete(t, as.manager, order, priem.id);
    expect(early.statusCode).toBe(422);
    expect(early.json().fields[fields.items.id]).toBe('Обязательное поле');

    // Бухгалтер не может заполнить этап менеджера, даже видя заказ.
    expect((await save(t, as.buh, order, priem.id, { [fields.items.id]: 'x' })).statusCode).toBe(
      403,
    );

    order = (
      await save(t, as.manager, order, priem.id, { [fields.items.id]: ' 10 шт. КТ315 ' })
    ).json();
    expect(order.stages[0].values[fields.items.id]).toBe('10 шт. КТ315');
    order = (await complete(t, as.manager, order, priem.id)).json();
    expect(order.stages.map((s: { status: string }) => s.status)).toEqual([
      'done',
      'active',
      'pending',
    ]);
    expect(order.currentStage.name).toBe('Счёт');

    // Менеджеру этап бухгалтера не заполнить; бухгалтер — заполняет, с файлом.
    expect(
      (await save(t, as.manager, order, schet.id, { [fields.invoice.id]: '1' })).statusCode,
    ).toBe(403);
    order = (await save(t, as.buh, order, schet.id, { [fields.invoice.id]: 'СЧ-17' })).json();
    expect((await complete(t, as.buh, order, schet.id)).json().error).toMatch(/«Счёт»/);
    const uploaded = await upload(
      t,
      as.buh,
      order.id,
      schet.id,
      fields.invoiceFile.id,
      'Счёт №17.pdf',
      PDF,
    );
    expect(uploaded.statusCode).toBe(201);
    order = uploaded.json();
    order = (await complete(t, as.buh, order, schet.id)).json();

    // Склад без права «видеть все» видит заказ, потому что его этап в нём есть.
    const forSklad = (await getOrder(t, as.sklad, order.id)).json();
    expect(forSklad.stages[2].canEdit).toBe(true);
    order = (await save(t, as.sklad, forSklad, otgruzka.id, { [fields.shipped.id]: true })).json();
    order = (await complete(t, as.sklad, order, otgruzka.id)).json();
    expect(order.status).toBe('completed');
    expect(order.currentStage).toBeNull();

    // Завершённый заказ — только для чтения.
    expect(
      (await save(t, as.sklad, order, otgruzka.id, { [fields.shipped.id]: false })).statusCode,
    ).toBe(409);
    const actions = order.history.map((event: { action: string }) => event.action);
    expect(actions).toContain('order.completed');
    expect(actions.filter((a: string) => a === 'order.stage_completed')).toHaveLength(3);
  });

  it('чужая правка не перезаписывается: устаревшая версия — 409', async () => {
    const { t, as, template, fields } = await setupOffice();
    const order = (await createOrder(t, as.manager, template.id)).json();
    const stageId = order.stages[0].id;
    expect(
      (await save(t, as.manager, order, stageId, { [fields.items.id]: 'первый' })).statusCode,
    ).toBe(200);
    const stale = await save(t, as.manager, order, stageId, { [fields.items.id]: 'второй' });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().code).toBe('version_conflict');
  });

  it('значения проверяются по типу поля и составу этапа', async () => {
    const { t, as, template, fields } = await setupOffice();
    const order = (await createOrder(t, as.manager, template.id)).json();
    const stageId = order.stages[0].id;
    const wrongType = await save(t, as.manager, order, stageId, { [fields.items.id]: 42 });
    expect(wrongType.json().fields[fields.items.id]).toBe('Ожидается текст');
    const alien = await save(t, as.manager, order, stageId, { [fields.invoice.id]: 'x' });
    expect(alien.statusCode).toBe(422);
  });

  it('видимость: без права «видеть все» — только свои заказы, чужой — 404', async () => {
    const { t, as, template } = await setupOffice();
    const order = (await createOrder(t, as.manager, template.id)).json();
    expect((await getOrder(t, as.stranger, order.id)).statusCode).toBe(404);
    const list = (await t.app.inject({ url: '/api/orders', headers: as.stranger })).json();
    expect(list.items).toHaveLength(0);
    const forSklad = (await t.app.inject({ url: '/api/orders', headers: as.sklad })).json();
    expect(forSklad.items).toHaveLength(1);
  });

  it('мои задачи: заказ ждёт того, чей этап открыт', async () => {
    const { t, as, template, fields } = await setupOffice();
    let order = (await createOrder(t, as.manager, template.id)).json();
    const count = async (headers: Headers) =>
      (await t.app.inject({ url: '/api/orders/tasks/count', headers })).json().count;
    expect(await count(as.manager)).toBe(1);
    expect(await count(as.buh)).toBe(0);
    order = (
      await save(t, as.manager, order, order.stages[0].id, { [fields.items.id]: 'x' })
    ).json();
    await complete(t, as.manager, order, order.stages[0].id);
    expect(await count(as.manager)).toBe(0);
    expect(await count(as.buh)).toBe(1);
    const tasks = (await t.app.inject({ url: '/api/orders?tasks=true', headers: as.buh })).json();
    expect(tasks.items[0]).toMatchObject({ number: order.number, waitingForMe: true });
  });

  it('поиск по номеру и покупателю без учёта регистра, в том числе кириллицы', async () => {
    const { t, as, template } = await setupOffice();
    await createOrder(t, as.manager, template.id, 'ООО «Ромашка»');
    await createOrder(t, as.manager, template.id, 'АО Электрон');
    const search = async (q: string) =>
      (
        await t.app.inject({
          url: `/api/orders?search=${encodeURIComponent(q)}`,
          headers: as.manager,
        })
      )
        .json()
        .items.map((item: { customer: string }) => item.customer);
    expect(await search('РОМАШ')).toEqual(['ООО «Ромашка»']);
    expect(await search('электрон')).toEqual(['АО Электрон']);
    expect(await search('-0002')).toEqual(['АО Электрон']);
    expect(await search('%')).toEqual([]);
  });

  it('отмена — только с правом; отменённый заказ не заполнить', async () => {
    const { t, as, template, fields } = await setupOffice();
    const order = (await createOrder(t, as.manager, template.id)).json();
    const denied = await t.app.inject({
      method: 'POST',
      url: `/api/orders/${order.id}/cancel`,
      headers: as.manager,
      payload: { version: order.version },
    });
    expect(denied.statusCode).toBe(403);
    const cancelled = (
      await t.app.inject({
        method: 'POST',
        url: `/api/orders/${order.id}/cancel`,
        headers: as.admin,
        payload: { version: order.version, reason: 'Покупатель передумал' },
      })
    ).json();
    expect(cancelled.status).toBe('cancelled');
    const edit = await save(t, as.manager, cancelled, order.stages[0].id, {
      [fields.items.id]: 'x',
    });
    expect(edit.statusCode).toBe(409);
  });

  it('ответственного меняет только сотрудник с правом', async () => {
    const { t, as, template } = await setupOffice();
    const order = (await createOrder(t, as.manager, template.id)).json();
    const users = (await t.app.inject({ url: '/api/users/directory', headers: as.manager })).json();
    const buhId = users.find((user: { fullName: string }) => user.fullName.endsWith('buh')).id;
    const patch = (headers: Headers) =>
      t.app.inject({
        method: 'PATCH',
        url: `/api/orders/${order.id}`,
        headers,
        payload: { version: order.version, responsibleId: buhId },
      });
    expect((await patch(as.manager)).statusCode).toBe(403);
    const changed = (await patch(as.admin)).json();
    expect(changed.responsible.id).toBe(buhId);
  });
});

describe('файлы заказа', () => {
  async function atInvoiceStage() {
    const office = await setupOffice();
    const { t, as, template, fields } = office;
    let order = (await createOrder(t, as.manager, template.id)).json();
    order = (
      await save(t, as.manager, order, order.stages[0].id, { [fields.items.id]: 'x' })
    ).json();
    order = (await complete(t, as.manager, order, order.stages[0].id)).json();
    return { ...office, order, stageId: order.stages[1].id as number };
  }

  it('тип проверяется по содержимому, а не по расширению', async () => {
    const { t, as, fields, order, stageId } = await atInvoiceStage();
    const fake = await upload(
      t,
      as.buh,
      order.id,
      stageId,
      fields.invoiceFile.id,
      'счёт.pdf',
      Buffer.from('<script>alert(1)</script>'),
    );
    expect(fake.statusCode).toBe(422);
    const html = await upload(
      t,
      as.buh,
      order.id,
      stageId,
      fields.invoiceFile.id,
      'page.html',
      PDF,
    );
    expect(html.statusCode).toBe(422);
  });

  it('загрузить может только исполнитель открытого этапа', async () => {
    const { t, as, fields, order, stageId } = await atInvoiceStage();
    const response = await upload(
      t,
      as.manager,
      order.id,
      stageId,
      fields.invoiceFile.id,
      'a.pdf',
      PDF,
    );
    expect(response.statusCode).toBe(403);
  });

  it('скачивание: видящему заказ — с правильным именем, чужому — 404; в поле один файл', async () => {
    const { t, as, fields, order, stageId } = await atInvoiceStage();
    const uploaded = (
      await upload(t, as.buh, order.id, stageId, fields.invoiceFile.id, 'Счёт №17.pdf', PDF)
    ).json();
    const file = uploaded.stages[1].files[0];
    expect(file).toMatchObject({ name: 'Счёт №17.pdf', mime: 'application/pdf', size: PDF.length });

    const second = await upload(
      t,
      as.buh,
      order.id,
      stageId,
      fields.invoiceFile.id,
      'ещё.pdf',
      PDF,
    );
    expect(second.statusCode).toBe(409);

    const download = await t.app.inject({ url: `/api/files/${file.id}`, headers: as.manager });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-disposition']).toContain(
      "filename*=UTF-8''%D0%A1%D1%87%D1%91%D1%82",
    );
    expect(download.headers['content-disposition']).toMatch(/^attachment/);
    expect(download.rawPayload.equals(PDF)).toBe(true);

    const inline = await t.app.inject({
      url: `/api/files/${file.id}?inline=1`,
      headers: as.manager,
    });
    expect(inline.headers['content-disposition']).toMatch(/^inline/);
    expect(inline.headers['content-security-policy']).toContain("default-src 'none'");

    expect(
      (await t.app.inject({ url: `/api/files/${file.id}`, headers: as.stranger })).statusCode,
    ).toBe(404);
  });

  it('удалить файл можно, пока этап открыт', async () => {
    const { t, as, fields, order, stageId } = await atInvoiceStage();
    const uploaded = (
      await upload(t, as.buh, order.id, stageId, fields.invoiceFile.id, 'a.pdf', PDF)
    ).json();
    const fileId = uploaded.stages[1].files[0].id;
    expect(
      (await t.app.inject({ method: 'DELETE', url: `/api/files/${fileId}`, headers: as.manager }))
        .statusCode,
    ).toBe(403);
    const removed = await t.app.inject({
      method: 'DELETE',
      url: `/api/files/${fileId}`,
      headers: as.buh,
    });
    expect(removed.json().stages[1].files).toEqual([]);
  });
});
