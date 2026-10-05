import { type EventGroup, eventsResponseSchema } from '@webmotiv/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiRequest } from './client.ts';

/** Сколько событий на странице: на выбор, по умолчанию — 50. Больше 100 сервер не отдаёт. */
export const EVENTS_PAGE_SIZES = [10, 25, 50, 100] as const;
export const EVENTS_PAGE_SIZE = 50;

export function useEvents(filter: {
  page: number;
  pageSize: number;
  group?: EventGroup | undefined;
  actorId?: number | undefined;
}) {
  return useQuery({
    queryKey: ['events', filter],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        page: String(filter.page),
        limit: String(filter.pageSize),
      });
      if (filter.group) params.set('group', filter.group);
      if (filter.actorId) params.set('actorId', String(filter.actorId));
      return apiRequest(`/events?${params}`, { signal, schema: eventsResponseSchema });
    },
    // Пока грузится следующая страница, на экране остаётся прежняя — без мигания «Загрузка».
    placeholderData: keepPreviousData,
  });
}
