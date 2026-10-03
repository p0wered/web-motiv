import {
  type CreateTemplateRequest,
  templateSchema,
  templatesResponseSchema,
  type UpdateTemplateRequest,
} from '@webmotiv/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from './client.ts';
import { useInvalidateCatalog } from './stages.ts';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: ({ signal }) => apiRequest('/templates', { signal, schema: templatesResponseSchema }),
  });
}

export function useCreateTemplate() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (body: CreateTemplateRequest) =>
      apiRequest('/templates', { method: 'POST', body, schema: templateSchema }),
    onSuccess: invalidate,
  });
}

export function useUpdateTemplate(id: number) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (body: UpdateTemplateRequest) =>
      apiRequest(`/templates/${id}`, { method: 'PATCH', body, schema: templateSchema }),
    onSuccess: invalidate,
  });
}

export function useDeleteTemplate(id: number) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: () => apiRequest(`/templates/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
