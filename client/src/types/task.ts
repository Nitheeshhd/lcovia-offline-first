export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';

export interface Task {
  taskId: string;
  subjectId: string;
  chapterId: string;
  title: string;
  status: TaskStatus;
  version: number;
  lamport: number;
  isDeleted: boolean;
}