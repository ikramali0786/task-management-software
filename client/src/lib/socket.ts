import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket: Socket | null = null;

// Desired team rooms. We track these client-side so that:
//   1. joinTeamRooms() called before the socket connects still takes effect
//      (the rooms are flushed on the next 'connect').
//   2. On socket.io reconnects — where server-side room membership is lost —
//      we automatically re-join every room without needing a page reload.
const desiredTeamRooms = new Set<string>();

const flushTeamRooms = (): void => {
  if (socket?.connected && desiredTeamRooms.size > 0) {
    socket.emit('join_teams', { teamIds: [...desiredTeamRooms] });
  }
};

export const initSocket = (token: string): Socket => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Re-join all desired rooms on every (re)connect.
  socket.on('connect', flushTeamRooms);

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  desiredTeamRooms.clear();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Register team rooms to receive live updates for. Idempotent and safe to call
// before the socket connects — rooms are remembered and (re)joined on connect.
export const joinTeamRooms = (teamIds: string[]): void => {
  if (!teamIds.length) return;
  teamIds.forEach((id) => id && desiredTeamRooms.add(id));
  flushTeamRooms();
};
