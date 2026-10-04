// Какие документы можно прикреплять (PLAN.md §7.4): белый список расширений, тип проверяется
// по началу содержимого, а не по расширению или MIME от браузера.

export const FILE_SIZE_LIMIT = 25 * 1024 * 1024;
export const FILES_PER_FIELD_LIMIT = 20;

export interface AllowedFileType {
  mime: string;
  /** Сигнатура начала файла; одна на несколько форматов (docx и xlsx — оба zip). */
  signature: 'pdf' | 'zip' | 'ole' | 'jpeg' | 'png';
  /** Браузер умеет показать сам (PDF, картинки). */
  inline: boolean;
}

export const ALLOWED_FILE_TYPES: Record<string, AllowedFileType> = {
  pdf: { mime: 'application/pdf', signature: 'pdf', inline: true },
  doc: { mime: 'application/msword', signature: 'ole', inline: false },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signature: 'zip',
    inline: false,
  },
  xls: { mime: 'application/vnd.ms-excel', signature: 'ole', inline: false },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    signature: 'zip',
    inline: false,
  },
  jpg: { mime: 'image/jpeg', signature: 'jpeg', inline: true },
  jpeg: { mime: 'image/jpeg', signature: 'jpeg', inline: true },
  png: { mime: 'image/png', signature: 'png', inline: true },
};

/** Для поля выбора файла в браузере. */
export const FILE_ACCEPT = Object.keys(ALLOWED_FILE_TYPES)
  .map((extension) => `.${extension}`)
  .join(',');

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}
