import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/button.tsx';
import { Dialog } from '../../components/dialog.tsx';

interface TemporaryPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  password: string | null;
  login: string;
}

/** Временный пароль показывается один раз — здесь; дальше его нигде не увидеть. */
export function TemporaryPasswordDialog({
  open,
  onClose,
  title,
  password,
  login,
}: TemporaryPasswordDialogProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Буфер обмена недоступен (страница не по HTTPS) — пароль можно выделить вручную.
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={
        <>
          Передайте логин и пароль сотруднику лично или по телефону. При первом входе он задаст свой
          пароль.{' '}
          <strong className="font-medium text-fg">
            Больше этот пароль нигде не будет показан.
          </strong>
        </>
      }
      actions={
        <Button variant="primary" onClick={onClose}>
          Готово
        </Button>
      }
    >
      <div className="flex flex-col gap-2 rounded-xl bg-sunken p-3">
        <div className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="text-subtle">Логин</span>
          <span className="font-mono text-fg select-all">{login}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] text-subtle">Пароль</span>
          <span className="flex items-center gap-1">
            <span className="font-mono text-[15px] tracking-wide text-fg select-all">
              {password}
            </span>
            <Button
              variant="ghost"
              icon={copied ? Check : Copy}
              aria-label={copied ? 'Скопировано' : 'Скопировать пароль'}
              title={copied ? 'Скопировано' : 'Скопировать пароль'}
              onClick={() => void copy()}
            />
          </span>
        </div>
      </div>
    </Dialog>
  );
}
