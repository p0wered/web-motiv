import {
  type CreateOrderRequest,
  directoryResponseSchema,
  myTasksCountSchema,
  type Order,
  type OrderListQuery,
  orderSchema,
  ordersResponseSchema,
  type StageValues,
  type UpdateOrderRequest,
} from '@webmotiv/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client.ts';

const PAGE_SIZE = 50;
/** Списки и счётчик задач обновляются сами: заказы двигают другие сотрудники. */
const REFRESH_MS = 30_000;

const orderKey = (id: number) => ['order', id] as const;

export function useOrders(query: Omit<OrderListQuery, 'before' | 'limit'>) {
  return useInfiniteQuery({
    queryKey: ['orders', query],
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== '') params.set(key, String(value));
      }
      if (pageParam) params.set('before', String(pageParam));
      return apiRequest(`/orders?${params}`, { signal, schema: ordersResponseSchema });
    },
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    refetchInterval: REFRESH_MS,
  });
}

export function useTaskCount() {
  return useQuery({
    queryKey: ['orders', 'tasks', 'count'],
    queryFn: ({ signal }) =>
      apiRequest('/orders/tasks/count', { signal, schema: myTasksCountSchema }),
    refetchInterval: REFRESH_MS,
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: orderKey(id),
    queryFn: ({ signal }) => apiRequest(`/orders/${id}`, { signal, schema: orderSchema }),
  });
}

/** Сотрудники для выбора: поле «Сотрудник», ответственный. */
export function useDirectory() {
  return useQuery({
    queryKey: ['users', 'directory'],
    queryFn: ({ signal }) =>
      apiRequest('/users/directory', { signal, schema: directoryResponseSchema }),
    staleTime: 5 * 60_000,
  });
}

/** Свежий заказ — сразу в кэш карточки; списки и счётчик задач перечитываются. */
function useApplyOrder() {
  const client = useQueryClient();
  return (order: Order) => {
    client.setQueryData(orderKey(order.id), order);
    void client.invalidateQueries({ queryKey: ['orders'] });
  };
}

export function useCreateOrder() {
  const apply = useApplyOrder();
  return useMutation({
    mutationFn: (body: CreateOrderRequest) =>
      apiRequest('/orders', { method: 'POST', body, schema: orderSchema }),
    onSuccess: apply,
  });
}

export function useUpdateOrder(id: number) {
  const apply = useApplyOrder();
  return useMutation({
    mutationFn: (body: UpdateOrderRequest) =>
      apiRequest(`/orders/${id}`, { method: 'PATCH', body, schema: orderSchema }),
    onSuccess: apply,
  });
}

export function useCancelOrder(id: number) {
  const apply = useApplyOrder();
  return useMutation({
    mutationFn: (body: { version: number; reason: string }) =>
      apiRequest(`/orders/${id}/cancel`, { method: 'POST', body, schema: orderSchema }),
    onSuccess: apply,
  });
}

export function useSaveStage(orderId: number, stageId: number) {
  const apply = useApplyOrder();
  return useMutation({
    mutationFn: (body: { version: number; values: StageValues }) =>
      apiRequest(`/orders/${orderId}/stages/${stageId}`, {
        method: 'PUT',
        body,
        schema: orderSchema,
      }),
    onSuccess: apply,
  });
}

export function useCompleteStage(orderId: number, stageId: number) {
  const apply = useApplyOrder();
  return useMutation({
    mutationFn: (version: number) =>
      apiRequest(`/orders/${orderId}/stages/${stageId}/complete`, {
        method: 'POST',
        body: { version },
        schema: orderSchema,
      }),
    onSuccess: apply,
  });
}

export function useUploadFile(orderId: number, stageId: number, fieldId: string) {
  const apply = useApplyOrder();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiRequest(`/orders/${orderId}/stages/${stageId}/fields/${fieldId}/files`, {
        method: 'POST',
        body: form,
        schema: orderSchema,
      });
    },
    onSuccess: apply,
  });
}

export function useDeleteFile() {
  const apply = useApplyOrder();
  return useMutation({
    mutationFn: (fileId: string) =>
      apiRequest(`/files/${fileId}`, { method: 'DELETE', schema: orderSchema }),
    onSuccess: apply,
  });
}

export const fileUrl = (fileId: string, inline = false) =>
  `/api/files/${fileId}${inline ? '?inline=1' : ''}`;
