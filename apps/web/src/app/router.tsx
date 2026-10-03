import {
  ClipboardList,
  Inbox,
  ListChecks,
  ScrollText,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';
import { createBrowserRouter, Navigate } from 'react-router';
import { LoginPage } from '../features/auth/login-page.tsx';
import { PlaceholderPage } from '../features/placeholder/placeholder-page.tsx';
import { AppShell } from './app-shell.tsx';

// Проверка сессии перед оболочкой появится вместе со входом (фаза 1).
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AppShell />,
    children: [
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
          <PlaceholderPage
            title="Шаблоны"
            description="Последовательности этапов для заказов"
            icon={Workflow}
            phase={2}
          />
        ),
      },
      {
        path: '/stages',
        element: (
          <PlaceholderPage
            title="Этапы"
            description="Библиотека этапов: поля, документы, исполнители"
            icon={ListChecks}
            phase={2}
          />
        ),
      },
      {
        path: '/users',
        element: (
          <PlaceholderPage
            title="Сотрудники"
            description="Учётные записи, роли и сеансы"
            icon={Users}
            phase={1}
          />
        ),
      },
      {
        path: '/roles',
        element: (
          <PlaceholderPage
            title="Роли"
            description="Должности и права"
            icon={ShieldCheck}
            phase={1}
          />
        ),
      },
      {
        path: '/audit',
        element: (
          <PlaceholderPage
            title="Журнал"
            description="Входы, изменения настроек и действия с заказами"
            icon={ScrollText}
            phase={1}
          />
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/tasks" replace /> },
]);
