import { createRoleRequestSchema, idParamsSchema, updateRoleRequestSchema } from '@webmotiv/shared';
import type { FastifyInstance } from 'fastify';
import { parseInput, parseParams } from '../http/errors.ts';
import type { RolesService } from '../roles/roles-service.ts';
import { actorOf } from './users-routes.ts';

export function registerRolesRoutes(api: FastifyInstance, roles: RolesService): void {
  const manage = { config: { access: 'roles.manage' as const } };

  // Список ролей нужен и для назначения ролей сотрудникам.
  api.get('/roles', { config: { access: ['roles.manage', 'users.manage'] as const } }, async () =>
    roles.list(),
  );

  api.post('/roles', manage, async (request, reply) => {
    const body = parseInput(createRoleRequestSchema, request.body);
    return reply.code(201).send(roles.create(body, actorOf(request)));
  });

  api.patch('/roles/:id', manage, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    const body = parseInput(updateRoleRequestSchema, request.body);
    return roles.update(id, body, actorOf(request));
  });

  api.delete('/roles/:id', manage, async (request, reply) => {
    const { id } = parseParams(idParamsSchema, request.params);
    roles.delete(id, actorOf(request));
    return reply.code(204).send();
  });
}
