import { fileExtension, type OrderFile } from '@webmotiv/shared';
import { Download } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { fileUrl } from '../../api/orders.ts';
import { Button, buttonClasses } from '../../components/button.tsx';
import { Dialog } from '../../components/dialog.tsx';
import { Loading } from '../../components/status.tsx';
import { formatFileSize } from '../../lib/format.ts';

const DocxView = lazy(() =>
  import('./docx-view.tsx').then((module) => ({ default: module.DocxView })),
);

type PreviewKind = 'pdf' | 'image' | 'docx' | null;

export function previewKind(file: OrderFile): PreviewKind {
  const extension = fileExtension(file.name);
  if (extension === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png'].includes(extension)) return 'image';
  if (extension === 'docx') return 'docx';
  return null;
}

/** Просмотр документа во весь экран; DOC и таблицы браузер не покажет — их только скачать. */
export function FilePreview({ file, onClose }: { file: OrderFile | null; onClose: () => void }) {
  const kind = file ? previewKind(file) : null;
  return (
    <Dialog
      open={file !== null}
      onClose={onClose}
      size="lg"
      title={file?.name ?? ''}
      description={file ? formatFileSize(file.size) : undefined}
      actions={
        <>
          {file && (
            <a href={fileUrl(file.id)} download className={buttonClasses({ className: 'mr-auto' })}>
              <Download aria-hidden size={15} strokeWidth={1.75} />
              Скачать
            </a>
          )}
          <Button variant="primary" onClick={onClose}>
            Закрыть
          </Button>
        </>
      }
    >
      <div className="min-h-0 flex-1">
        {file && kind === 'pdf' && (
          <iframe
            title={file.name}
            src={fileUrl(file.id, true)}
            className="h-full w-full rounded-xl border border-line bg-sunken"
          />
        )}
        {file && kind === 'image' && (
          <div className="grid h-full place-items-center overflow-auto rounded-xl bg-sunken p-4">
            <img
              src={fileUrl(file.id, true)}
              alt={file.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}
        {file && kind === 'docx' && (
          <Suspense fallback={<Loading label="Открываем документ…" />}>
            <DocxView url={fileUrl(file.id, true)} />
          </Suspense>
        )}
        {file && kind === null && (
          <div className="grid h-full place-items-center rounded-xl bg-sunken p-6 text-center text-[13px] text-subtle">
            Этот формат браузер не показывает — скачайте файл.
          </div>
        )}
      </div>
    </Dialog>
  );
}
