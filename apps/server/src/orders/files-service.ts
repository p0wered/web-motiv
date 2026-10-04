// Документы в полях этапов (PLAN.md §7.4): белый список форматов, тип — по сигнатуре содержимого,
// загрузка потоком во временный файл и атомарный перенос, на диске — UUID вместо имени.
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  ALLOWED_FILE_TYPES,
  type AllowedFileType,
  FILE_SIZE_LIMIT,
  fileExtension,
  FILES_PER_FIELD_LIMIT,
} from '@webmotiv/shared';
import { and, count, eq } from 'drizzle-orm';
import type { AppDb } from '../db/db.ts';
import { files, orders, orderStages } from '../db/schema.ts';
import { recordEvent } from '../events/event-log.ts';
import { HttpError, notFound } from '../http/errors.ts';
import type { DataPaths } from '../paths.ts';
import { assertEditable, canViewOrder, type Viewer } from './orders-service.ts';

const SIGNATURES: Record<AllowedFileType['signature'], number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  zip: [0x50, 0x4b, 0x03, 0x04], // PK.. — docx, xlsx
  ole: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], // doc, xls
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

export function matchesSignature(head: Buffer, type: AllowedFileType): boolean {
  const signature = SIGNATURES[type.signature];
  return head.length >= signature.length && signature.every((byte, index) => head[index] === byte);
}

/** Имя файла без пути и управляющих символов — только для показа и Content-Disposition. */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return clean.slice(-200) || 'файл';
}

export interface UploadInput {
  orderId: number;
  stageId: number;
  fieldId: string;
  fileName: string;
  stream: Readable;
  /** Поток оборвался по лимиту размера (@fastify/multipart). */
  truncated: () => boolean;
}

export interface DownloadInfo {
  path: string;
  name: string;
  mime: string;
  size: number;
  inline: boolean;
}

export class FilesService {
  private readonly db: AppDb;
  private readonly paths: DataPaths;

  constructor(db: AppDb, paths: DataPaths) {
    this.db = db;
    this.paths = paths;
  }

  async upload(input: UploadInput, viewer: Viewer): Promise<string> {
    const name = cleanFileName(input.fileName);
    const extension = fileExtension(name);
    const type = ALLOWED_FILE_TYPES[extension];
    // Поток нужно дочитать или уничтожить, иначе запрос зависнет.
    const reject = (error: HttpError) => {
      input.stream.resume();
      return error;
    };
    if (!type) {
      throw reject(
        new HttpError(
          422,
          'Такой формат не принимается: нужен PDF, DOC, DOCX, XLS, XLSX, JPG или PNG.',
        ),
      );
    }

    const { order, stage, field } = this.target(input, viewer, reject);
    const existing =
      this.db
        .select({ count: count() })
        .from(files)
        .where(and(eq(files.orderStageId, stage.id), eq(files.fieldId, field.id)))
        .get()?.count ?? 0;
    if (field.type === 'file' && !field.multiple && existing >= 1) {
      throw reject(new HttpError(409, 'В это поле — один файл. Удалите прежний, чтобы заменить.'));
    }
    if (existing >= FILES_PER_FIELD_LIMIT) {
      throw reject(new HttpError(409, `Не больше ${FILES_PER_FIELD_LIMIT} файлов в поле.`));
    }

    const id = randomUUID();
    const tmpPath = path.join(this.paths.tmpDir, `${id}.upload`);
    const hash = createHash('sha256');
    let size = 0;
    let head = Buffer.alloc(0);
    try {
      await pipeline(
        input.stream,
        async function* (source: AsyncIterable<Buffer>) {
          for await (const chunk of source) {
            size += chunk.length;
            if (head.length < 16) head = Buffer.concat([head, chunk]).subarray(0, 16);
            hash.update(chunk);
            yield chunk;
          }
        },
        createWriteStream(tmpPath, { flags: 'wx', mode: 0o600 }),
      );
      if (input.truncated()) {
        throw new HttpError(413, `Файл больше ${FILE_SIZE_LIMIT / 1024 / 1024} МБ.`);
      }
      if (size === 0) throw new HttpError(422, 'Файл пустой.');
      if (!matchesSignature(head, type)) {
        throw new HttpError(422, `Содержимое файла не похоже на ${extension.toUpperCase()}.`);
      }
      await rename(tmpPath, path.join(this.paths.filesDir, id));
    } catch (error) {
      await rm(tmpPath, { force: true });
      throw error;
    }

    this.db.transaction((tx) => {
      tx.insert(files)
        .values({
          id,
          orderId: order.id,
          orderStageId: stage.id,
          fieldId: field.id,
          originalName: name,
          mime: type.mime,
          size,
          sha256: hash.digest('hex'),
          uploadedBy: viewer.id,
          uploadedAt: new Date(),
        })
        .run();
      recordEvent(tx, {
        actorId: viewer.id,
        action: 'order.file_uploaded',
        entityType: 'file',
        entityId: id,
        orderId: order.id,
        ip: viewer.ip,
        payload: { number: order.number, stage: stage.name, field: field.label, name },
      });
    });
    return id;
  }

  /** Удалить файл можно, пока его этап открыт, — тому, кто этап заполняет. */
  async delete(fileId: string, viewer: Viewer): Promise<number> {
    const { file, order, stage } = this.load(fileId, viewer);
    assertEditable(viewer, order, stage);
    this.db.transaction((tx) => {
      tx.delete(files).where(eq(files.id, file.id)).run();
      recordEvent(tx, {
        actorId: viewer.id,
        action: 'order.file_deleted',
        entityType: 'file',
        entityId: file.id,
        orderId: order.id,
        ip: viewer.ip,
        payload: { number: order.number, stage: stage.name, name: file.originalName },
      });
    });
    await rm(path.join(this.paths.filesDir, file.id), { force: true });
    return order.id;
  }

  /** Файл для отдачи: только тому, кто видит заказ. Каждое скачивание — в журнал. */
  async download(fileId: string, inline: boolean, viewer: Viewer): Promise<DownloadInfo> {
    const { file, order, stage } = this.load(fileId, viewer);
    const type = ALLOWED_FILE_TYPES[fileExtension(file.originalName)];
    const filePath = path.join(this.paths.filesDir, file.id);
    const info = await stat(filePath).catch(() => null);
    if (!info) throw notFound('Файл не найден на диске');
    recordEvent(this.db, {
      actorId: viewer.id,
      action: 'order.file_downloaded',
      entityType: 'file',
      entityId: file.id,
      orderId: order.id,
      ip: viewer.ip,
      payload: { number: order.number, stage: stage.name, name: file.originalName, inline },
    });
    return {
      path: filePath,
      name: file.originalName,
      mime: type?.mime ?? 'application/octet-stream',
      size: info.size,
      // Показать в браузере — только PDF и картинки; остальное всегда скачивается.
      inline: inline && Boolean(type?.inline),
    };
  }

  open(filePath: string): Readable {
    return createReadStream(filePath);
  }

  private load(fileId: string, viewer: Viewer) {
    const file = this.db.select().from(files).where(eq(files.id, fileId)).get();
    if (!file) throw notFound('Файл не найден');
    const order = this.db.select().from(orders).where(eq(orders.id, file.orderId)).get();
    const stageRows = this.db
      .select()
      .from(orderStages)
      .where(eq(orderStages.orderId, file.orderId))
      .all();
    const stage = stageRows.find((row) => row.id === file.orderStageId);
    if (!order || !stage || !canViewOrder(viewer, order, stageRows))
      throw notFound('Файл не найден');
    return { file, order, stage };
  }

  private target(input: UploadInput, viewer: Viewer, reject: (error: HttpError) => HttpError) {
    const order = this.db.select().from(orders).where(eq(orders.id, input.orderId)).get();
    const stageRows = this.db
      .select()
      .from(orderStages)
      .where(eq(orderStages.orderId, input.orderId))
      .all();
    if (!order || !canViewOrder(viewer, order, stageRows))
      throw reject(notFound('Заказ не найден'));
    const stage = stageRows.find((row) => row.id === input.stageId);
    if (!stage) throw reject(notFound('Этап не найден'));
    try {
      assertEditable(viewer, order, stage);
    } catch (error) {
      throw reject(error as HttpError);
    }
    const field = stage.fields.find((item) => item.id === input.fieldId);
    if (!field || field.type !== 'file')
      throw reject(notFound('В этапе нет такого поля для файлов'));
    return { order, stage, field };
  }
}
