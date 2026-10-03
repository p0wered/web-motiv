import {
  createTemplateRequestSchema,
  idParamsSchema,
  updateTemplateRequestSchema,
} from '@webmotiv/shared';
import type { FastifyInstance } from 'fastify';
import { parseInput, parseParams } from '../http/errors.ts';
import type { TemplatesService } from '../templates/templates-service.ts';
import { actorOf } from './users-routes.ts';

export function registerTemplatesRoutes(api: FastifyInstance, templates: TemplatesService): void {
  const access = { config: { access: 'templates.manage' as const } };

  api.get('/templates', access, async () => templates.list());

  api.post('/templates', access, async (request, reply) => {
    const body = parseInput(createTemplateRequestSchema, request.body);
    return reply.code(201).send(templates.create(body, actorOf(request)));
  });

  api.get('/templates/:id', access, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    return templates.get(id);
  });

  api.patch('/templates/:id', access, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    const body = parseInput(updateTemplateRequestSchema, request.body);
    return templates.update(id, body, actorOf(request));
  });

  api.delete('/templates/:id', access, async (request, reply) => {
    const { id } = parseParams(idParamsSchema, request.params);
    templates.delete(id, actorOf(request));
    return reply.code(204).send();
  });
}
