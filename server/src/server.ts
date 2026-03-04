import http from 'http';
import app from './app';
import { connectDB } from './config/db';
import { initSocket } from './config/socket';
import { env } from './config/env';

const httpServer = http.createServer(app);

initSocket(httpServer);

const start = async () => {
  await connectDB();

  httpServer.listen(env.PORT, () => {
    console.log(`\n🚀 TaskFlow server running on port ${env.PORT}`);
    console.log(`   Mode: ${env.NODE_ENV}`);
    console.log(`   Client URL: ${env.CLIENT_URL}\n`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
