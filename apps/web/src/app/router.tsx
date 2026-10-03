import { ClipboardList, Inbox, ListChecks, Workflow } from 'lucide-react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AuditPage } from '../features/audit/audit-page.tsx';
import { ChangePasswordPage } from '../features/auth/change-password-page.tsx';
import { LoginPage } from '../features/auth/login-page.tsx';
import { PlaceholderPage } from '../features/placeholder/placeholder-page.tsx';
import { ProfilePage } from '../features/profile/profile-page.tsx';
import { RoleNewPage, RolePage } from '../features/roles/role-page.tsx';
import { RolesPage } from '../features/roles/roles-page.tsx';
import { UserNewPage } from '../features/users/user-new-page.tsx';
import { UserPage } from '../features/users/user-page.tsx';
import { UsersPage } from '../features/users/users-page.tsx';
import { AppShell } from './app-shell.tsx';
import { RequirePermission, RequireSession } from './session.tsx';

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
          {
            path: '/tasks',
            element: (
              <PlaceholderPage
                title="Мои задачи"
                description="Заказы, в которых сейчас ваш этап"
                icon={Inbox}
                phase={3}
              />
            ),
          },
          {
            path: '/orders',
            element: (
              <PlaceholderPage
                title="Заказы"
                description="Все заказы, поиск и фильтры"
                icon={ClipboardList}
                phase={3}
              />
            ),
          },
          {
            path: '/templates',
            element: (
              <RequirePermission permissions={['templates.manage']}>
                <PlaceholderPage
                  title="Шаблоны"
                  description="Последовательности этапов для заказов"
                  icon={Workflow}
                  phase={2}
                />
              </RequirePermission>
            ),
          },
          {
            path: '/stages',
            element: (
              <RequirePermission permissions={['templates.manage']}>
                <PlaceholderPage
                  title="Этапы"
                  description="Библиотека этапов: поля, документы, исполнители"
                  icon={ListChecks}
                  phase={2}
                />
              </RequirePermission>
            ),
          },
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
