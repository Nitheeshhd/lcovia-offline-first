import { db } from '../database/db';
import axios from 'axios';

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

const N8N_WEBHOOK_URL = 'https://alcovia-study-sync.app.n8n.cloud/webhook/focus-success';
const COINS_PER_SESSION = 50;

export const rewardService = {
  async awardRewards(sessionId: string, durationMinutes: number) {

    // Idempotency check
    const alreadyProcessed = await dbGet(
      'SELECT 1 FROM processed_sessions WHERE sessionId=?',
      [sessionId]
    );
    if (alreadyProcessed) {
      console.log(`[SKIP] Session ${sessionId} already rewarded`);
      return;
    }

    // Mark as processed FIRST
    await dbRun(
      'INSERT INTO processed_sessions (sessionId, processedAt) VALUES (?,?)',
      [sessionId, Date.now()]
    );

    // Get student
    const student = await dbGet<any>(
      "SELECT * FROM students WHERE studentId='student-1'"
    );
    if (!student) return;

    // Update streak
    const today = new Date().toDateString();
    const newStreak =
      student.lastSessionDate === today
        ? student.streak
        : student.streak + 1;

    // Award coins + streak
    await dbRun(
      `UPDATE students 
       SET coins=coins+?, streak=?, lastSessionDate=?
       WHERE studentId='student-1'`,
      [COINS_PER_SESSION, newStreak, today]
    );

    console.log(`[REWARD] Session ${sessionId} → +${COINS_PER_SESSION} coins, streak: ${newStreak}`);

    // Get updated student
    const updatedStudent = await dbGet<any>(
      "SELECT * FROM students WHERE studentId='student-1'"
    );

    // Fire n8n webhook
    const eventId = `focus-success-${sessionId}`;
    try {
      await axios.post(N8N_WEBHOOK_URL, {
        eventId,
        sessionId,
        streak: updatedStudent?.streak,
        coinsAwarded: COINS_PER_SESSION,
        focusMinutes: durationMinutes,
      });
      console.log(`[N8N] Webhook sent → eventId: ${eventId}`);
    } catch (err: any) {
      console.error('[N8N] Webhook failed:', err.message);
    }
  },
};