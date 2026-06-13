export type SessionStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface FocusSession {
  sessionId: string;
  deviceId: string;
  targetDuration: number;
  status: SessionStatus;
  failReason?: 'give_up' | 'app_switch';
  startTime: number;
  endTime?: number;
}