import { initSentry } from './config/sentry';
// Initialise error monitoring before anything else so startup failures
// (DB connect, socket init) are reported too. No-op without SENTRY_DSN.
initSentry();

import http from 'http';
import app from './app';
import { connectDB } from './config/db';
import { initSocket } from './config/socket';
import { env } from './config/env';
import { startReminderScheduler } from './services/reminder.service';

const httpServer = http.createServer(app);

initSocket(httpServer);

const start = async () => {
  await connectDB();

  httpServer.listen(env.PORT, () => {
    console.log(`\n🚀 TaskFlow server running on port ${env.PORT}`);
    console.log(`   Mode: ${env.NODE_ENV}`);
    console.log(`   Client URL: ${env.CLIENT_URL}\n`);
  });

  // Kick off the in-process due-date reminder scheduler.
  startReminderScheduler();
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
