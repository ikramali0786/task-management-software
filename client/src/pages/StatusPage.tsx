import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw, Wifi, Database, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceStatus = 'operational' | 'degraded' | 'outage' | 'loading';

interface ServiceInfo {
  status: ServiceStatus;
  label: string;
}

interface StatusResponse {
  status: 'operational' | 'degraded' | 'outage';
  services: {
    api:      ServiceInfo;
    database: ServiceInfo;
    realtime: ServiceInfo;
  };
  uptime: number;
  timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ServiceStatus, {
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
  Icon: React.FC<{ className?: string }>;
}> = {
  operational: {
    label:  'Operational',
    color:  'text-emerald-600 dark:text-emerald-400',
    bg:     'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-700',
    dot:    'bg-emerald-500',
    Icon:   CheckCircle2,
  },
  degraded: {
    label:  'Degraded',
    color:  'text-amber-600 dark:text-amber-400',
    bg:     'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-700',
    dot:    'bg-amber-500',
    Icon:   AlertTriangle,
  },
  outage: {
    label:  'Outage',
    color:  'text-red-600 dark:text-red-400',
    bg:     'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-700',
    dot:    'bg-red-500',
    Icon:   XCircle,
  },
  loading: {
    label:  'Checking…',
    color:  'text-slate-400',
    bg:     'bg-slate-50 dark:bg-slate-800',
    border: 'border-slate-200 dark:border-slate-700',
    dot:    'bg-slate-400',
    Icon:   RefreshCw,
  },
};

const SERVICE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  api:      Server,
  database: Database,
  realtime: Wifi,
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Overall banner ────────────────────────────────────────────────────────────

const OverallBanner = ({ status }: { status: ServiceStatus }) => {
  const cfg = STATUS_CONFIG[status];
  const { Icon } = cfg;

  const messages: Record<ServiceStatus, string> = {
    operational: 'All systems are fully operational.',
    degraded:    'Some services are experiencing issues.',
    outage:      'We are currently experiencing a service outage.',
    loading:     'Checking system status…',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-6 py-4',
        cfg.bg, cfg.border
      )}
    >
      <Icon className={cn('h-6 w-6 flex-shrink-0', cfg.color)} />
      <span className={cn('text-base font-semibold', cfg.color)}>{messages[status]}</span>
      {status === 'operational' && (
        <span className="ml-auto flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', cfg.dot, 'animate-pulse')} />
          <span className="text-xs text-emerald-600 dark:text-emerald-400">Live</span>
        </span>
      )}
    </motion.div>
  );
};

// ── Service row ───────────────────────────────────────────────────────────────

const ServiceRow = ({
  id,
  label,
  status,
}: {
  id: string;
  label: string;
  status: ServiceStatus;
}) => {
  const cfg    = STATUS_CONFIG[status];
  const { Icon } = cfg;
  const ServiceIcon = SERVICE_ICONS[id] ?? Server;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
          <ServiceIcon className="h-4.5 w-4.5 text-slate-500 dark:text-slate-400" />
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      </div>
      <div className={cn('flex items-center gap-2 rounded-full border px-3 py-1', cfg.bg, cfg.border)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
        <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
        <span className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</span>
      </div>
    </motion.div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function StatusPage() {
  const [data, setData]         = useState<StatusResponse | null>(null);
  const [error, setError]       = useState(false);
  const [loading, setLoading]   = useState(true);
  const [lastChecked, setLastChecked] = useState<string>('');
  const [refreshing, setRefreshing]   = useState(false);

  const baseURL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:5001/api';

  const fetchStatus = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`${baseURL}/status`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Non-OK response');
      const json: StatusResponse = await res.json();
      setData(json);
      setError(false);
      setLastChecked(new Date().toISOString());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, [baseURL]);

  // Initial fetch + auto-refresh every 30 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => fetchStatus(), 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const overallStatus: ServiceStatus = loading ? 'loading' : error ? 'outage' : (data?.status ?? 'outage');

  const services = data
    ? [
        { id: 'api',      ...data.services.api },
        { id: 'database', ...data.services.database },
        { id: 'realtime', ...data.services.realtime },
      ]
    : [
        { id: 'api',      label: 'API Server',              status: 'loading' as ServiceStatus },
        { id: 'database', label: 'Database',                status: 'loading' as ServiceStatus },
        { id: 'realtime', label: 'Real-time (WebSocket)',   status: 'loading' as ServiceStatus },
      ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">TaskFlow Status</h1>
            <p className="text-xs text-slate-400">Real-time service health</p>
          </div>
          <a
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Back to app
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex flex-col gap-6">

          {/* Overall banner */}
          <AnimatePresence mode="wait">
            <OverallBanner key={overallStatus} status={overallStatus} />
          </AnimatePresence>

          {/* Service list */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Services</h2>
            {services.map((svc, i) => (
              <motion.div
                key={svc.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <ServiceRow id={svc.id} label={svc.label} status={svc.status as ServiceStatus} />
              </motion.div>
            ))}
          </div>

          {/* Uptime + last checked */}
          {data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="text-xs text-slate-400">Server uptime</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {formatUptime(data.uptime)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Last checked</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {lastChecked ? formatTime(lastChecked) : '—'}
                </p>
              </div>
            </motion.div>
          )}

          {/* Manual refresh */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Auto-refreshes every 30 seconds</p>
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
