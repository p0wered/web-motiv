import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AuditPage } from '../features/audit/audit-page.tsx';
import { ChangePasswordPage } from '../features/auth/change-password-page.tsx';
import { LoginPage } from '../features/auth/login-page.tsx';
import { OrderNewPage } from '../features/orders/order-new-page.tsx';
import { OrderPage } from '../features/orders/order-page.tsx';
import { OrdersPage } from '../features/orders/orders-page.tsx';
import { TasksPage } from '../features/orders/tasks-page.tsx';
import { ProfilePage } from '../features/profile/profile-page.tsx';
import { RoleNewPage, RolePage } from '../features/roles/role-page.tsx';
import { RolesPage } from '../features/roles/roles-page.tsx';
import { StageNewPage, StagePage } from '../features/stages/stage-page.tsx';
import { StagesPage } from '../features/stages/stages-page.tsx';
import { TemplateNewPage, TemplatePage } from '../features/templates/template-page.tsx';
import { TemplatesPage } from '../features/templates/templates-page.tsx';
import { UserNewPage } from '../features/users/user-new-page.tsx';
import { UserPage } from '../features/users/user-page.tsx';
import { UsersPage } from '../features/users/users-page.tsx';
import { AppShell } from './app-shell.tsx';
import { RequirePermission, RequireSession } from './session.tsx';

/** Список, новая запись и карточка — только с правом на этапы и шаблоны. */
function catalogRoute(path: string, list: ReactNode, create: ReactNode, card: ReactNode) {
  const guard = (element: ReactNode) => (
    <RequirePermission permissions={['templates.manage']}>{element}</RequirePermission>
  );
  return [
    { path, element: guard(list) },
    { path: `${path}/new`, element: guard(create) },
    { path: `${path}/:id`, element: guard(card) },
  ];
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireSession passwordChange />,
    children: [{ path: '/change-password', element: <ChangePasswordPage /> }],
  },
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Navigate to="/tasks" replace /> },
          { path: '/tasks', element: <TasksPage /> },
          { path: '/orders', element: <OrdersPage /> },
          {
            path: '/orders/new',
            element: (
              <RequirePermission permissions={['orders.create']}>
                <OrderNewPage />
              </RequirePermission>
            ),
          },
          { path: '/orders/:id', element: <OrderPage /> },
          ...catalogRoute('/templates', <TemplatesPage />, <TemplateNewPage />, <TemplatePage />),
          ...catalogRoute('/stages', <StagesPage />, <StageNewPage />, <StagePage />),
          { path: '/profile', element: <ProfilePage /> },
          {
            path: '/users',
            element: (
              <RequirePermission permissions={['users.manage']}>
                <UsersPage />
              </RequirePermission>
            ),
          },
          {
            path: '/users/new',
            element: (
              <RequirePermission permissions={['users.manage']}>
                <UserNewPage />
              </RequirePermission>
            ),
          },
          {
            path: '/users/:id',
            element: (
              <RequirePermission permissions={['users.manage']}>
                <UserPage />
              </RequirePermission>
            ),
          },
          {
            path: '/roles',
            element: (
              <RequirePermission permissions={['roles.manage']}>
                <RolesPage />
              </RequirePermission>
            ),
          },
          {
            path: '/roles/new',
            element: (
              <RequirePermission permissions={['roles.manage']}>
                <RoleNewPage />
              </RequirePermission>
            ),
          },
          {
            path: '/roles/:id',
            element: (
              <RequirePermission permissions={['roles.manage']}>
                <RolePage />
              </RequirePermission>
            ),
          },
          {
            path: '/audit',
            element: (
              <RequirePermission permissions={['audit.view']}>
                <AuditPage />
              </RequirePermission>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
