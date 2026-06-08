import { useEffect, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
} from 'recharts';
import { BarChart2, Loader2, Sparkles, TrendingUp, CheckCircle2, Timer } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { useUIStore } from '@/store/uiStore';
import { taskService } from '@/services/taskService';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

type Analytics = Awaited<ReturnType<typeof taskService.getAnalytics>>;

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444', high: '#f97316', medium: '#e8502e', low: '#a89f8f',
};

const Gate = () => {
  const openUpgrade = useUIStore((s) => s.openUpgrade);
  return (
    <div className="card flex flex-col items-center gap-4 py-12 text-center">
      <div className="gradient-brand inline-flex h-12 w-12 items-center justify-center rounded-xl">
        <BarChart2 className="h-6 w-6 text-white" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Advanced analytics is a Business feature</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          Throughput, completion rate, cycle time, delivery trends, and top contributors. Available on the Business plan.
        </p>
      </div>
      <Button onClick={() => openUpgrade('advancedAnalytics')} className="gap-2">
        <Sparkles className="h-4 w-4" /> Upgrade to Business
      </Button>
    </div>
  );
};

const StatTile = ({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/40">
    <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${accent}1a`, color: accent }}>
      <Icon className="h-4 w-4" />
    </div>
    <p className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
    <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
  </div>
);

export const AnalyticsPanel = ({ teamId }: { teamId: string }) => {
  const { can } = usePlan();
  const { addToast } = useUIStore();
  const hasFeature = can('advancedAnalytics');
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!hasFeature) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    taskService.getAnalytics(teamId, days)
      .then((d) => active && setData(d))
      .catch(() => active && addToast({ type: 'error', title: 'Failed to load analytics' }))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [teamId, days, hasFeature]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hasFeature) return <Gate />;
  if (loading) return <div className="card py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-400" /></div>;
  if (!data) return null;

  const priorityData = (['urgent', 'high', 'medium', 'low'] as const).map((p) => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    key: p,
    value: data.byPriority[p] || 0,
  }));
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <BarChart2 className="h-4 w-4 text-brand-500" /> Advanced analytics
        </h2>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile icon={TrendingUp} label={`Completed · ${days}d`} value={String(data.throughput)} accent="#e8502e" />
        <StatTile icon={CheckCircle2} label="Completion rate" value={`${data.completionRate}%`} accent="#22c55e" />
        <StatTile icon={Timer} label="Avg cycle time" value={data.avgCycleDays != null ? `${data.avgCycleDays}d` : '—'} accent="#0d9488" />
      </div>

      {/* Delivery trend */}
      <div className="card">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Created vs. completed</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.series} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a89f8f" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#a89f8f" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e8502e" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#e8502e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d7" strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#a89f8f' }} interval="preserveStartEnd" minTickGap={28} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#a89f8f' }} width={28} />
            <Tooltip
              labelFormatter={(l) => fmtDate(l as string)}
              contentStyle={{ borderRadius: 12, border: '1px solid #e7e1d7', fontSize: 12 }}
            />
            <Area type="monotone" dataKey="created" stroke="#a89f8f" strokeWidth={2} fill="url(#gCreated)" name="Created" />
            <Area type="monotone" dataKey="completed" stroke="#e8502e" strokeWidth={2} fill="url(#gCompleted)" name="Completed" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Priority breakdown */}
        <div className="card">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Open tasks by priority</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e1d7" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a89f8f' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#a89f8f' }} width={28} />
              <Tooltip cursor={{ fill: 'rgba(232,80,46,0.06)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e7e1d7', fontSize: 12 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {priorityData.map((d) => <Cell key={d.key} fill={PRIORITY_COLOR[d.key]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top contributors */}
        <div className="card">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Top contributors · {days}d</p>
          {data.topContributors.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No completed tasks in this period.</p>
          ) : (
            <div className="space-y-2.5">
              {data.topContributors.map((c) => {
                const max = data.topContributors[0].completed || 1;
                return (
                  <div key={c.id} className="flex items-center gap-3">
                    <Avatar name={c.name} src={c.avatar} size="xs" />
                    <span className="w-28 flex-shrink-0 truncate text-sm text-slate-700 dark:text-slate-200">{c.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round((c.completed / max) * 100)}%` }} />
                    </div>
                    <span className="w-6 flex-shrink-0 text-right font-mono text-xs text-slate-500">{c.completed}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
