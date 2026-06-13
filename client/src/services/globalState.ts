import { DeviceStorage } from '../storage/indexeddb';
import { SyncEngine } from '../sync/syncEngine';

export const storageA = new DeviceStorage('device-A');
export const engineA = new SyncEngine(storageA, 'device-A');

export const storageB = new DeviceStorage('device-B');
export const engineB = new SyncEngine(storageB, 'device-B');