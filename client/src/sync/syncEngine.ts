import { DeviceStorage } from '../storage/indexeddb';
import { Operation } from '../types/operation';
import { FocusSession } from '../types/session';
import { lamport } from '../services/lamport';

const SERVER_URL = 'https://lcovia-offline-first.onrender.com';

export class SyncEngine {
  private storage: DeviceStorage;
  private deviceId: string;
  private isOnline: boolean = true;

  constructor(storage: DeviceStorage, deviceId: string) {
    this.storage = storage;
    this.deviceId = deviceId;
  }

  setOnline(online: boolean) {
    this.isOnline = online;
    if (online) {
      console.log(`[${this.deviceId}] Back online — syncing...`);
      this.sync();
    } else {
      console.log(`[${this.deviceId}] Gone offline — queuing locally`);
    }
  }

  getOnline(): boolean {
    return this.isOnline;
  }

  async queueOperation(op: Operation): Promise<void> {
    await this.storage.addPendingOp(op);
    if (this.isOnline) {
      await this.sync();
    } else {
      console.log(`[${this.deviceId}] Queued offline: ${op.type}`);
    }
  }

  async sync(): Promise<Operation[]> {
    // Don't sync if offline
    if (!this.isOnline) {
      console.log(`[${this.deviceId}] Offline — sync skipped`);
      return [];
    }

    const pending = await this.storage.getPendingOps();

    try {
      const response = await fetch(`${SERVER_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: this.deviceId, operations: pending }),
      });

      const data = await response.json();
      await this.storage.clearPendingOps();

      const incomingOps: Operation[] = data.operations || [];
      for (const op of incomingOps) {
        lamport.update(op.lamport);
        await this.applyOperationLocally(op);
      }

      return incomingOps;
    } catch (err) {
      console.error(`[${this.deviceId}] Sync failed`);
      return [];
    }
  }

  private async applyOperationLocally(op: Operation): Promise<void> {
    if (op.type === 'TASK_STATUS_CHANGED') {
      const tasks = await this.storage.getTasks();
      const task = tasks.find((t) => t.taskId === op.payload.taskId);
      if (!task) return;

      const shouldApply =
        op.payload.lamport > task.lamport ||
        (op.payload.lamport === task.lamport && op.deviceId > this.deviceId);

      if (shouldApply) {
        await this.storage.saveTask({
          ...task,
          status: op.payload.newStatus,
          version: op.payload.version,
          lamport: op.payload.lamport,
        });
      }
    }

    if (op.type === 'TASK_DELETED') {
      const tasks = await this.storage.getTasks();
      const task = tasks.find((t) => t.taskId === op.payload.taskId);
      if (!task) return;

      const shouldApply =
        op.payload.lamport > task.lamport ||
        (op.payload.lamport === task.lamport && op.deviceId > this.deviceId);

      if (shouldApply) {
        await this.storage.saveTask({
          ...task,
          isDeleted: true,
          lamport: op.payload.lamport,
        });
      }
    }

    if (op.type === 'FOCUS_SESSION_COMPLETED') {
      await this.storage.saveSession(op.payload as FocusSession);
    }
  }
}