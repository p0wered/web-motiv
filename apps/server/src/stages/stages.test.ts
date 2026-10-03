import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createStage, createTemplate, textField } from '../test-support/catalog.ts';
import { addUser, createTestApp, loginAs } from '../test-support/test-app.ts';

async function setup() {
  const t = await createTestApp();
  await addUser(t, { login: 'boss', roles: ['Руководитель'] });
  const boss = await loginAs(t, 'boss');
  return { t, boss };
}

describe('этапы', () => {
  it('создание с полями и исполнителем-ролью', async () => {
    const { t, boss } = await setup();
    const response = await createStage(t, boss, {
      name: 'Счёт',
      roleName: 'Бухгалтер',
      fields: [
        textField('Номер счёта', true),
        {
          id: randomUUID(),
          type: 'select',
          label: 'Способ оплаты',
          required: false,
          hint: '',
          options: [
            { id: randomUUID(), label: 'Безнал' },
            { id: randomUUID(), label: 'Наличные' },
          ],
        },
        {
          id: randomUUID(),
          type: 'file',
          label: 'Счёт',
          required: true,
          hint: '',
          multiple: false,
        },
      ],
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      name: 'Счёт',
      executor: 'role',
      executorRole: { name: 'Бухгалтер' },
      archived: false,
      templates: [],
    });
    expect(response.json().fields).toHaveLength(3);
  });

  it('роль-исполнитель обязательна, название уникально, поля без повторов', async () => {
    const { t, boss } = await setup();
    const noRole = await t.app.inject({
      method: 'POST',
      url: '/api/stages',
      headers: boss,
      payload: { name: 'Склад', executor: 'role', executorRoleId: null, fields: [] },
    });
    expect(noRole.json().fields.executorRoleId).toBe('Выберите роль');

    await createStage(t, boss, { name: 'Оплата' });
    const duplicate = await createStage(t, boss, { name: 'оплата' });
    expect(duplicate.json().fields.name).toBe('Такой этап уже есть');

    const twins = await createStage(t, boss, {
      name: 'Отгрузка',
      fields: [textField('Трек-номер'), textField('трек-номер')],
    });
    expect(twins.statusCode).toBe(422);
    expect(twins.json().fields.fields).toMatch(/уже есть/);
  });

  it('в поле нельзя подсунуть лишние свойства', async () => {
    const { t, boss } = await setup();
    const response = await createStage(t, boss, {
      name: 'Приём',
      fields: [{ ...textField('Контакт'), script: '<b>x</b>' } as never],
    });
    expect(response.statusCode).toBe(422);
  });

  it('правка пишет в журнал, что поменялось в полях', async () => {
    const { t, boss } = await setup();
    const stage = (
      await createStage(t, boss, { name: 'Приём', fields: [textField('Контакт')] })
    ).json();
    const response = await t.app.inject({
      method: 'PATCH',
      url: `/api/stages/${stage.id}`,
      headers: boss,
      payload: { fields: [{ ...stage.fields[0], required: true }, textField('Позиции', true)] },
    });
    expect(response.statusCode).toBe(200);
    const events = (await t.app.inject({ url: '/api/events?group=stage', headers: boss })).json();
    expect(events.items[0]).toMatchObject({
      action: 'stage.updated',
      payload: { changes: { fields: { added: ['Позиции'], removed: [], changed: ['Контакт'] } } },
    });
  });

  it('этап из действующего шаблона нельзя ни удалить, ни отправить в архив', async () => {
    const { t, boss } = await setup();
    const stage = (await createStage(t, boss, { name: 'Оплата' })).json();
    await createTemplate(t, boss, 'Заказ', [stage.id]);
    const remove = await t.app.inject({
      method: 'DELETE',
      url: `/api/stages/${stage.id}`,
      headers: boss,
    });
    expect(remove.statusCode).toBe(409);
    const archive = await t.app.inject({
      method: 'PATCH',
      url: `/api/stages/${stage.id}`,
      headers: boss,
      payload: { archived: true },
    });
    expect(archive.statusCode).toBe(409);
    expect(archive.json().error).toMatch(/«Заказ»/);
  });

  it('архив: только чтение до восстановления, удаление неиспользованного', async () => {
    const { t, boss } = await setup();
    const stage = (await createStage(t, boss, { name: 'Закрытие' })).json();
    const url = `/api/stages/${stage.id}`;
    const archived = await t.app.inject({
      method: 'PATCH',
      url,
      headers: boss,
      payload: { archived: true },
    });
    expect(archived.json().archived).toBe(true);
    const edit = await t.app.inject({
      method: 'PATCH',
      url,
      headers: boss,
      payload: { name: 'Закрыть' },
    });
    expect(edit.statusCode).toBe(409);
    const restored = await t.app.inject({
      method: 'PATCH',
      url,
      headers: boss,
      payload: { archived: false },
    });
    expect(restored.json().archived).toBe(false);
    expect((await t.app.inject({ method: 'DELETE', url, headers: boss })).statusCode).toBe(204);
  });

  it('роль-исполнителя этапа удалить нельзя', async () => {
    const { t, boss } = await setup();
    await createStage(t, boss, { name: 'Отгрузка', roleName: 'Склад' });
    await addUser(t, { login: 'admin', roles: ['Администратор'] });
    const admin = await loginAs(t, 'admin');
    const roles = (await t.app.inject({ url: '/api/roles', headers: admin })).json();
    const sklad = roles.find((role: { name: string }) => role.name === 'Склад');
    expect(sklad.stageCount).toBe(1);
    const response = await t.app.inject({
      method: 'DELETE',
      url: `/api/roles/${sklad.id}`,
      headers: admin,
    });
    expect(response.statusCode).toBe(409);
  });
});
