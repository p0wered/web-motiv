import {
  createStageRequestSchema,
  idParamsSchema,
  updateStageRequestSchema,
} from '@webmotiv/shared';
import type { FastifyInstance } from 'fastify';
import { parseInput, parseParams } from '../http/errors.ts';
import type { StagesService } from '../stages/stages-service.ts';
import { actorOf } from './users-routes.ts';

export function registerStagesRoutes(api: FastifyInstance, stages: StagesService): void {
  const access = { config: { access: 'templates.manage' as const } };

  api.get('/stages', access, async () => stages.list());

  api.post('/stages', access, async (request, reply) => {
    const body = parseInput(createStageRequestSchema, request.body);
    return reply.code(201).send(stages.create(body, actorOf(request)));
  });

  api.get('/stages/:id', access, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    return stages.get(id);
  });

  api.patch('/stages/:id', access, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    const body = parseInput(updateStageRequestSchema, request.body);
    return stages.update(id, body, actorOf(request));
  });

  api.delete('/stages/:id', access, async (request, reply) => {
    const { id } = parseParams(idParamsSchema, request.params);
    stages.delete(id, actorOf(request));
    return reply.code(204).send();
  });
}
