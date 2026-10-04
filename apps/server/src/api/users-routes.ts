import { createUserRequestSchema, idParamsSchema, updateUserRequestSchema } from '@webmotiv/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireAuth } from '../auth/access.ts';
import { parseInput, parseParams } from '../http/errors.ts';
import type { Actor, UsersService } from '../users/users-service.ts';

export const actorOf = (request: FastifyRequest): Actor => {
  const auth = requireAuth(request);
  return { id: auth.user.id, ip: request.ip, permissions: auth.permissions };
};

export function registerUsersRoutes(api: FastifyInstance, users: UsersService): void {
  const access = { config: { access: 'users.manage' as const } };

  api.get('/users', access, async () => users.list());

  // Кого можно выбрать в поле «Сотрудник» и ответственным: имена всех, без логинов и ролей.
  api.get('/users/directory', { config: { access: 'authenticated' } }, async () =>
    users.directory(),
  );

  api.post('/users', access, async (request, reply) => {
    const body = parseInput(createUserRequestSchema, request.body);
    return reply.code(201).send(await users.create(body, actorOf(request)));
  });

  api.get('/users/:id', access, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    return users.get(id);
  });

  api.patch('/users/:id', access, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    const body = parseInput(updateUserRequestSchema, request.body);
    return users.update(id, body, actorOf(request));
  });

  api.post('/users/:id/password-reset', access, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    return { temporaryPassword: await users.resetPassword(id, actorOf(request)) };
  });

  api.delete('/users/:id/sessions', access, async (request, reply) => {
    const { id } = parseParams(idParamsSchema, request.params);
    users.terminateSessions(id, actorOf(request));
    return reply.code(204).send();
  });
}
