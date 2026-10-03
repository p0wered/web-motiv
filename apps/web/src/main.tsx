import { PASSWORD_CHANGE_REQUIRED } from '@webmotiv/shared';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { meKey } from './api/auth.ts';
import { isApiError } from './api/client.ts';
import { router } from './app/router.tsx';
import './index.css';

// Сессия истекла на любом запросе (401) — «не вошёл», страница уйдёт на вход. Сервер требует
// сменить временный пароль — перечитываем сотрудника, страница уйдёт на смену пароля.
const onError = (error: unknown) => {
  if (isApiError(error, 401)) queryClient.setQueryData(meKey, null);
  else if (isApiError(error, 403) && error.code === PASSWORD_CHANGE_REQUIRED) {
    void queryClient.invalidateQueries({ queryKey: meKey });
  }
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // 401/403/404 повтором не исправить.
      retry: (failures, error) =>
        failures < 2 && !(isApiError(error) && error.status >= 400 && error.status < 500),
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Не найден элемент #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
