import { LogIn } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '../../components/button.tsx';
import { TextInput } from '../../components/input.tsx';
import { PasswordInput } from '../../components/password-input.tsx';
import { CARD, cx, Field, Notice } from '../../components/ui.tsx';

export function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Вход — WebMotiv';
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setNotice('Вход подключается в фазе 1.');
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
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
          <Field label="Пароль">
            {({ id, describedBy, invalid }) => (
              <PasswordInput
                id={id}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
          {notice && <Notice tone="info">{notice}</Notice>}
          <Button type="submit" variant="primary" className="h-10" disabled={!login || !password}>
            Войти
          </Button>
        </form>
      </main>
    </div>
  );
}
