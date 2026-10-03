import {
  type CreateUserRequest,
  createUserResponseSchema,
  resetPasswordResponseSchema,
  type UpdateUserRequest,
  userDetailSchema,
  userSchema,
  usersResponseSchema,
} from '@webmotiv/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client.ts';

const usersKey = ['users'] as const;
const userKey = (id: number) => ['users', id] as const;

export function useUsers() {
  return useQuery({
    queryKey: usersKey,
    queryFn: ({ signal }) => apiRequest('/users', { signal, schema: usersResponseSchema }),
  });
}

export function useUser(id: number) {
  return useQuery({
    queryKey: userKey(id),
    queryFn: ({ signal }) => apiRequest(`/users/${id}`, { signal, schema: userDetailSchema }),
  });
}

/** После любой правки сотрудника обновляются и список, и карточка, и роли (счётчики). */
function useInvalidateUsers() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: usersKey });
    void client.invalidateQueries({ queryKey: ['roles'] });
    void client.invalidateQueries({ queryKey: ['me'] });
  };
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (body: CreateUserRequest) =>
      apiRequest('/users', { method: 'POST', body, schema: createUserResponseSchema }),
    onSuccess: invalidate,
  });
}

export function useUpdateUser(id: number) {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: (body: UpdateUserRequest) =>
      apiRequest(`/users/${id}`, { method: 'PATCH', body, schema: userSchema }),
    onSuccess: invalidate,
  });
}

export function useResetPassword(id: number) {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: () =>
      apiRequest(`/users/${id}/password-reset`, {
        method: 'POST',
        schema: resetPasswordResponseSchema,
      }),
    onSuccess: invalidate,
  });
}

export function useTerminateUserSessions(id: number) {
  const invalidate = useInvalidateUsers();
  return useMutation({
    mutationFn: () => apiRequest(`/users/${id}/sessions`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
