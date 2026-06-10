import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { type Peer } from '@/lib/whiteboardTypes';
import { peerColor, PEER_TTL } from '@/lib/whiteboardGeometry';

/**
 * Live-collaboration overlay (cursors + teammate selection highlights). Owns its
 * own peer state and socket listeners so high-frequency cursor traffic re-renders
 * ONLY this layer — never the elements layer or the parent. Reports the set of
 * present teammates up to the parent (for the toolbar avatars) only when someone
 * joins or leaves, not on every cursor move. Remounted per board via `key`.
 */
export const CollabLayer = ({ teamId, boardIdRef, scale, getBBox, onPresence }: {
  teamId: string;
  boardIdRef: React.MutableRefObject<string | null>;
  scale: number;
  getBBox: (id: string) => { x: number; y: number; w: number; h: number } | null;
  onPresence: (list: { id: string; name: string }[]) => void;
}) => {
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const lastIdsRef = useRef('');

  useEffect(() => {
    const socket = getSocket(); if (!socket) return;
    const onCursor = (d: { userId: string; name: string; boardId?: string; x: number; y: number }) => { if (d.boardId && d.boardId !== boardIdRef.current) return; setPeers((p) => ({ ...p, [d.userId]: { name: d.name, x: d.x, y: d.y, ids: p[d.userId]?.ids ?? [], lastSeen: Date.now() } })); };
    const onSelection = (d: { userId: string; name: string; boardId?: string; ids: string[] }) => { if (d.boardId && d.boardId !== boardIdRef.current) return; setPeers((p) => ({ ...p, [d.userId]: { name: d.name, x: p[d.userId]?.x ?? 0, y: p[d.userId]?.y ?? 0, ids: d.ids, lastSeen: Date.now() } })); };
    const onLeave = (d: { userId: string }) => setPeers((p) => { if (!p[d.userId]) return p; const n = { ...p }; delete n[d.userId]; return n; });
    socket.on('whiteboard:cursor', onCursor); socket.on('whiteboard:selection', onSelection); socket.on('whiteboard:leave', onLeave);
    const sweep = setInterval(() => setPeers((p) => { const now = Date.now(); let changed = false; const n: Record<string, Peer> = {}; for (const k in p) { if (now - p[k].lastSeen < PEER_TTL) n[k] = p[k]; else changed = true; } return changed ? n : p; }), 4000);
    return () => { socket.off('whiteboard:cursor', onCursor); socket.off('whiteboard:selection', onSelection); socket.off('whiteboard:leave', onLeave); clearInterval(sweep); socket.emit('whiteboard:leave', { teamId }); onPresence([]); };
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tell the parent who's here only when the roster changes (not on cursor moves).
  useEffect(() => {
    const ids = Object.keys(peers).sort().join(',');
    if (ids !== lastIdsRef.current) { lastIdsRef.current = ids; onPresence(Object.entries(peers).map(([id, v]) => ({ id, name: v.name }))); }
  }, [peers, onPresence]);

  const hz = 1 / scale;
  return (
    <>{Object.entries(peers).map(([k, pr]) => {
      const col = peerColor(k);
      return (<g key={k} pointerEvents="none">
        {pr.ids.map((id) => { const b = getBBox(id); if (!b) return null; return <rect key={id} x={b.x - 2 * hz} y={b.y - 2 * hz} width={b.w + 4 * hz} height={b.h + 4 * hz} rx={6 * hz} fill="none" stroke={col} strokeWidth={1.5 * hz} strokeDasharray={`${4 * hz} ${3 * hz}`} />; })}
        {(pr.x !== 0 || pr.y !== 0) && (
          <g transform={`translate(${pr.x} ${pr.y}) scale(${hz})`}>
            <path d="M0 0 L0 17 L4.6 12.6 L7.7 18.6 L10.2 17.4 L7.1 11.5 L13.4 11.5 Z" fill={col} stroke="#fff" strokeWidth={1} />
            <g transform="translate(13 11)"><rect rx={4} ry={4} height={17} width={(pr.name || '?').length * 6.4 + 12} fill={col} /><text x={6} y={12.5} fill="#fff" fontSize={11} fontWeight={600}>{pr.name}</text></g>
          </g>
        )}
      </g>);
    })}</>
  );
};
