import { type Permission, PERMISSION_LABELS, PERMISSIONS } from '@webmotiv/shared';
import { useCurrentUser } from '../../app/session.tsx';
import { Checkbox } from '../../components/checkbox.tsx';
import { PERMISSION_DESCRIPTIONS } from './permission-text.ts';

interface PermissionChecklistProps {
  value: Permission[];
  onChange: (permissions: Permission[]) => void;
}

/** Права роли флажками. Право, которого нет у вас самих, ни добавить, ни убрать нельзя. */
export function PermissionChecklist({ value, onChange }: PermissionChecklistProps) {
  const me = useCurrentUser();
  return (
    <div className="-m-1.5 flex flex-col">
      {PERMISSIONS.map((permission) => (
        <Checkbox
          key={permission}
          checked={value.includes(permission)}
          onChange={(checked) =>
            onChange(checked ? [...value, permission] : value.filter((item) => item !== permission))
          }
          disabled={!me.permissions.includes(permission)}
          label={PERMISSION_LABELS[permission]}
          description={
            me.permissions.includes(permission)
              ? PERMISSION_DESCRIPTIONS[permission]
              : `${PERMISSION_DESCRIPTIONS[permission]} У вас этого права нет — выдать его нельзя.`
          }
        />
      ))}
    </div>
  );
}

export const samePermissions = (a: Permission[], b: Permission[]) =>
  a.length === b.length && a.every((permission) => b.includes(permission));
