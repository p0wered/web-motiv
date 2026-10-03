// Права — фиксированный список; роли — наборы прав, настраиваются в интерфейсе (PLAN.md §5).

export const PERMISSIONS = [
  'orders.create',
  'orders.view_all',
  'orders.manage',
  'templates.manage',
  'users.manage',
  'roles.manage',
  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'orders.create': 'Создавать заказы',
  'orders.view_all': 'Видеть все заказы',
  'orders.manage': 'Отменять заказы и менять ответственного',
  'templates.manage': 'Настраивать этапы и шаблоны',
  'users.manage': 'Управлять сотрудниками',
  'roles.manage': 'Управлять ролями и правами',
  'audit.view': 'Смотреть журнал событий',
};
