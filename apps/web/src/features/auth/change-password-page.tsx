import { KeyRound } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useChangePassword, useLogout } from '../../api/auth.ts';
import { isApiError } from '../../api/client.ts';
import { useCurrentUser } from '../../app/session.tsx';
import { Button } from '../../components/button.tsx';
import { CARD, cx, Notice } from '../../components/ui.tsx';
import { NewPasswordFields, newPasswordReady } from './new-password-fields.tsx';

/** Первый вход с временным паролем: пока сотрудник не задаст свой, дальше не пустит. */
export function ChangePasswordPage() {
  const me = useCurrentUser();
  const change = useChangePassword();
  const logout = useLogout();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirmation: '' });
  const errors = isApiError(change.error, 422) ? change.error.fields : {};
  const notice = change.error && !isApiError(change.error, 422) ? change.error.message : null;

  useEffect(() => {
    document.title = 'Новый пароль — WebMotiv';
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (change.isPending) return;
    change.mutate(form, { onSuccess: () => navigate('/', { replace: true }) });
  };

  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-[12vh]">
        <div className="flex max-w-95 flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-3">
            <KeyRound aria-hidden className="text-accent" />
            <h1 className="text-lg font-semibold">Задайте свой пароль</h1>
          </div>
          <p className="text-[13px] text-subtle">
            {me.fullName}, вы вошли с временным паролем. Придумайте свой — его будете знать только
            вы.
          </p>
        </div>

        <form
          onSubmit={submit}
          className={cx(CARD, 'flex w-full max-w-95 flex-col gap-4 p-5')}
          noValidate
        >
          <input type="text" autoComplete="username" value={me.login} readOnly hidden />
          <NewPasswordFields
            password={form.password}
            confirmation={form.confirmation}
            login={me.login}
            onPasswordChange={(password) => setForm({ ...form, password })}
            onConfirmationChange={(confirmation) => setForm({ ...form, confirmation })}
            errors={errors}
          />
          {notice && <Notice tone="error">{notice}</Notice>}
          <Button
            type="submit"
            variant="primary"
            className="h-10"
            disabled={
              change.isPending || !newPasswordReady(form.password, form.confirmation, me.login)
            }
          >
            {change.isPending ? 'Сохранение…' : 'Сохранить и продолжить'}
          </Button>
        </form>
        <Button
          variant="ghost"
          onClick={() =>
            logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
          }
        >
          Выйти
        </Button>
      </main>
    </div>
  );
}
