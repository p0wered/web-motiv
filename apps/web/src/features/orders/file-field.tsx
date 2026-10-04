import { FILE_ACCEPT, type OrderFile, type StageField } from '@webmotiv/shared';
import { Download, FileText, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { fileUrl, useDeleteFile, useUploadFile } from '../../api/orders.ts';
import { Button, buttonClasses } from '../../components/button.tsx';
import { cx, Notice } from '../../components/ui.tsx';
import { formatDateTime, formatFileSize } from '../../lib/format.ts';

interface FileFieldProps {
  orderId: number;
  stageId: number;
  field: Extract<StageField, { type: 'file' }>;
  files: OrderFile[];
  editable: boolean;
  onPreview: (file: OrderFile) => void;
  error?: string | undefined;
  /** Подпись рисует родитель (строка «название — значение» при просмотре этапа). */
  hideLabel?: boolean;
}

/**
 * Поле с документами: файлы прикрепляются сразу при выборе (черновик этапа сохранять не нужно),
 * открываются в просмотре, скачиваются; удалить можно, пока этап открыт.
 */
export function FileField({
  orderId,
  stageId,
  field,
  files,
  editable,
  onPreview,
  error,
  hideLabel = false,
}: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadFile(orderId, stageId, field.id);
  const remove = useDeleteFile();
  const [uploading, setUploading] = useState(false);
  const canAdd = editable && (field.multiple || files.length === 0);

  const onSelect = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    try {
      // По одному: у каждого — своя проверка на сервере и своя ошибка.
      for (const file of Array.from(list)) await upload.mutateAsync(file).catch(() => undefined);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {!hideLabel && (
        <p className={cx('px-1 text-[13px]', error ? 'text-danger' : 'text-subtle')}>
          {field.required ? `${field.label} *` : field.label}
          {field.hint && <span className="text-subtle"> · {field.hint}</span>}
        </p>
      )}
      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-lg bg-sunken py-1 pr-1 pl-2.5"
            >
              <FileText aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-subtle" />
              <button
                type="button"
                onClick={() => onPreview(file)}
                className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-fg hover:text-accent"
                title={`${file.name} — ${file.uploadedBy?.fullName ?? ''}, ${formatDateTime(file.uploadedAt)}`}
              >
                {file.name}
              </button>
              <span className="tabular shrink-0 text-xs text-subtle">
                {formatFileSize(file.size)}
              </span>
              <a
                href={fileUrl(file.id)}
                download
                aria-label={`Скачать «${file.name}»`}
                title="Скачать"
                className={buttonClasses({ variant: 'ghost', square: true })}
              >
                <Download aria-hidden size={15} strokeWidth={1.75} />
              </a>
              {editable && (
                <Button
                  variant="danger-ghost"
                  icon={Trash2}
                  aria-label={`Удалить «${file.name}»`}
                  title="Удалить"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(file.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {files.length === 0 && !editable && <p className="text-sm text-subtle">—</p>}
      {canAdd && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={FILE_ACCEPT}
            multiple={field.multiple}
            onChange={(event) => void onSelect(event.target.files)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
          <Button
            variant="ghost"
            icon={uploading ? Loader2 : Paperclip}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className={cx(uploading && '[&_svg]:animate-spin')}
          >
            {uploading ? 'Загрузка…' : 'Прикрепить файл'}
          </Button>
        </div>
      )}
      {upload.isError && <Notice tone="error">{upload.error.message}</Notice>}
      {remove.isError && <Notice tone="error">{remove.error.message}</Notice>}
      {error && <p className="px-1 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
