import { Task } from '../types/task';
import { FocusSession } from '../types/session';
import { Operation } from '../types/operation';

const DB_VERSION = 1;

function openDB(deviceId: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`alcovia-${deviceId}`, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('tasks'))
        db.createObjectStore('tasks', { keyPath: 'taskId' });
      if (!db.objectStoreNames.contains('sessions'))
        db.createObjectStore('sessions', { keyPath: 'sessionId' });
      if (!db.objectStoreNames.contains('pendingOps'))
        db.createObjectStore('pendingOps', { keyPath: 'operationId' });
      if (!db.objectStoreNames.contains('student'))
        db.createObjectStore('student', { keyPath: 'studentId' });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function idbPut(db: IDBDatabase, store: string, value: any): Promise<void> {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

export class DeviceStorage {
  private db!: IDBDatabase;
  private deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
  }

  async init() {
    this.db = await openDB(this.deviceId);
  }

  async getTasks(): Promise<Task[]> {
    return idbGetAll<Task>(this.db, 'tasks');
  }

  async saveTask(task: Task): Promise<void> {
    await idbPut(this.db, 'tasks', task);
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    for (const t of tasks) await idbPut(this.db, 'tasks', t);
  }

  async getSessions(): Promise<FocusSession[]> {
    return idbGetAll<FocusSession>(this.db, 'sessions');
  }

  async saveSession(session: FocusSession): Promise<void> {
    await idbPut(this.db, 'sessions', session);
  }

  async addPendingOp(op: Operation): Promise<void> {
    await idbPut(this.db, 'pendingOps', op);
  }

  async getPendingOps(): Promise<Operation[]> {
    return idbGetAll<Operation>(this.db, 'pendingOps');
  }

  async removePendingOp(operationId: string): Promise<void> {
    await idbDelete(this.db, 'pendingOps', operationId);
  }

  async clearPendingOps(): Promise<void> {
    const ops = await this.getPendingOps();
    for (const op of ops) await this.removePendingOp(op.operationId);
  }

  async getStudent(): Promise<any> {
    return idbGet(this.db, 'student', 'student-1');
  }

  async saveStudent(student: any): Promise<void> {
    await idbPut(this.db, 'student', student);
  }
}