import { type AuditEvent, type Permission, PERMISSION_LABELS, plural } from '@webmotiv/shared';

type Payload = Record<string, unknown>;

const str = (value: unknown) => (typeof value === 'string' ? value : '');
const list = (value: unknown) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
const names = (value: unknown) => list(value).join(', ') || 'без ролей';
const permissionNames = (value: unknown) =>
  list(value)
    .map((permission) => PERMISSION_LABELS[permission as Permission] ?? permission)
    .join(', ');

const LOGIN_FAILURE: Record<string, string> = {
  wrong_password: 'неверный пароль',
  unknown_login: 'неизвестный логин',
  blocked: 'учётная запись заблокирована',
};

function userChanges(changes: Payload): string {
  const parts: string[] = [];
  const change = (key: string) => (changes[key] ?? {}) as { from?: unknown; to?: unknown };
  if (changes.fullName)
    parts.push(`ФИО «${str(change('fullName').from)}» → «${str(change('fullName').to)}»`);
  if (changes.login) parts.push(`логин ${str(change('login').from)} → ${str(change('login').to)}`);
  if (changes.roles)
    parts.push(`роли: ${names(change('roles').from)} → ${names(change('roles').to)}`);
  if (changes.isActive) parts.push(change('isActive').to ? 'разблокирован' : 'заблокирован');
  return parts.join('; ');
}

function roleChanges(changes: Payload): string {
  const parts: string[] = [];
  const name = (changes.name ?? null) as { from?: unknown; to?: unknown } | null;
  if (name) parts.push(`название «${str(name.from)}» → «${str(name.to)}»`);
  const permissions = (changes.permissions ?? null) as Payload | null;
  if (permissions) {
    const added = permissionNames(permissions.added);
    const removed = permissionNames(permissions.removed);
    if (added) parts.push(`добавлены права: ${added}`);
    if (removed) parts.push(`убраны права: ${removed}`);
  }
  return parts.join('; ');
}

/** Что произошло — одной строкой для журнала. */
export function describeEvent(event: AuditEvent): string {
  const payload = event.payload ?? {};
  const login = str(payload.login);
  switch (event.action) {
    case 'auth.login_succeeded':
      return 'Вход в систему';
    case 'auth.login_failed':
      return `Неудачный вход: ${LOGIN_FAILURE[str(payload.reason)] ?? 'ошибка'}`;
    case 'auth.logout':
      return 'Выход из системы';
    case 'auth.password_changed':
      return 'Смена своего пароля';
    case 'auth.sessions_terminated': {
      const count = Number(payload.count ?? 0);
      return `Завершение своих сеансов: ${count}`;
    }
    case 'user.created':
      return `Создан сотрудник ${str(payload.fullName)} (${login}), роли: ${names(payload.roles)}`;
    case 'user.updated':
      return `Изменён сотрудник ${login}: ${userChanges((payload.changes ?? {}) as Payload)}`;
    case 'user.password_reset':
      return `Выдан временный пароль сотруднику ${login}`;
    case 'user.sessions_terminated': {
      const count = Number(payload.count ?? 0);
      return `Завершены сеансы сотрудника ${login}: ${count} ${plural(count, ['сеанс', 'сеанса', 'сеансов'])}`;
    }
    case 'role.created':
      return `Создана роль «${str(payload.name)}»`;
    case 'role.updated':
      return `Изменена роль «${str(payload.name)}»: ${roleChanges((payload.changes ?? {}) as Payload)}`;
    case 'role.deleted':
      return `Удалена роль «${str(payload.name)}»`;
  }
}

/** Кто: сотрудник, «Неизвестный» при неудачном входе или сервер (настройка, командная строка). */
export function describeActor(event: AuditEvent): string {
  if (event.actor) return event.actor.fullName;
  if (event.action === 'auth.login_failed') return 'Неизвестный';
  return 'Сервер';
}

/** Важное для безопасности — выделяется в списке. */
export const isWarning = (event: AuditEvent) => event.action === 'auth.login_failed';
