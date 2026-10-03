import { useRoles } from '../../api/roles.ts';
import { useCurrentUser } from '../../app/session.tsx';
import { Checkbox } from '../../components/checkbox.tsx';
import { LoadError, Loading } from '../../components/status.tsx';
import { permissionsSummary } from '../roles/permission-text.ts';

interface RoleChecklistProps {
  value: number[];
  onChange: (roleIds: number[]) => void;
}

/**
 * Роли сотрудника флажками; под каждой — что она даёт. Роль с правами, которых нет у вас самих,
 * назначить или снять нельзя (сервер тоже не даст) — такой флажок неактивен.
 */
export function RoleChecklist({ value, onChange }: RoleChecklistProps) {
  const me = useCurrentUser();
  const roles = useRoles();
  if (roles.isPending) return <Loading />;
  if (roles.isError) return <LoadError error={roles.error} onRetry={() => void roles.refetch()} />;
  if (roles.data.length === 0) {
    return (
      <p className="px-1 text-[13px] text-subtle">Ролей нет — создайте их в разделе «Роли».</p>
    );
  }
  return (
    <div className="-m-1.5 flex flex-col">
      {roles.data.map((role) => {
        const grantable = role.permissions.every((permission) =>
          me.permissions.includes(permission),
        );
        return (
          <Checkbox
            key={role.id}
            checked={value.includes(role.id)}
            disabled={!grantable}
            onChange={(checked) =>
              onChange(checked ? [...value, role.id] : value.filter((id) => id !== role.id))
            }
            label={role.name}
            description={
              grantable
                ? permissionsSummary(role.permissions)
                : `${permissionsSummary(role.permissions)}. Назначать её может только тот, у кого есть все эти права.`
            }
          />
        );
      })}
    </div>
  );
}
