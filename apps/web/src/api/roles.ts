import {
  type CreateRoleRequest,
  roleSchema,
  rolesResponseSchema,
  type UpdateRoleRequest,
} from '@webmotiv/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client.ts';

const rolesKey = ['roles'] as const;

export function useRoles() {
  return useQuery({
    queryKey: rolesKey,
    queryFn: ({ signal }) => apiRequest('/roles', { signal, schema: rolesResponseSchema }),
  });
}

/** Права могли поменяться у самого вошедшего — его данные тоже перечитываются. */
function useInvalidateRoles() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: rolesKey });
    void client.invalidateQueries({ queryKey: ['users'] });
    void client.invalidateQueries({ queryKey: ['me'] });
  };
}

export function useCreateRole() {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: (body: CreateRoleRequest) =>
      apiRequest('/roles', { method: 'POST', body, schema: roleSchema }),
    onSuccess: invalidate,
  });
}

export function useUpdateRole(id: number) {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: (body: UpdateRoleRequest) =>
      apiRequest(`/roles/${id}`, { method: 'PATCH', body, schema: roleSchema }),
    onSuccess: invalidate,
  });
}

export function useDeleteRole(id: number) {
  const invalidate = useInvalidateRoles();
  return useMutation({
    mutationFn: () => apiRequest(`/roles/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
