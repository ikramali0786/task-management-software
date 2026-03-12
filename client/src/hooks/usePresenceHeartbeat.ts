import { useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

const IDLE_THRESHOLD = 5 * 60 * 1000; // stop pinging after 5 min of no interaction
const PING_INTERVAL  = 60 * 1000;     // send a ping every 60 s while active

/**
 * Keeps the current user's presence status accurate.
 *
 * While the user is interacting (mouse, keyboard, scroll, tab focus) this hook
 * emits `presence:ping` to the server every 60 s. The server updates
 * `lastSeenAt` and broadcasts `presence:update` to teammates so their
 * presence dots update without a page refresh.
 *
 * If the user goes idle for ≥ 5 min, pings stop. `lastSeenAt` then becomes
 * stale and `isActive()` (which checks < 5 min) returns false → offline dot.
 */
export const usePresenceHeartbeat = () => {
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove',   onActivity, { passive: true });
    window.addEventListener('mousedown',   onActivity, { passive: true });
    window.addEventListener('keydown',     onActivity, { passive: true });
    window.addEventListener('scroll',      onActivity, { passive: true });
    document.addEventListener('visibilitychange', onActivity);

    const ping = () => {
      const socket = getSocket();
      if (!socket?.connected) return;
      if (Date.now() - lastActivityRef.current < IDLE_THRESHOLD) {
        socket.emit('presence:ping');
      }
    };

    // Ping immediately so lastSeenAt is fresh the moment the app mounts.
    ping();
    const interval = setInterval(ping, PING_INTERVAL);

    return () => {
      window.removeEventListener('mousemove',   onActivity);
      window.removeEventListener('mousedown',   onActivity);
      window.removeEventListener('keydown',     onActivity);
      window.removeEventListener('scroll',      onActivity);
      document.removeEventListener('visibilitychange', onActivity);
      clearInterval(interval);
    };
  }, []);
};
