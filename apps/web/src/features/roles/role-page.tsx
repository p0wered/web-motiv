import { type Permission, plural, type Role } from '@webmotiv/shared';
import { Plus, Save } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { isApiError } from '../../api/client.ts';
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole } from '../../api/roles.ts';
import { Button } from '../../components/button.tsx';
import { ConfirmDialog } from '../../components/dialog.tsx';
import { TextInput } from '../../components/input.tsx';
import { Page } from '../../components/page.tsx';
import { SaveBar } from '../../components/save-bar.tsx';
import { SaveStatus, Section } from '../../components/section.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { Field, Notice } from '../../components/ui.tsx';
import { PermissionChecklist, samePermissions } from './permission-checklist.tsx';

const BACK = { to: '/roles', label: 'Роли' };

const barError = (error: Error | null) =>
  !error ? undefined : isApiError(error, 422) ? 'Проверьте выделенные поля.' : error.message;

function NameField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string | undefined;
}) {
  return (
    <Field label="Название" error={error}>
      {({ id, describedBy, invalid }) => (
        <TextInput
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={invalid}
        />
      )}
    </Field>
  );
}

export function RoleNewPage() {
  const navigate = useNavigate();
  const create = useCreateRole();
  const [form, setForm] = useState({ name: '', permissions: [] as Permission[] });
  const errors = isApiError(create.error, 422) ? create.error.fields : {};

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (create.isPending) return;
    create.mutate(form, { onSuccess: () => navigate('/roles', { replace: true }) });
  };

  return (
    <Page title="Новая роль" width="narrow" back={BACK}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        <Section title="Роль">
          <NameField
            value={form.name}
            onChange={(name) => setForm({ ...form, name })}
            error={errors.name}
          />
        </Section>
        <Section
          title="Права"
          description="Без прав сотрудник с этой ролью только заполняет свои этапы заказов"
          bar={
            <SaveBar
              open
              error={barError(create.error)}
              submitLabel="Создать роль"
              message="Права можно поменять в любой момент"
              icon={Plus}
              onReset={() => navigate('/roles')}
            />
          }
        >
          <PermissionChecklist
            value={form.permissions}
            onChange={(permissions) => setForm({ ...form, permissions })}
          />
        </Section>
      </form>
    </Page>
  );
}

function NameSection({ role }: { role: Role }) {
  const [name, setName] = useState(role.name);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const update = useUpdateRole(role.id);
  const errors = isApiError(update.error, 422) ? update.error.fields : {};

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (update.isPending) return;
    update.mutate(
      { name },
      {
        onSuccess: (updated) => {
          setName(updated.name);
          setSavedAt(Date.now());
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Роль"
        aside={<SaveStatus savedAt={savedAt} pending={update.isPending} />}
        bar={
          <SaveBar
            open={name !== role.name}
            error={barError(update.error)}
            submitLabel="Сохранить"
            icon={Save}
            onReset={() => {
              update.reset();
              setName(role.name);
            }}
          />
        }
      >
        <NameField value={name} onChange={setName} error={errors.name} />
      </Section>
    </form>
  );
}

function PermissionsSection({ role }: { role: Role }) {
  const [permissions, setPermissions] = useState(role.permissions);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const update = useUpdateRole(role.id);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (update.isPending) return;
    update.mutate(
      { permissions },
      {
        onSuccess: (updated) => {
          setPermissions(updated.permissions);
          setSavedAt(Date.now());
        },
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <Section
        title="Права"
        description={
          role.userCount > 0
            ? `Изменения сразу коснутся ${role.userCount} ${plural(role.userCount, ['сотрудника', 'сотрудников', 'сотрудников'])} с этой ролью`
            : 'Ролью пока никто не пользуется'
        }
        aside={<SaveStatus savedAt={savedAt} pending={update.isPending} />}
        bar={
          <SaveBar
            open={!samePermissions(permissions, role.permissions)}
            error={barError(update.error)}
            submitLabel="Сохранить"
            icon={Save}
            onReset={() => {
              update.reset();
              setPermissions(role.permissions);
            }}
          />
        }
      >
        <PermissionChecklist value={permissions} onChange={setPermissions} />
      </Section>
    </form>
  );
}

function DeleteSection({ role }: { role: Role }) {
  const navigate = useNavigate();
  const remove = useDeleteRole(role.id);
  const [confirm, setConfirm] = useState(false);
  const blocked = role.stageCount > 0;

  return (
    <Section title="Удаление">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="min-w-0 flex-1 basis-64 text-[13px] text-subtle">
          {blocked
            ? 'Роль — исполнитель этапов. Чтобы удалить её, сначала назначьте этим этапам другого исполнителя.'
            : role.userCount > 0
              ? 'Сотрудники с этой ролью потеряют её права. Сами сотрудники останутся.'
              : 'Роль ни у кого не назначена.'}
        </p>
        <Button disabled={blocked} onClick={() => setConfirm(true)}>
          Удалить роль
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          remove.mutate(undefined, { onSuccess: () => navigate('/roles', { replace: true }) })
        }
        title={`Удалить роль «${role.name}»?`}
        description={
          role.userCount > 0
            ? `Её потеряют ${role.userCount} ${plural(role.userCount, ['сотрудник', 'сотрудника', 'сотрудников'])}. Отменить удаление нельзя.`
            : 'Отменить удаление нельзя.'
        }
        confirmLabel="Удалить"
        tone="danger"
        pending={remove.isPending}
        error={remove.error?.message}
      />
    </Section>
  );
}

export function RolePage() {
  const id = Number(useParams().id);
  const roles = useRoles();
  const role = roles.data?.find((item) => item.id === id);

  return (
    <Page title={role?.name ?? 'Роль'} width="narrow" back={BACK}>
      {roles.isPending && <Loading />}
      {roles.isError && <LoadError error={roles.error} onRetry={() => void roles.refetch()} />}
      {roles.data && !role && <Notice tone="error">Роль не найдена — возможно, её удалили.</Notice>}
      {role && (
        <div className="flex flex-col gap-8">
          <NameSection role={role} />
          <PermissionsSection role={role} />
          <DeleteSection role={role} />
        </div>
      )}
    </Page>
  );
}
