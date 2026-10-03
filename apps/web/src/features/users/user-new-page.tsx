import { UserPlus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router';
import { isApiError } from '../../api/client.ts';
import { useCreateUser } from '../../api/users.ts';
import { TextInput } from '../../components/input.tsx';
import { Page } from '../../components/page.tsx';
import { SaveBar } from '../../components/save-bar.tsx';
import { Section } from '../../components/section.tsx';
import { Field } from '../../components/ui.tsx';
import { RoleChecklist } from './role-checklist.tsx';
import { TemporaryPasswordDialog } from './temporary-password-dialog.tsx';

export function UserNewPage() {
  const navigate = useNavigate();
  const create = useCreateUser();
  const [form, setForm] = useState({ fullName: '', login: '', roleIds: [] as number[] });
  const errors = isApiError(create.error, 422) ? create.error.fields : {};
  const created = create.data;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending) return;
    create.mutate(form);
  };

  const barError = !create.isError
    ? undefined
    : isApiError(create.error, 422)
      ? 'Проверьте выделенные поля.'
      : create.error.message;

  return (
    <Page
      title="Новый сотрудник"
      description="Сотрудник получит временный пароль и при первом входе задаст свой"
      width="narrow"
      back={{ to: '/users', label: 'Сотрудники' }}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        <Section title="Учётная запись">
          <div className="flex flex-col gap-4">
            <Field label="ФИО" error={errors.fullName}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  autoFocus
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </Field>
            <Field label="Логин" error={errors.login}>
              {({ id, describedBy, invalid }) => (
                <TextInput
                  id={id}
                  value={form.login}
                  onChange={(event) => setForm({ ...form, login: event.target.value })}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section
          title="Роли"
          description="Роль задаёт права и то, какие этапы заказов сотрудник заполняет"
          bar={
            <SaveBar
              open
              error={barError ?? errors.roleIds}
              submitLabel="Создать сотрудника"
              message="Пароль сгенерируется сам — вы увидите его после создания"
              icon={UserPlus}
              onReset={() => navigate('/users')}
            />
          }
        >
          <RoleChecklist
            value={form.roleIds}
            onChange={(roleIds) => setForm({ ...form, roleIds })}
          />
        </Section>
      </form>

      <TemporaryPasswordDialog
        open={Boolean(created)}
        onClose={() => created && navigate(`/users/${created.user.id}`, { replace: true })}
        title="Сотрудник создан"
        login={created?.user.login ?? ''}
        password={created?.temporaryPassword ?? null}
      />
    </Page>
  );
}
