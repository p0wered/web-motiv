import type { MeResponse, Permission } from '@webmotiv/shared';
import { Loader2 } from 'lucide-react';
import { createContext, type ReactNode, useContext } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useMe } from '../api/auth.ts';
import { Button } from '../components/button.tsx';
import { Page } from '../components/page.tsx';
import { CARD, cx, Notice } from '../components/ui.tsx';

// Сотрудник передаётся вниз контекстом от RequireSession, а не читается из кэша в каждом
// компоненте: после выхода кэш очищается раньше, чем RequireSession уводит на вход, и страница
// на мгновение осталась бы без сотрудника.
const CurrentUserContext = createContext<MeResponse | null>(null);

/** Вошедший сотрудник — только внутри RequireSession. */
export function useCurrentUser(): MeResponse {
  const me = useContext(CurrentUserContext);
  if (!me) throw new Error('useCurrentUser вне RequireSession');
  return me;
}

/** Есть ли у вошедшего хотя бы одно из прав. */
export function useCan(...permissions: Permission[]): boolean {
  const me = useContext(CurrentUserContext);
  return Boolean(me && permissions.some((permission) => me.permissions.includes(permission)));
}

function FullPageLoader() {
  return (
    <div className="flex h-full items-center justify-center text-subtle" aria-busy>
      <Loader2 aria-label="Загрузка" size={20} className="animate-spin" />
    </div>
  );
}

/**
 * Страницы только для вошедших: иначе — на вход, с возвратом туда, куда шли. Пока временный
 * пароль не сменён — только страница смены пароля (сервер всё равно не пустит дальше).
 */
export function RequireSession({ passwordChange = false }: { passwordChange?: boolean }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <FullPageLoader />;
  if (me.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-4">
        <Notice tone="error">{me.error.message}</Notice>
        <Button onClick={() => void me.refetch()}>Повторить</Button>
      </div>
    );
  }
  if (!me.data) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }
  if (me.data.mustChangePassword && !passwordChange) {
    return <Navigate to="/change-password" replace />;
  }
  if (!me.data.mustChangePassword && passwordChange) return <Navigate to="/" replace />;
  return (
    <CurrentUserContext value={me.data}>
      <Outlet />
    </CurrentUserContext>
  );
}

/** Раздел только для сотрудников с правом; остальным — объяснение вместо пустой страницы. */
export function RequirePermission({
  permissions,
  children,
}: {
  permissions: Permission[];
  children: ReactNode;
}) {
  const can = useCan(...permissions);
  if (can) return children;
  return (
    <Page title="Нет доступа">
      <div className={cx(CARD, 'px-6 py-14 text-center text-[13px] text-subtle')}>
        У вашей роли нет прав на этот раздел. Если они нужны — обратитесь к администратору.
      </div>
    </Page>
  );
}
