import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Search, Users, CreditCard, CheckCircle2, XCircle, Mail,
  Loader2, X, Crown, Building2, BadgeCheck, Clock,
} from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { Avatar } from '@/components/ui/Avatar';
import {
  adminService,
  type AdminStats,
  type AdminUserRow,
  type AdminUserDetail,
} from '@/services/adminService';

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  pro: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  business: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};
const STATUS_BADGE: Record<string, string> = {
  active: 'text-emerald-600 dark:text-emerald-400',
  past_due: 'text-amber-600 dark:text-amber-400',
  canceled: 'text-slate-400',
};

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

// ── Stat card ────────────────────────────────────────────────────────────────
const Stat = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: React.ReactNode; sub?: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-center gap-2 text-slate-400">
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
    </div>
    <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
    {sub && <p className="text-xs text-slate-400">{sub}</p>}
  </div>
);

// ── User detail drawer ───────────────────────────────────────────────────────
const UserDrawer = ({ userId, onClose }: { userId: string; onClose: () => void }) => {
  const { addToast } = useUIStore();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    adminService.getUser(userId).then(setDetail).catch(() => addToast({ type: 'error', title: 'Failed to load user' })).finally(() => setLoading(false));
  }, [userId, addToast]);
  useEffect(() => { load(); }, [load]);

  const changePlan = async (teamId: string, plan: 'free' | 'pro' | 'business') => {
    setBusy(teamId);
    try {
      const updated = await adminService.setTeamPlan(teamId, plan);
      setDetail((d) => d && { ...d, teams: d.teams.map((t) => t.id === teamId ? { ...t, plan: updated.plan as any, planStatus: updated.planStatus as any } : t) });
      addToast({ type: 'success', title: 'Plan updated', message: `Set to ${plan}.` });
    } catch (e: any) {
      addToast({ type: 'error', title: "Couldn't update plan", message: e?.response?.data?.message });
    } finally { setBusy(null); }
  };

  const act = async (kind: 'resend' | 'verify') => {
    if (!detail) return;
    setBusy(kind);
    try {
      if (kind === 'resend') { await adminService.resendVerification(detail._id); addToast({ type: 'success', title: 'Verification email sent' }); }
      else { await adminService.forceVerify(detail._id); setDetail({ ...detail, emailVerified: true }); addToast({ type: 'success', title: 'User marked verified' }); }
    } catch (e: any) {
      addToast({ type: 'error', title: 'Action failed', message: e?.response?.data?.message });
    } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">User details</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>

        {loading || !detail ? (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
        ) : (
          <div className="space-y-5 p-5">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <Avatar name={detail.name} src={detail.avatar} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{detail.name}</p>
                <p className="truncate text-sm text-slate-500">{detail.email}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {detail.emailVerified
                    ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span>
                    : <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Clock className="h-3.5 w-3.5" /> Unverified</span>}
                  {detail.twoFactorEnabled && <span className="text-slate-400">· 2FA on</span>}
                </div>
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-slate-400">Joined</p><p className="text-slate-700 dark:text-slate-200">{fmtDate(detail.createdAt)}</p></div>
              <div><p className="text-xs text-slate-400">Last seen</p><p className="text-slate-700 dark:text-slate-200">{fmtDate(detail.lastSeenAt)}</p></div>
              <div><p className="text-xs text-slate-400">Assigned tasks</p><p className="text-slate-700 dark:text-slate-200">{detail.assignedTasks}</p></div>
              <div><p className="text-xs text-slate-400">Timezone</p><p className="truncate text-slate-700 dark:text-slate-200">{detail.timezone || 'UTC'}</p></div>
            </div>

            {/* Support actions */}
            {!detail.emailVerified && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => act('resend')} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  {busy === 'resend' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />} Resend verification
                </button>
                <button onClick={() => act('verify')} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  {busy === 'verify' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Mark verified
                </button>
              </div>
            )}

            {/* Teams + plan override */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Teams ({detail.teams.length})</p>
              <div className="space-y-2">
                {detail.teams.map((t) => (
                  <div key={t.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {t.isOwner && <Crown className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />}{t.name}
                        </p>
                        <p className="text-xs text-slate-400">{t.memberCount} member{t.memberCount !== 1 ? 's' : ''} · {t.role || 'guest'} · <span className={STATUS_BADGE[t.planStatus]}>{t.planStatus}</span></p>
                      </div>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-semibold capitalize ${PLAN_BADGE[t.plan]}`}>{t.plan}</span>
                    </div>
                    {t.isOwner && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-slate-400">Override plan</span>
                        <select
                          value={t.plan}
                          disabled={busy === t.id}
                          onChange={(e) => changePlan(t.id, e.target.value as any)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="business">Business</option>
                        </select>
                        {busy === t.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                      </div>
                    )}
                  </div>
                ))}
                {detail.teams.length === 0 && <p className="text-sm text-slate-400">No teams.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────
export const AdminPage = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { adminService.stats().then(setStats).catch(() => {}); }, []);

  // Debounced search.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      adminService.listUsers(q).then((r) => { if (active) setUsers(r.users); }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [q]);

  if (!user?.isSuperAdmin) {
    return (
      <PageContainer width="default">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <XCircle className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">Admin access required</h1>
          <p className="mt-1 text-sm text-slate-500">This area is restricted to TaskFlow staff.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer width="full">
      <PageHeader icon={ShieldCheck} title="Admin & Support" description="Internal tools — handle with care." />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat icon={Users} label="Users" value={stats?.users ?? '—'} sub={stats ? `${stats.verifiedUsers} verified` : undefined} />
        <Stat icon={CreditCard} label="Paid teams" value={stats?.paidTeams ?? '—'} sub={stats ? `${stats.byPlan.pro} pro · ${stats.byPlan.business} biz` : undefined} />
        <Stat icon={Building2} label="Teams" value={stats?.teams ?? '—'} />
        <Stat icon={CheckCircle2} label="Tasks" value={stats?.tasks ?? '—'} />
        <Stat icon={Clock} label="New (7d)" value={stats?.signups7 ?? '—'} sub={stats ? `${stats.signups30} in 30d` : undefined} />
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users by name, email or username…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {/* User list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/50">
              <th className="px-4 py-2.5 font-semibold">User</th>
              <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Status</th>
              <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Teams</th>
              <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No users found.</td></tr>
            ) : users.map((u) => (
              <tr key={u._id} onClick={() => setSelected(u._id)} className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={u.name} src={u.avatar} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900 dark:text-slate-100">{u.name}</p>
                      <p className="truncate text-xs text-slate-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-2.5 sm:table-cell">
                  {u.emailVerified
                    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><Clock className="h-3.5 w-3.5" /> Unverified</span>}
                </td>
                <td className="hidden px-4 py-2.5 text-slate-500 md:table-cell">{u.ownedTeams} owned</td>
                <td className="hidden px-4 py-2.5 text-slate-500 md:table-cell">{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <UserDrawer userId={selected} onClose={() => setSelected(null)} />}
    </PageContainer>
  );
};
