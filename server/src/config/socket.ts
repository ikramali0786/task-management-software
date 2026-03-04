import { Server as HTTPServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { env } from './env';
import { verifyAccessToken } from '../services/auth.service';
import { User } from '../models/User.model';

let io: SocketServer | null = null;

export const initSocket = (httpServer: HTTPServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) throw new Error('No token');
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) throw new Error('User not found');
      (socket as any).user = user;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    console.log(`Socket connected: ${user.name} (${socket.id})`);

    // Join personal user room for notifications
    socket.join(`user:${user._id}`);

    // Join team rooms
    socket.on('join_teams', (data: { teamIds: string[] }) => {
      if (Array.isArray(data.teamIds)) {
        data.teamIds.forEach((teamId) => {
          socket.join(`team:${teamId}`);
        });
      }
    });

    // Handle task move from Kanban DnD
    socket.on(
      'task:move',
      (data: { taskId: string; newStatus: string; newPosition: number; teamId: string }) => {
        socket.to(`team:${data.teamId}`).emit('task:moved', {
          ...data,
          movedBy: user._id,
        });
      }
    );

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${user.name}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer | null => io;
