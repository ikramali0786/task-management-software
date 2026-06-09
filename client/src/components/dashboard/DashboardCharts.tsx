import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis,
} from 'recharts';
import { PRIORITY_CONFIG, TASK_STATUSES } from '@/types';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  todo: '#a89f8f', in_progress: '#0d9488', review: '#d97706', done: '#16a34a',
};

interface Props {
  trend: { date: string; count: number }[];
  range: 7 | 30 | 90;
  onRangeChange: (r: 7 | 30 | 90) => void;
  pieData: { name: string; value: number; color: string }[];
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  totalTasks: number;
}

/**
 * Recharts-backed dashboard charts. Lazy-loaded so the heavy charting library
 * isn't in the dashboard's critical path — cards & tasks paint first.
 */
export const DashboardCharts = ({ trend, range, onRangeChange, pieData, statusCounts, priorityCounts, totalTasks }: Props) => {
  const trendTotal = trend.reduce((s, d) => s + d.count, 0);
  return (
    <div className="flex flex-col gap-6">
      {/* Completion Trend + range toggle */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Completion Trend</h3>
          <span className="text-xs font-semibold text-brand-500">{trendTotal} done</span>
        </div>
        <div className="mb-2 flex items-center gap-1">
          {([7, 30, 90] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors', range === r ? 'bg-brand-500 text-white' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}
            >
              {r}d
            </button>
          ))}
        </div>
        <div role="img" aria-label={`Completion trend, last ${range} days: ${trendTotal} tasks completed`} />
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={trend} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#e8502e" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#e8502e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={Math.max(1, Math.floor(trend.length / 6))} />
            <Tooltip contentStyle={{ background: 'var(--bg-glass)', border: 'none', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [v, 'Completed']} />
            <Area type="monotone" dataKey="count" stroke="#e8502e" strokeWidth={2} fill="url(#trendGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Task Status donut */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Task Status</h3>
        {pieData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-glass)', border: 'none', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-1 space-y-1.5">
              {TASK_STATUSES.map(({ id, label }) => {
                const count = statusCounts[id] ?? 0;
                const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                return (
                  <div key={id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[id] }} />
                      <span className="text-slate-500 dark:text-slate-400">{label}</span>
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{count} <span className="text-slate-400">({pct}%)</span></span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex h-36 items-center justify-center text-sm text-slate-400">No tasks yet</div>
        )}
      </motion.div>

      {/* By Priority */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card">
        <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-slate-100">By Priority</h3>
        <div className="space-y-3">
          {(['urgent', 'high', 'medium', 'low'] as const).map((p) => {
            const config = PRIORITY_CONFIG[p];
            const count = priorityCounts[p] ?? 0;
            const pct = totalTasks > 0 ? (count / totalTasks) * 100 : 0;
            return (
              <div key={p}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-400">{config.label}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.6, type: 'spring', stiffness: 200 }} className="h-full rounded-full" style={{ backgroundColor: config.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardCharts;
