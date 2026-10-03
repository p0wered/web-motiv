// Вход, текущий сотрудник, свой пароль и сеансы.
import {
  type ChangePasswordRequest,
  type LoginRequest,
  type MeResponse,
  meResponseSchema,
  sessionsResponseSchema,
} from '@webmotiv/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, isApiError } from './client.ts';

export const meKey = ['me'] as const;

/** Кто вошёл; `null` — никто (сессии нет или она истекла). */
export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: async ({ signal }): Promise<MeResponse | null> => {
      try {
        return await apiRequest('/auth/me', { signal, schema: meResponseSchema });
      } catch (error) {
        if (isApiError(error, 401)) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      apiRequest('/auth/login', { method: 'POST', body, schema: meResponseSchema }),
    onSuccess: (me) => {
      // Данные прошлого сотрудника в этом браузере новому не нужны.
      client.clear();
      client.setQueryData(meKey, me);
    },
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      client.clear();
      client.setQueryData(meKey, null);
    },
  });
}

export function useChangePassword() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) =>
      apiRequest('/auth/password', { method: 'POST', body }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: meKey });
      void client.invalidateQueries({ queryKey: sessionsKey });
    },
  });
}

const sessionsKey = ['me', 'sessions'] as const;

export function useMySessions() {
  return useQuery({
    queryKey: sessionsKey,
    queryFn: ({ signal }) =>
      apiRequest('/auth/sessions', { signal, schema: sessionsResponseSchema }),
  });
}

export function useTerminateSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`/auth/sessions/${id}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: sessionsKey }),
  });
}

export function useTerminateOtherSessions() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest('/auth/sessions', { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: sessionsKey }),
  });
}
