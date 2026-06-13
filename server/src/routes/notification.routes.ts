import { Router } from 'express';
import { db } from '../database/db';

export const notificationRouter = Router();

notificationRouter.post(
  '/notify',
  (req, res) => {

    const {
      eventId,
      sessionId,
      coinsAwarded,
      focusMinutes
    } = req.body;

    db.run(
      `INSERT OR IGNORE INTO processed_notifications
      (eventId, processedAt)
      VALUES (?, ?)`,
      [
        eventId,
        Date.now()
      ],
      (err) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        console.log(
          `✅ Notification Stored`
        );

        console.log({
          eventId,
          sessionId,
          coinsAwarded,
          focusMinutes
        });

        res.json({
          success: true
        });
      }
    );
  }
);

notificationRouter.get(
  '/notifications',
  (req, res) => {

    db.all(
      'SELECT * FROM processed_notifications',
      [],
      (_, rows) => {
        res.json(rows);
      }
    );
  }
);