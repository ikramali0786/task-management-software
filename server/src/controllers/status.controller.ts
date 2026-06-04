import { Request, Response } from 'express';
import mongoose from 'mongoose';

const DB_STATES: Record<number, 'operational' | 'degraded' | 'outage'> = {
  0: 'outage',      // disconnected
  1: 'operational', // connected
  2: 'degraded',    // connecting
  3: 'degraded',    // disconnecting
};

export const getStatus = (_req: Request, res: Response): void => {
  const dbState  = mongoose.connection.readyState;
  const dbStatus = DB_STATES[dbState] ?? 'outage';
  const apiStatus: 'operational' | 'degraded' | 'outage' = 'operational';

  const overall: 'operational' | 'degraded' | 'outage' =
    dbStatus === 'operational' ? 'operational' :
    dbStatus === 'degraded'    ? 'degraded'    : 'outage';

  res.status(200).json({
    status: overall,
    services: {
      api:      { status: apiStatus,  label: 'API Server' },
      database: { status: dbStatus,   label: 'Database' },
      realtime: { status: apiStatus,  label: 'Real-time (WebSocket)' },
    },
    uptime:    Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};
