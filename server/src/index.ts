import express from 'express';
import cors from 'cors';

import { initDB } from './database/db';
import { syncRouter } from './routes/sync.routes';
import { notificationRouter } from './routes/notification.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/sync', syncRouter);
app.use('/api', notificationRouter);

// Initialize Database
initDB();

// Health Check
app.get('/', (req, res) => {
  res.json({
    message: 'Alcovia Offline Sync Backend Running',
    status: 'OK'
  });
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});