export const CHANNELS = ['email', 'whatsapp', 'call', 'message', 'other'] as const;
export const PERSON_STATUSES = ['active', 'hold', 'inactive'] as const;
export const TASK_STATUSES = ['open', 'done'] as const;

export type InteractionChannel = (typeof CHANNELS)[number];
export type PersonStatus = (typeof PERSON_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
