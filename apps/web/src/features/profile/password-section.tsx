import { SquarePen } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useChangePassword } from '../../api/auth.ts';
import { isApiError } from '../../api/client.ts';
import { PasswordInput } from '../../components/password-input.tsx';
import { SaveBar } from '../../components/save-bar.tsx';
import { SaveStatus, Section } from '../../components/section.tsx';
import { Field } from '../../components/ui.tsx';
import { NewPasswordFields } from '../auth/new-password-fields.tsx';

const EMPTY = { current: '', password: '', confirmation: '' };

export function PasswordSection({ login }: { login: string }) {
  const [form, setForm] = useState(EMPTY);
  const [changedAt, setChangedAt] = useState<number | null>(null);
  const change = useChangePassword();
  const errors = isApiError(change.error, 422) ? change.error.fields : {};
  const dirty = Object.values(form).some(Boolean);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // Кнопка не блокируется во время сохранения — повторное нажатие просто игнорируем.
    if (change.isPending) return;
    change.mutate(form, {
      onSuccess: () => {
        setForm(EMPTY);
        setChangedAt(Date.now());
      },
    });
  };

  const reset = () => {
    change.reset();
    setForm(EMPTY);
  };

  const barError = !change.isError
    ? undefined
    : isApiError(change.error, 422)
      ? 'Проверьте выделенные поля.'
      : change.error.message;

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Пароль"
        description="После смены остальные ваши сеансы завершатся"
        aside={<SaveStatus savedAt={changedAt} label="Пароль изменён" pending={change.isPending} />}
        bar={
          <SaveBar
            open={dirty}
            error={barError}
            submitLabel="Сменить пароль"
            icon={SquarePen}
            onReset={reset}
          />
        }
      >
        <div className="flex flex-col gap-4">
          {/* Логин помогает менеджерам паролей связать запись с сайтом. */}
          <input type="text" autoComplete="username" value={login} readOnly hidden />
          <Field label="Текущий пароль" error={errors.current}>
            {({ id, describedBy, invalid }) => (
              <PasswordInput
                id={id}
                value={form.current}
                onChange={(event) => setForm({ ...form, current: event.target.value })}
                autoComplete="current-password"
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
          <NewPasswordFields
            password={form.password}
            confirmation={form.confirmation}
            login={login}
            onPasswordChange={(password) => setForm({ ...form, password })}
            onConfirmationChange={(confirmation) => setForm({ ...form, confirmation })}
            errors={errors}
          />
        </div>
      </Section>
    </form>
  );
}
