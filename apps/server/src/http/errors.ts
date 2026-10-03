import { fieldErrors } from '@webmotiv/shared';
import type { z } from 'zod';

/** Ошибка с ответом для пользователя: статус, текст и (для форм) ошибки по полям. */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly fields: Record<string, string> | undefined;
  readonly code: string | undefined;

  constructor(
    statusCode: number,
    message: string,
    options: { fields?: Record<string, string>; code?: string } = {},
  ) {
    super(message);
    this.statusCode = statusCode;
    this.fields = options.fields;
    this.code = options.code;
  }
}

export const notFound = (message = 'Не найдено') => new HttpError(404, message);

/** Ошибка формы: сообщение у конкретного поля. */
export const fieldError = (field: string, message: string) =>
  new HttpError(422, 'Проверьте поля формы.', { fields: { [field]: message } });

/** Разбор входных данных: при ошибке — 422 с сообщениями по полям. */
export function parseInput<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new HttpError(422, 'Проверьте поля формы.', { fields: fieldErrors(parsed.error) });
  }
  return parsed.data;
}

/** Разбор параметров адреса и строки запроса: при ошибке — 400 (это не ошибка формы). */
export function parseParams<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new HttpError(400, 'Некорректный запрос.');
  return parsed.data;
}
