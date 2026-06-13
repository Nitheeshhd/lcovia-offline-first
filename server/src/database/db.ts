import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../../alcovia.db');

export const db = new sqlite3.Database(DB_PATH);

export function initDB() {
  db.serialize(() => {

    db.run(`
      CREATE TABLE IF NOT EXISTS students (
        studentId TEXT PRIMARY KEY,
        coins INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 0,
        todayFocusMinutes INTEGER DEFAULT 0,
        lastSessionDate TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        taskId TEXT PRIMARY KEY,
        subjectId TEXT,
        chapterId TEXT,
        title TEXT,
        status TEXT DEFAULT 'NOT_STARTED',
        version INTEGER DEFAULT 0,
        lamport INTEGER DEFAULT 0,
        lastDeviceId TEXT,
        isDeleted INTEGER DEFAULT 0
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS focus_sessions (
        sessionId TEXT PRIMARY KEY,
        studentId TEXT,
        deviceId TEXT,
        targetDuration INTEGER,
        status TEXT,
        failReason TEXT,
        startTime INTEGER,
        endTime INTEGER
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS operations (
        operationId TEXT PRIMARY KEY,
        deviceId TEXT,
        type TEXT,
        payload TEXT,
        lamport INTEGER,
        createdAt INTEGER
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS processed_sessions (
        sessionId TEXT PRIMARY KEY,
        processedAt INTEGER
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS processed_notifications (
        eventId TEXT PRIMARY KEY,
        processedAt INTEGER
      )
    `);

    db.run(`
      INSERT OR IGNORE INTO students
      (studentId, coins, streak, todayFocusMinutes)
      VALUES
      ('student-1', 0, 0, 0)
    `);

    db.run(`
      INSERT OR IGNORE INTO tasks VALUES
      ('task-1','math','ch-1','Read Notes','NOT_STARTED',0,0,NULL,0),
      ('task-2','math','ch-1','Solve Exercises','NOT_STARTED',0,0,NULL,0),
      ('task-3','math','ch-2','Practice Problems','NOT_STARTED',0,0,NULL,0),
      ('task-4','science','ch-1','Read Chapter','NOT_STARTED',0,0,NULL,0),
      ('task-5','science','ch-1','Write Summary','NOT_STARTED',0,0,NULL,0)
    `);

    console.log('✅ Database Initialized');
  });
}