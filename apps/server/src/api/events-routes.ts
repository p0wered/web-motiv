import { eventsQuerySchema } from '@webmotiv/shared';
import type { FastifyInstance } from 'fastify';
import type { AppDb } from '../db/db.ts';
import { queryEvents } from '../events/event-log.ts';
import { parseParams } from '../http/errors.ts';

export function registerEventsRoutes(api: FastifyInstance, db: AppDb): void {
  api.get('/events', { config: { access: 'audit.view' } }, async (request) =>
    queryEvents(db, parseParams(eventsQuerySchema, request.query)),
  );
}
