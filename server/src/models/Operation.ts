export type OperationType =
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DELETED'
  | 'FOCUS_SESSION_STARTED'
  | 'FOCUS_SESSION_COMPLETED';

export interface Operation {
  operationId: string;
  deviceId: string;
  type: OperationType;
  payload: Record<string, any>;
  lamport: number;
  createdAt: number;
}