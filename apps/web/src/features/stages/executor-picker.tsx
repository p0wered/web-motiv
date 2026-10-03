import type { StageExecutor } from '@webmotiv/shared';
import { useRoles } from '../../api/roles.ts';
import { Radio } from '../../components/radio.tsx';
import { Select } from '../../components/select.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { Field } from '../../components/ui.tsx';

export interface ExecutorValue {
  executor: StageExecutor;
  executorRoleId: number | null;
}

interface ExecutorPickerProps {
  value: ExecutorValue;
  onChange: (value: ExecutorValue) => void;
  error?: string | undefined;
  name: string;
}

/** Кто заполняет этап (PLAN.md §3.3): ответственный по заказу или сотрудник с ролью. */
export function ExecutorPicker({ value, onChange, error, name }: ExecutorPickerProps) {
  const roles = useRoles();
  const roleOptions = (roles.data ?? []).map((role) => ({
    value: String(role.id),
    label: role.name,
  }));

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Исполнитель" className="-m-1.5 flex flex-col">
        <Radio
          name={name}
          checked={value.executor === 'responsible'}
          onSelect={() => onChange({ executor: 'responsible', executorRoleId: null })}
          label="Ответственный по заказу"
          description="Тот, кто ведёт заказ, — обычно первый и последний этапы"
        />
        <Radio
          name={name}
          checked={value.executor === 'role'}
          onSelect={() =>
            onChange({
              executor: 'role',
              executorRoleId: value.executorRoleId ?? roles.data?.[0]?.id ?? null,
            })
          }
          label="Сотрудник с ролью"
          description="Любой сотрудник с выбранной ролью"
        />
      </div>
      {value.executor === 'role' && (
        <div className="pl-7">
          {roles.isPending && <Loading />}
          {roles.isError && <LoadError error={roles.error} onRetry={() => void roles.refetch()} />}
          {roles.data && (
            <Field label="Роль" error={error}>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  value={value.executorRoleId === null ? '' : String(value.executorRoleId)}
                  options={roleOptions}
                  onChange={(roleId) =>
                    onChange({ executor: 'role', executorRoleId: Number(roleId) })
                  }
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                />
              )}
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

/** Подпись исполнителя для списков. */
export function executorLabel(stage: {
  executor: StageExecutor;
  executorRole: { name: string } | null;
}): string {
  return stage.executor === 'responsible'
    ? 'Ответственный'
    : (stage.executorRole?.name ?? 'Роль удалена');
}
