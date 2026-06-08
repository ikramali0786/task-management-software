import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Zap, Loader2, Hash } from 'lucide-react';
import { publicService, type PublicBoardData } from '@/services/publicService';
import { TASK_STATUSES } from '@/types';

const PRIORITY_DOT: Record<string, string> = { urgent: '#ef4444', high: '#f97316', medium: '#e8502e', low: '#a89f8f' };

export const PublicBoardPage = () => {
  const { token } = useParams();
  const [data, setData] = useState<PublicBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    publicService.getBoard(token)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#faf8f4]"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }
  if (notFound || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f4] px-5 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Board unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">This shared board doesn’t exist or has been turned off.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f4] text-slate-900">
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand"><Zap className="h-4 w-4 text-white" /></span>
          <span className="text-sm font-semibold text-slate-700">{data.team}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Read-only</span>
          <span className="ml-auto text-xs text-slate-400">Powered by <Link to="/" className="font-medium text-brand-600 hover:underline">TaskFlow</Link></span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl overflow-x-auto p-5">
        <div className="flex gap-4">
          {TASK_STATUSES.map((col) => {
            const items = data.tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className="w-72 flex-shrink-0">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500">{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((t) => (
                    <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-soft">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_DOT[t.priority] }} />
                        {t.identifier != null && (
                          <span className="flex items-center gap-0.5 font-mono text-[10px] text-slate-400"><Hash className="h-2.5 w-2.5" />{t.identifier}</span>
                        )}
                      </div>
                      <p className="text-sm font-medium leading-snug text-slate-800">{t.title}</p>
                      {t.assignees.length > 0 && (
                        <div className="mt-2.5 flex -space-x-1.5">
                          {t.assignees.slice(0, 4).map((a, i) =>
                            a.avatar ? (
                              <img key={i} src={a.avatar} alt={a.name} className="h-5 w-5 rounded-full border border-white object-cover" />
                            ) : (
                              <span key={i} className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-brand-500/15 text-[9px] font-semibold text-brand-600">
                                {a.name.charAt(0).toUpperCase()}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11px] text-slate-300">Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
};
