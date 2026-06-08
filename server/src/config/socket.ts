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

  io.on('connection', async (socket) => {
    const user = (socket as any).user;
    console.log(`Socket connected: ${user.name} (${socket.id})`);

    // Track activity — update lastSeenAt on connect
    await User.findByIdAndUpdate(user._id, { lastSeenAt: new Date() });

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

    // Relay live whiteboard operations to the rest of the team (element-level
    // last-writer-wins, so concurrent edits to different elements don't clobber).
    socket.on('whiteboard:op', (data: { teamId: string; op: unknown }) => {
      if (!data?.teamId) return;
      socket.to(`team:${data.teamId}`).emit('whiteboard:op', data.op);
    });

    // ── Live collaboration: cursors, selection awareness, presence ──────────
    // Server stamps identity so clients can't spoof other users' names.
    const wbUid = (user._id as any).toString();
    socket.on('whiteboard:cursor', (data: { teamId: string; x: number; y: number }) => {
      if (!data?.teamId) return;
      socket.to(`team:${data.teamId}`).emit('whiteboard:cursor', { userId: wbUid, name: user.name, x: data.x, y: data.y });
    });
    socket.on('whiteboard:selection', (data: { teamId: string; ids: string[] }) => {
      if (!data?.teamId) return;
      socket.to(`team:${data.teamId}`).emit('whiteboard:selection', { userId: wbUid, name: user.name, ids: Array.isArray(data.ids) ? data.ids : [] });
    });
    socket.on('whiteboard:leave', (data: { teamId: string }) => {
      if (!data?.teamId) return;
      socket.to(`team:${data.teamId}`).emit('whiteboard:leave', { userId: wbUid });
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

    // ── Typing indicators (comments) ──────────────────────────────────────
    // Broadcast to the rest of the team so they see "X is typing…" in real time.
    socket.on('typing:start', (data: { taskId: string; teamId: string }) => {
      socket.to(`team:${data.teamId}`).emit('typing:start', {
        taskId: data.taskId,
        userId: (user._id as any).toString(),
        userName: user.name,
      });
    });

    socket.on('typing:stop', (data: { taskId: string; teamId: string }) => {
      socket.to(`team:${data.teamId}`).emit('typing:stop', {
        taskId: data.taskId,
        userId: (user._id as any).toString(),
      });
    });

    // ── Presence heartbeat ─────────────────────────────────────────────────
    // Client emits this every 60 s while the user has been active in the last
    // 5 min. We stamp lastSeenAt and broadcast to all team rooms so teammates'
    // presence dots update in real time without a page refresh.
    socket.on('presence:ping', async () => {
      const now = new Date();
      await User.findByIdAndUpdate(user._id, { lastSeenAt: now });
      for (const room of socket.rooms) {
        if (room.startsWith('team:')) {
          socket.to(room).emit('presence:update', {
            userId: (user._id as any).toString(),
            lastSeenAt: now.toISOString(),
          });
        }
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${user.name}`);
      // Update lastSeenAt on disconnect so teammates see accurate "last active" time
      await User.findByIdAndUpdate(user._id, { lastSeenAt: new Date() });
    });
  });

  return io;
};

export const getIO = (): SocketServer | null => io;
