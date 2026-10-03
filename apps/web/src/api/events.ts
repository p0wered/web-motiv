import { type EventGroup, eventsResponseSchema } from '@webmotiv/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiRequest } from './client.ts';

const PAGE_SIZE = 50;

export function useEvents(filter: {
  group?: EventGroup | undefined;
  actorId?: number | undefined;
}) {
  return useInfiniteQuery({
    queryKey: ['events', filter],
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (pageParam) params.set('before', String(pageParam));
      if (filter.group) params.set('group', filter.group);
      if (filter.actorId) params.set('actorId', String(filter.actorId));
      return apiRequest(`/events?${params}`, { signal, schema: eventsResponseSchema });
    },
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
}
