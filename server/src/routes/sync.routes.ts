import { Router, Request, Response } from 'express';
import { processSyncBatch } from '../services/sync.service';
import { db } from '../database/db';

export const syncRouter = Router();

/**
 * POST /sync
 * Push local operations to server
 * Pull operations from server
 */
syncRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { deviceId, operations } = req.body;

    const newOps = await processSyncBatch(
      deviceId,
      operations || []
    );

    res.json({
      success: true,
      operations: newOps
    });

  } catch (err: any) {
    console.error('Sync Error:', err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /sync/state
 * Used by Dev Panel
 */
syncRouter.get('/state', (req: Request, res: Response) => {

  db.all(
    'SELECT * FROM tasks WHERE isDeleted = 0',
    [],
    (taskErr, tasks) => {

      if (taskErr) {
        return res.status(500).json({
          error: taskErr.message
        });
      }

      db.all(
        'SELECT * FROM focus_sessions',
        [],
        (sessionErr, sessions) => {

          if (sessionErr) {
            return res.status(500).json({
              error: sessionErr.message
            });
          }

          db.get(
            "SELECT * FROM students WHERE studentId='student-1'",
            [],
            (studentErr, student) => {

              if (studentErr) {
                return res.status(500).json({
                  error: studentErr.message
                });
              }

              res.json({
                success: true,
                tasks,
                sessions,
                student
              });
            }
          );
        }
      );
    }
  );
});