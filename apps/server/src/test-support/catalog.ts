import { randomUUID } from 'node:crypto';
import type { StageField } from '@webmotiv/shared';
import type { TestApp } from './test-app.ts';

export const textField = (label: string, required = false): StageField => ({
  id: randomUUID(),
  type: 'text',
  label,
  required,
  hint: '',
});

/** Этап через API; возвращает ответ целиком. */
export async function createStage(
  t: TestApp,
  headers: Record<string, string>,
  input: { name: string; fields?: StageField[]; roleName?: string },
) {
  let executorRoleId: number | null = null;
  if (input.roleName) {
    const roles = (await t.app.inject({ url: '/api/roles', headers })).json();
    executorRoleId = roles.find((role: { name: string }) => role.name === input.roleName).id;
  }
  return t.app.inject({
    method: 'POST',
    url: '/api/stages',
    headers,
    payload: {
      name: input.name,
      executor: executorRoleId ? 'role' : 'responsible',
      executorRoleId,
      fields: input.fields ?? [],
    },
  });
}

export async function createTemplate(
  t: TestApp,
  headers: Record<string, string>,
  name: string,
  stageIds: number[],
) {
  return t.app.inject({
    method: 'POST',
    url: '/api/templates',
    headers,
    payload: { name, stageIds },
  });
}
