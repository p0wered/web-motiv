import {
  type CreateStageRequest,
  stageSchema,
  stagesResponseSchema,
  type UpdateStageRequest,
} from '@webmotiv/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client.ts';

const stagesKey = ['stages'] as const;

export function useStages() {
  return useQuery({
    queryKey: stagesKey,
    queryFn: ({ signal }) => apiRequest('/stages', { signal, schema: stagesResponseSchema }),
  });
}

/** Этапы видны и в шаблонах, и в счётчиках ролей — после правок перечитывается всё это. */
function useInvalidateCatalog() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: stagesKey });
    void client.invalidateQueries({ queryKey: ['templates'] });
    void client.invalidateQueries({ queryKey: ['roles'] });
  };
}

export function useCreateStage() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (body: CreateStageRequest) =>
      apiRequest('/stages', { method: 'POST', body, schema: stageSchema }),
    onSuccess: invalidate,
  });
}

export function useUpdateStage(id: number) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (body: UpdateStageRequest) =>
      apiRequest(`/stages/${id}`, { method: 'PATCH', body, schema: stageSchema }),
    onSuccess: invalidate,
  });
}

export function useDeleteStage(id: number) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: () => apiRequest(`/stages/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export { useInvalidateCatalog };
