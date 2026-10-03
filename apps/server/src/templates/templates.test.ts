import { describe, expect, it } from 'vitest';
import { createStage, createTemplate } from '../test-support/catalog.ts';
import { addUser, createTestApp, loginAs, type TestApp } from '../test-support/test-app.ts';

async function setup() {
  const t = await createTestApp();
  await addUser(t, { login: 'boss', roles: ['Руководитель'] });
  const boss = await loginAs(t, 'boss');
  const stageId = async (name: string): Promise<number> =>
    (await createStage(t, boss, { name })).json().id;
  const ids = {
    priem: await stageId('Приём'),
    schet: await stageId('Счёт'),
    oplata: await stageId('Оплата'),
    otgruzka: await stageId('Отгрузка'),
  };
  return { t, boss, ids };
}

const names = (template: { stages: { name: string }[] }) => template.stages.map((s) => s.name);

async function patch(t: TestApp, headers: Record<string, string>, id: number, payload: object) {
  return t.app.inject({ method: 'PATCH', url: `/api/templates/${id}`, headers, payload });
}

describe('шаблоны', () => {
  it('создание: этапы в заданном порядке', async () => {
    const { t, boss, ids } = await setup();
    const response = await createTemplate(t, boss, 'Под поставку', [
      ids.priem,
      ids.oplata,
      ids.schet,
    ]);
    expect(response.statusCode).toBe(201);
    expect(names(response.json())).toEqual(['Приём', 'Оплата', 'Счёт']);
  });

  it('без этапов и с повтором этапа — ошибка формы', async () => {
    const { t, boss, ids } = await setup();
    expect((await createTemplate(t, boss, 'Пустой', [])).json().fields.stageIds).toBe(
      'Добавьте хотя бы один этап',
    );
    expect((await createTemplate(t, boss, 'Двойной', [ids.priem, ids.priem])).statusCode).toBe(422);
  });

  it('перестановка этапов пишется в журнал', async () => {
    const { t, boss, ids } = await setup();
    const template = (await createTemplate(t, boss, 'Со склада', [ids.priem, ids.schet])).json();
    const updated = await patch(t, boss, template.id, {
      stageIds: [ids.schet, ids.priem, ids.otgruzka],
    });
    expect(names(updated.json())).toEqual(['Счёт', 'Приём', 'Отгрузка']);
    const events = (
      await t.app.inject({ url: '/api/events?group=template', headers: boss })
    ).json();
    expect(events.items[0]).toMatchObject({
      action: 'template.updated',
      payload: {
        changes: { stages: { from: ['Приём', 'Счёт'], to: ['Счёт', 'Приём', 'Отгрузка'] } },
      },
    });
  });

  it('архивный этап в шаблон не добавить', async () => {
    const { t, boss, ids } = await setup();
    await t.app.inject({
      method: 'PATCH',
      url: `/api/stages/${ids.otgruzka}`,
      headers: boss,
      payload: { archived: true },
    });
    const response = await createTemplate(t, boss, 'Заказ', [ids.priem, ids.otgruzka]);
    expect(response.json().fields.stageIds).toBe('Этап «Отгрузка» в архиве');
  });

  it('архивный шаблон не восстановить, пока его этапы в архиве', async () => {
    const { t, boss, ids } = await setup();
    const template = (await createTemplate(t, boss, 'Заказ', [ids.priem, ids.schet])).json();
    await patch(t, boss, template.id, { archived: true });
    // Шаблон в архиве — этап можно архивировать.
    const stageArchived = await t.app.inject({
      method: 'PATCH',
      url: `/api/stages/${ids.schet}`,
      headers: boss,
      payload: { archived: true },
    });
    expect(stageArchived.statusCode).toBe(200);
    const restore = await patch(t, boss, template.id, { archived: false });
    expect(restore.statusCode).toBe(409);
    expect(restore.json().error).toMatch(/«Счёт»/);
  });

  it('удаление шаблона оставляет этапы в библиотеке', async () => {
    const { t, boss, ids } = await setup();
    const template = (await createTemplate(t, boss, 'Заказ', [ids.priem])).json();
    const response = await t.app.inject({
      method: 'DELETE',
      url: `/api/templates/${template.id}`,
      headers: boss,
    });
    expect(response.statusCode).toBe(204);
    const stage = (await t.app.inject({ url: `/api/stages/${ids.priem}`, headers: boss })).json();
    expect(stage.templates).toEqual([]);
  });
});
