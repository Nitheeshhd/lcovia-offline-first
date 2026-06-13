import { db } from '../database/db';
import { Operation } from '../models/Operation';
import { rewardService } from './reward.service';

function dbRun(sql: string, params: any[] = []): Promise<void> {
  return new Promise((res, rej) =>
    db.run(sql, params, (err) => (err ? rej(err) : res()))
  );
}

function dbGet<T>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((res, rej) =>
    db.get(sql, params, (err, row) => (err ? rej(err) : res(row as T)))
  );
}

function dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((res, rej) =>
    db.all(sql, params, (err, rows) => (err ? rej(err) : res(rows as T[])))
  );
}

export async function processSyncBatch(
  deviceId: string,
  operations: Operation[]
) {
  for (const op of operations) {

    // Idempotency: skip if already processed
    const existing = await dbGet(
      'SELECT operationId FROM operations WHERE operationId=?',
      [op.operationId]
    );
    if (existing) continue;

    // Save operation to log
    await dbRun(
      `INSERT INTO operations
       (operationId,deviceId,type,payload,lamport,createdAt)
       VALUES (?,?,?,?,?,?)`,
      [
        op.operationId,
        op.deviceId,
        op.type,
        JSON.stringify(op.payload),
        op.lamport,
        op.createdAt,
      ]
    );

    switch (op.type) {

      case 'TASK_STATUS_CHANGED': {
        const { taskId, newStatus, version, lamport } = op.payload;
        const task = await dbGet<any>(
          'SELECT * FROM tasks WHERE taskId=?',
          [taskId]
        );
        if (!task) break;

        // Conflict resolution: higher lamport wins
        // Tie: higher deviceId wins
        const shouldApply =
          lamport > task.lamport ||
          (lamport === task.lamport && op.deviceId > task.lastDeviceId);

        if (shouldApply) {
          await dbRun(
            `UPDATE tasks
             SET status=?, version=?, lamport=?, lastDeviceId=?
             WHERE taskId=?`,
            [newStatus, version, lamport, op.deviceId, taskId]
          );
          console.log(`[TASK] ${taskId} → ${newStatus} (lamport: ${lamport})`);
        } else {
          console.log(`[TASK] ${taskId} conflict ignored (lamport: ${lamport} <= ${task.lamport})`);
        }
        break;
      }

      case 'TASK_DELETED': {
        const { taskId, lamport } = op.payload;
        const task = await dbGet<any>(
          'SELECT * FROM tasks WHERE taskId=?',
          [taskId]
        );
        if (!task) break;

        const shouldApply =
          lamport > task.lamport ||
          (lamport === task.lamport && op.deviceId > task.lastDeviceId);

        if (shouldApply) {
          await dbRun(
            `UPDATE tasks SET isDeleted=1, lamport=?, lastDeviceId=? WHERE taskId=?`,
            [lamport, op.deviceId, taskId]
          );
          console.log(`[TASK] ${taskId} deleted`);
        }
        break;
      }

      case 'FOCUS_SESSION_COMPLETED': {
        const session = op.payload;

        // Save session (idempotent)
        await dbRun(
          `INSERT OR IGNORE INTO focus_sessions
           (sessionId,studentId,deviceId,targetDuration,status,failReason,startTime,endTime)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            session.sessionId,
            'student-1',
            op.deviceId,
            session.targetDuration,
            session.status,
            session.failReason || null,
            session.startTime,
            session.endTime,
          ]
        );

        // Award rewards exactly once
        if (session.status === 'SUCCESS') {
          await rewardService.awardRewards(
            session.sessionId,
            session.targetDuration
          );
        }
        break;
      }
    }
  }

  // Return all operations the client doesn't have
  const allOps = await dbAll<any>('SELECT * FROM operations');
  return allOps.map((op) => ({
    ...op,
    payload: JSON.parse(op.payload),
  }));
}