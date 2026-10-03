import { type Permission, PERMISSION_LABELS, PERMISSIONS } from '@webmotiv/shared';

/** Что право даёт на деле — под его названием в редакторе роли. */
export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  'orders.create': 'Новые заказы по шаблонам; создатель становится ответственным.',
  'orders.view_all':
    'Без этого права видны только заказы, где сотрудник ответственный или исполнитель этапа.',
  'orders.manage': 'Отмена заказа и передача его другому ответственному.',
  'templates.manage': 'Библиотека этапов, их поля и исполнители, шаблоны-последовательности.',
  'users.manage': 'Создание и блокировка сотрудников, временные пароли, роли сотрудников.',
  'roles.manage': 'Создание ролей и выбор их прав.',
  'audit.view': 'Входы, изменения сотрудников и ролей, действия с заказами.',
};

/** Кратко для списков: «Создавать заказы, Видеть все заказы». */
export function permissionsSummary(permissions: readonly Permission[]): string {
  if (permissions.length === PERMISSIONS.length) return 'Все права';
  if (permissions.length === 0) return 'Только свои этапы';
  return PERMISSIONS.filter((permission) => permissions.includes(permission))
    .map((permission) => PERMISSION_LABELS[permission])
    .join(', ');
}
