import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';

interface Props {
  trend: { date: string; count: number }[];
  range: 7 | 30 | 90;
  onRangeChange: (r: 7 | 30 | 90) => void;
}

/** Lazy-loaded so recharts isn't in the dashboard's critical path. */
export const TrendChart = ({ trend, range, onRangeChange }: Props) => {
  const total = trend.reduce((s, d) => s + d.count, 0);
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Completion Trend</h3>
        <span className="text-xs font-semibold text-brand-500">{total} done</span>
      </div>
      <div className="mb-2 flex items-center gap-1">
        {([7, 30, 90] as const).map((r) => (
          <button key={r} onClick={() => onRangeChange(r)} className={cn('rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors', range === r ? 'bg-brand-500 text-white' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800')}>{r}d</button>
        ))}
      </div>
      <div role="img" aria-label={`Completion trend, last ${range} days: ${total} tasks completed`} />
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
    </>
  );
};

export default TrendChart;
