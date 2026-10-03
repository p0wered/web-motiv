import type { UserDetail } from '@webmotiv/shared';
import { Save } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useParams } from 'react-router';
import { isApiError } from '../../api/client.ts';
import {
  useResetPassword,
  useTerminateUserSessions,
  useUpdateUser,
  useUser,
} from '../../api/users.ts';
import { useCurrentUser } from '../../app/session.tsx';
import { Button } from '../../components/button.tsx';
import { ConfirmDialog } from '../../components/dialog.tsx';
import { TextInput } from '../../components/input.tsx';
import { Page } from '../../components/page.tsx';
import { SaveBar } from '../../components/save-bar.tsx';
import { SaveStatus, Section } from '../../components/section.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { Field } from '../../components/ui.tsx';
import { SessionList } from '../profile/session-list.tsx';
import { RoleChecklist } from './role-checklist.tsx';
import { TemporaryPasswordDialog } from './temporary-password-dialog.tsx';
import { UserStatus } from './user-status.tsx';

const barError = (error: Error | null) =>
  !error ? undefined : isApiError(error, 422) ? 'Проверьте выделенные поля.' : error.message;

function AccountSection({ user }: { user: UserDetail }) {
  const saved = { fullName: user.fullName, login: user.login };
  const [form, setForm] = useState(saved);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const update = useUpdateUser(user.id);
  const errors = isApiError(update.error, 422) ? update.error.fields : {};
  const dirty = form.fullName !== saved.fullName || form.login !== saved.login;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (update.isPending) return;
    update.mutate(form, {
      onSuccess: (updated) => {
        // Сервер обрезает пробелы — поля должны совпасть с сохранённым.
        setForm({ fullName: updated.fullName, login: updated.login });
        setSavedAt(Date.now());
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Учётная запись"
        aside={<SaveStatus savedAt={savedAt} pending={update.isPending} />}
        bar={
          <SaveBar
            open={dirty}
            error={barError(update.error)}
            submitLabel="Сохранить"
            icon={Save}
            onReset={() => {
              update.reset();
              setForm(saved);
            }}
          />
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="ФИО" error={errors.fullName}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
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
    </form>
  );
}

const sameIds = (a: number[], b: number[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

function RolesSection({ user }: { user: UserDetail }) {
  const saved = user.roles.map((role) => role.id);
  const [roleIds, setRoleIds] = useState(saved);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const update = useUpdateUser(user.id);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (update.isPending) return;
    update.mutate(
      { roleIds },
      {
        onSuccess: (updated) => {
          setRoleIds(updated.roles.map((role) => role.id));
          setSavedAt(Date.now());
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Роли"
        description="Новые права действуют сразу, без повторного входа"
        aside={<SaveStatus savedAt={savedAt} pending={update.isPending} />}
        bar={
          <SaveBar
            open={!sameIds(roleIds, saved)}
            error={barError(update.error)}
            submitLabel="Сохранить"
            icon={Save}
            onReset={() => {
              update.reset();
              setRoleIds(saved);
            }}
          />
        }
      >
        <RoleChecklist value={roleIds} onChange={setRoleIds} />
      </Section>
    </form>
  );
}

function ActionRow({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-[13px] text-subtle">{text}</p>
      </div>
      {action}
    </div>
  );
}

function AccessSection({ user }: { user: UserDetail }) {
  const reset = useResetPassword(user.id);
  const update = useUpdateUser(user.id);
  const [confirm, setConfirm] = useState<'reset' | 'block' | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  return (
    <Section title="Доступ">
      <div className="flex flex-col gap-5">
        <ActionRow
          title="Временный пароль"
          text="Если сотрудник забыл пароль. Прежний перестанет работать, все сеансы завершатся."
          action={<Button onClick={() => setConfirm('reset')}>Выдать временный пароль</Button>}
        />
        <ActionRow
          title={user.isActive ? 'Блокировка' : 'Учётная запись заблокирована'}
          text={
            user.isActive
              ? 'Заблокированный сотрудник не может войти, его сеансы завершаются. Заказы и история остаются.'
              : 'Сотрудник не может войти. После разблокировки он войдёт со своим прежним паролем.'
          }
          action={
            user.isActive ? (
              <Button onClick={() => setConfirm('block')}>Заблокировать</Button>
            ) : (
              <Button disabled={update.isPending} onClick={() => update.mutate({ isActive: true })}>
                Разблокировать
              </Button>
            )
          }
        />
      </div>

      <ConfirmDialog
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: (result) => {
              setConfirm(null);
              setPassword(result.temporaryPassword);
            },
          })
        }
        title={`Выдать временный пароль — ${user.fullName}?`}
        description="Текущий пароль сотрудника перестанет работать, все его сеансы завершатся."
        confirmLabel="Выдать пароль"
        pending={reset.isPending}
        error={reset.error?.message}
      />
      <ConfirmDialog
        open={confirm === 'block'}
        onClose={() => setConfirm(null)}
        onConfirm={() => update.mutate({ isActive: false }, { onSuccess: () => setConfirm(null) })}
        title={`Заблокировать — ${user.fullName}?`}
        description="Сотрудник сразу потеряет доступ: его сеансы завершатся, войти снова он не сможет, пока вы его не разблокируете."
        confirmLabel="Заблокировать"
        tone="danger"
        pending={update.isPending}
        error={update.error?.message}
      />
      <TemporaryPasswordDialog
        open={password !== null}
        onClose={() => setPassword(null)}
        title="Новый временный пароль"
        login={user.login}
        password={password}
      />
    </Section>
  );
}

function SessionsSection({ user }: { user: UserDetail }) {
  const terminate = useTerminateUserSessions(user.id);
  const [confirm, setConfirm] = useState(false);
  return (
    <Section
      title="Сеансы"
      description="Где сейчас выполнен вход в учётную запись сотрудника"
      aside={
        user.sessions.length > 0 && (
          <Button variant="ghost" onClick={() => setConfirm(true)}>
            Завершить все
          </Button>
        )
      }
    >
      <SessionList sessions={user.sessions} empty="Активных сеансов нет." />
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => terminate.mutate(undefined, { onSuccess: () => setConfirm(false) })}
        title="Завершить все сеансы сотрудника?"
        description="Сотруднику нужно будет войти заново на всех устройствах. Пароль не меняется."
        confirmLabel="Завершить"
        pending={terminate.isPending}
        error={terminate.error?.message}
      />
    </Section>
  );
}

export function UserPage() {
  const id = Number(useParams().id);
  const me = useCurrentUser();
  const user = useUser(id);
  const self = me.id === id;

  return (
    <Page
      title={user.data?.fullName ?? 'Сотрудник'}
      description={
        user.data && (
          <span className="flex items-center gap-2">
            {user.data.login}
            <UserStatus user={user.data} />
          </span>
        )
      }
      width="narrow"
      back={{ to: '/users', label: 'Сотрудники' }}
    >
      {user.isPending && <Loading />}
      {user.isError && <LoadError error={user.error} onRetry={() => void user.refetch()} />}
      {user.data && (
        <div className="flex flex-col gap-8">
          <AccountSection user={user.data} />
          <RolesSection user={user.data} />
          {self ? (
            <p className="px-1 text-[13px] text-subtle">
              Это ваша учётная запись: пароль и сеансы — в профиле, заблокировать себя нельзя.
            </p>
          ) : (
            <>
              <AccessSection user={user.data} />
              <SessionsSection user={user.data} />
            </>
          )}
        </div>
      )}
    </Page>
  );
}
