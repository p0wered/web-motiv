import {
  cancelOrderRequestSchema,
  completeStageRequestSchema,
  createOrderRequestSchema,
  FILE_SIZE_LIMIT,
  idParamsSchema,
  orderStageParamsSchema,
  ordersQuerySchema,
  saveStageRequestSchema,
  updateOrderRequestSchema,
} from '@webmotiv/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../auth/access.ts';
import { HttpError, parseInput, parseParams } from '../http/errors.ts';
import type { FilesService } from '../orders/files-service.ts';
import type { OrdersService, Viewer } from '../orders/orders-service.ts';

export const viewerOf = (request: FastifyRequest): Viewer => {
  const auth = requireAuth(request);
  return {
    id: auth.user.id,
    ip: request.ip,
    permissions: auth.permissions,
    roleIds: auth.roles.map((role) => role.id),
  };
};

const fileParamsSchema = z.strictObject({ fileId: z.uuid() });
const uploadParamsSchema = z.strictObject({
  id: z.coerce.number().int().positive(),
  stageId: z.coerce.number().int().positive(),
  fieldId: z.uuid(),
});
const downloadQuerySchema = z.strictObject({ inline: z.enum(['1']).optional() });

/** Имя файла в заголовке: ASCII-заглушка для старых клиентов и точное имя в UTF-8. */
export function contentDisposition(kind: 'inline' | 'attachment', name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  // RFC 5987: encodeURIComponent оставляет ' ( ) * как есть, а в filename* они недопустимы.
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function registerOrdersRoutes(
  api: FastifyInstance,
  orders: OrdersService,
  files: FilesService,
): void {
  // Видимость проверяется внутри: без права «видеть все» — только свои заказы.
  const anyone = { config: { access: 'authenticated' as const } };

  api.get('/orders', anyone, async (request) =>
    orders.list(parseParams(ordersQuerySchema, request.query), viewerOf(request)),
  );

  api.get('/orders/tasks/count', anyone, async (request) => ({
    count: orders.taskCount(viewerOf(request)),
  }));

  api.post('/orders', { config: { access: 'orders.create' } }, async (request, reply) => {
    const body = parseInput(createOrderRequestSchema, request.body);
    return reply.code(201).send(orders.create(body, viewerOf(request)));
  });

  api.get('/orders/:id', anyone, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    return orders.get(id, viewerOf(request));
  });

  api.patch('/orders/:id', anyone, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    return orders.update(id, parseInput(updateOrderRequestSchema, request.body), viewerOf(request));
  });

  api.post('/orders/:id/cancel', { config: { access: 'orders.manage' } }, async (request) => {
    const { id } = parseParams(idParamsSchema, request.params);
    return orders.cancel(id, parseInput(cancelOrderRequestSchema, request.body), viewerOf(request));
  });

  api.put('/orders/:id/stages/:stageId', anyone, async (request) => {
    const { id, stageId } = parseParams(orderStageParamsSchema, request.params);
    const body = parseInput(saveStageRequestSchema, request.body);
    return orders.saveStage(id, stageId, body, viewerOf(request));
  });

  api.post('/orders/:id/stages/:stageId/complete', anyone, async (request) => {
    const { id, stageId } = parseParams(orderStageParamsSchema, request.params);
    const { version } = parseInput(completeStageRequestSchema, request.body);
    return orders.completeStage(id, stageId, version, viewerOf(request));
  });

  api.post('/orders/:id/stages/:stageId/fields/:fieldId/files', anyone, async (request, reply) => {
    const { id, stageId, fieldId } = parseParams(uploadParamsSchema, request.params);
    if (!request.isMultipart()) throw new HttpError(415, 'Ожидается файл.');
    const data = await request.file({ limits: { fileSize: FILE_SIZE_LIMIT, files: 1 } });
    if (!data) throw new HttpError(422, 'Файл не выбран.');
    const viewer = viewerOf(request);
    await files.upload(
      {
        orderId: id,
        stageId,
        fieldId,
        fileName: data.filename,
        stream: data.file,
        truncated: () => data.file.truncated,
      },
      viewer,
    );
    return reply.code(201).send(orders.get(id, viewer));
  });

  api.delete('/files/:fileId', anyone, async (request) => {
    const { fileId } = parseParams(fileParamsSchema, request.params);
    const viewer = viewerOf(request);
    const orderId = await files.delete(fileId, viewer);
    return orders.get(orderId, viewer);
  });

  api.get('/files/:fileId', anyone, async (request, reply) => {
    const { fileId } = parseParams(fileParamsSchema, request.params);
    const { inline } = parseParams(downloadQuerySchema, request.query);
    const file = await files.download(fileId, inline === '1', viewerOf(request));
    reply
      .header('content-type', file.mime)
      .header('content-length', String(file.size))
      .header(
        'content-disposition',
        contentDisposition(file.inline ? 'inline' : 'attachment', file.name),
      )
      .header('cache-control', 'private, no-store');
    if (file.inline) {
      // Показ во фрейме на своей странице; сам документ ничего не грузит и не выполняет.
      reply
        .header(
          'content-security-policy',
          "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'",
        )
        .header('x-frame-options', 'SAMEORIGIN');
    }
    return reply.send(files.open(file.path));
  });
}
