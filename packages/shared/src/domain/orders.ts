export const ORDER_STATUSES = ['active', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STAGE_STATUSES = ['pending', 'active', 'done'] as const;
export type OrderStageStatus = (typeof ORDER_STAGE_STATUSES)[number];

/** Кто заполняет этап: любой сотрудник с ролью или ответственный по заказу (PLAN.md §3.3). */
export const STAGE_EXECUTORS = ['role', 'responsible'] as const;
export type StageExecutor = (typeof STAGE_EXECUTORS)[number];
