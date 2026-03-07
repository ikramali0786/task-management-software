import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, Play, Pause, Trash2, Target } from 'lucide-react';
import { TimeEntry } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import api from '@/services/api';
import { cn } from '@/lib/utils';

interface Props {
  taskId: string;
  timeEntries: TimeEntry[];
  estimatedMinutes: number | null;
  onChange: (entries: TimeEntry[], estimatedMinutes: number | null) => void;
}

const STORAGE_KEY = (taskId: string) => `tf_timer_${taskId}`;

const fmtMins = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtTimer = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const TimeTracker = ({ taskId, timeEntries, estimatedMinutes, onChange }: Props) => {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  // ── Timer state (stored in localStorage so it survives modal re-mounts) ──
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const startRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Manual log state ─────────────────────────────────────────────────────
  const [showLog, setShowLog] = useState(false);
  const [logHours, setLogHours] = useState('');
  const [logMins, setLogMins] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logging, setLogging] = useState(false);

  // ── Estimate edit ────────────────────────────────────────────────────────
  const [editEstimate, setEditEstimate] = useState(false);
  const [estHours, setEstHours] = useState('');
  const [estMins, setEstMins] = useState('');
  const [savingEst, setSavingEst] = useState(false);

  // Restore timer from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY(taskId));
    if (saved) {
      try {
        const { startedAt } = JSON.parse(saved);
        const secs = Math.floor((Date.now() - startedAt) / 1000);
        startRef.current = startedAt;
        setElapsed(secs);
        setRunning(true);
      } catch {
        localStorage.removeItem(STORAGE_KEY(taskId));
      }
    }
  }, [taskId]);

  // Interval tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (startRef.current ?? Date.now())) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const startTimer = () => {
    const now = Date.now();
    startRef.current = now;
    localStorage.setItem(STORAGE_KEY(taskId), JSON.stringify({ startedAt: now }));
    setRunning(true);
  };

  const stopTimer = async () => {
    setRunning(false);
    localStorage.removeItem(STORAGE_KEY(taskId));
    const minutes = Math.max(1, Math.round(elapsed / 60));
    setElapsed(0);
    await logTimeEntry(minutes, 'Timer');
  };

  const logTimeEntry = async (minutes: number, note: string) => {
    try {
      const res = await api.post(`/tasks/${taskId}/time`, { minutes, note });
      onChange(res.data.data.timeEntries, estimatedMinutes);
    } catch {
      addToast({ type: 'error', title: 'Failed to log time' });
    }
  };

  const handleManualLog = async () => {
    const h = parseInt(logHours || '0');
    const m = parseInt(logMins || '0');
    const total = h * 60 + m;
    if (total < 1) return;
    setLogging(true);
    try {
      const res = await api.post(`/tasks/${taskId}/time`, { minutes: total, note: logNote || '' });
      onChange(res.data.data.timeEntries, estimatedMinutes);
      setLogHours(''); setLogMins(''); setLogNote(''); setShowLog(false);
      addToast({ type: 'success', title: 'Time logged' });
    } catch {
      addToast({ type: 'error', title: 'Failed to log time' });
    } finally {
      setLogging(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const res = await api.delete(`/tasks/${taskId}/time/${entryId}`);
      onChange(res.data.data.timeEntries, estimatedMinutes);
    } catch {
      addToast({ type: 'error', title: 'Failed to delete entry' });
    }
  };

  const handleSaveEstimate = async () => {
    const h = parseInt(estHours || '0');
    const m = parseInt(estMins || '0');
    const total = h * 60 + m || null;
    setSavingEst(true);
    try {
      const res = await api.patch(`/tasks/${taskId}/estimate`, { estimatedMinutes: total });
      onChange(timeEntries, res.data.data.estimatedMinutes);
      setEditEstimate(false);
    } catch {
      addToast({ type: 'error', title: 'Failed to update estimate' });
    } finally {
      setSavingEst(false);
    }
  };

  const totalLogged = timeEntries.reduce((sum, e) => sum + e.minutes, 0);
  const progress = estimatedMinutes ? Math.min(100, Math.round((totalLogged / estimatedMinutes) * 100)) : null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Time Tracking</span>
      </div>

      {/* Progress bar (when estimate set) */}
      {estimatedMinutes && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{fmtMins(totalLogged)} logged</span>
            <span>{fmtMins(estimatedMinutes)} estimated</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                progress !== null && progress >= 100 ? 'bg-red-400' : 'bg-brand-500'
              )}
              style={{ width: `${Math.min(100, progress ?? 0)}%` }}
            />
          </div>
          {progress !== null && (
            <p className="text-[10px] text-slate-400">{progress}% of estimate used</p>
          )}
        </div>
      )}

      {/* Timer + quick actions */}
      <div className="flex items-center gap-2">
        {/* Start/Stop timer */}
        <button
          onClick={running ? stopTimer : startTimer}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
            running
              ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400'
              : 'bg-brand-50 text-brand-600 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400'
          )}
        >
          {running ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {running ? fmtTimer(elapsed) : 'Start timer'}
        </button>

        {/* Manual log */}
        <button
          onClick={() => setShowLog((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
        >
          <Plus className="h-3 w-3" />
          Log time
        </button>

        {/* Set estimate */}
        <button
          onClick={() => {
            if (estimatedMinutes) {
              setEstHours(String(Math.floor(estimatedMinutes / 60)));
              setEstMins(String(estimatedMinutes % 60));
            }
            setEditEstimate((v) => !v);
          }}
          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
        >
          <Target className="h-3 w-3" />
          {estimatedMinutes ? `Est: ${fmtMins(estimatedMinutes)}` : 'Set estimate'}
        </button>
      </div>

      {/* Manual log form */}
      <AnimatePresence>
        {showLog && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" max="99" placeholder="0"
                  value={logHours}
                  onChange={(e) => setLogHours(e.target.value)}
                  className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-center dark:border-slate-700 dark:bg-slate-700 dark:text-white"
                />
                <span className="text-xs text-slate-400">h</span>
                <input
                  type="number" min="0" max="59" placeholder="0"
                  value={logMins}
                  onChange={(e) => setLogMins(e.target.value)}
                  className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-center dark:border-slate-700 dark:bg-slate-700 dark:text-white"
                />
                <span className="text-xs text-slate-400">m</span>
              </div>
              <input
                type="text" placeholder="Note (optional)"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                className="flex-1 min-w-[120px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-700 dark:text-white"
              />
              <button
                onClick={handleManualLog}
                disabled={logging || (parseInt(logHours || '0') * 60 + parseInt(logMins || '0')) < 1}
                className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-40"
              >
                {logging ? '…' : 'Log'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estimate form */}
      <AnimatePresence>
        {editEstimate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <input
                type="number" min="0" max="999" placeholder="0"
                value={estHours}
                onChange={(e) => setEstHours(e.target.value)}
                className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-center dark:border-slate-700 dark:bg-slate-700 dark:text-white"
              />
              <span className="text-xs text-slate-400">h</span>
              <input
                type="number" min="0" max="59" placeholder="0"
                value={estMins}
                onChange={(e) => setEstMins(e.target.value)}
                className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-center dark:border-slate-700 dark:bg-slate-700 dark:text-white"
              />
              <span className="text-xs text-slate-400">m</span>
              <button
                onClick={handleSaveEstimate}
                disabled={savingEst}
                className="ml-1 rounded-lg bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-40"
              >
                {savingEst ? '…' : 'Save'}
              </button>
              {estimatedMinutes && (
                <button
                  onClick={() => { setEstHours(''); setEstMins(''); handleSaveEstimate(); }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time log list */}
      {timeEntries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {fmtMins(totalLogged)} total · {timeEntries.length} entr{timeEntries.length > 1 ? 'ies' : 'y'}
          </p>
          {timeEntries.map((entry) => (
            <div
              key={entry._id}
              className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <Clock className="h-3 w-3 flex-shrink-0 text-slate-300 dark:text-slate-600" />
              <span className="min-w-[40px] text-xs font-semibold text-slate-700 dark:text-slate-300">
                {fmtMins(entry.minutes)}
              </span>
              {entry.note && (
                <span className="flex-1 truncate text-xs text-slate-400">{entry.note}</span>
              )}
              <span className="text-[10px] text-slate-300 dark:text-slate-600 flex-shrink-0">
                {entry.user?.name || ''}
              </span>
              {entry.user?._id === user?._id && (
                <button
                  onClick={() => handleDeleteEntry(entry._id)}
                  className="text-slate-300 hover:text-red-400 dark:text-slate-600"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
