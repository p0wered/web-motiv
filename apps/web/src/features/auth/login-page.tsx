import { LogIn } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useLogin, useMe } from '../../api/auth.ts';
import { isApiError } from '../../api/client.ts';
import { Button } from '../../components/button.tsx';
import { TextInput } from '../../components/input.tsx';
import { PasswordInput } from '../../components/password-input.tsx';
import { CARD, cx, Field, Notice } from '../../components/ui.tsx';

export function LoginPage() {
  const me = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ login: '', password: '' });
  const next = (location.state as { from?: string } | null)?.from ?? '/';

  useEffect(() => {
    document.title = 'Вход — WebMotiv';
  }, []);

  if (me.data)
    return <Navigate to={me.data.mustChangePassword ? '/change-password' : next} replace />;

  // Неверный логин или пароль — под полем пароля; пауза после попыток и блокировка — общим текстом.
  const passwordError = isApiError(login.error, 422) ? login.error.message : undefined;
  const notice = login.error && !passwordError ? login.error.message : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (login.isPending) return;
    login.mutate(form, {
      onSuccess: (user) =>
        navigate(user.mustChangePassword ? '/change-password' : next, { replace: true }),
      onError: () => setForm((current) => ({ ...current, password: '' })),
    });
  };

  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-[16vh]">
        <div className="flex items-center gap-3">
          <LogIn aria-hidden className="text-accent" />
          <h1 className="text-lg font-semibold">Вход в WebMotiv</h1>
        </div>

        <form
          onSubmit={submit}
          className={cx(CARD, 'flex w-full max-w-95 flex-col gap-4 p-5')}
          noValidate
        >
          <Field label="Логин">
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                value={form.login}
                onChange={(event) => setForm({ ...form, login: event.target.value })}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
          <Field label="Пароль" error={passwordError}>
            {({ id, describedBy, invalid }) => (
              <PasswordInput
                id={id}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                autoComplete="current-password"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
          {notice && <Notice tone="error">{notice}</Notice>}
          <Button
            type="submit"
            variant="primary"
            className="h-10"
            disabled={login.isPending || !form.login || !form.password}
          >
            {login.isPending ? 'Вход…' : 'Войти'}
          </Button>
        </form>
        <p className="max-w-95 text-center text-[13px] text-subtle">
          Забыли пароль — обратитесь к администратору, он выдаст временный.
        </p>
      </main>
    </div>
  );
}
