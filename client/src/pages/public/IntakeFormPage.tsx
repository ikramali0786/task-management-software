import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Zap, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { publicService, type PublicFormInfo } from '@/services/publicService';

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15';

export const IntakeFormPage = () => {
  const { token } = useParams();
  const [form, setForm] = useState<PublicFormInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState({ name: '', email: '', summary: '', details: '', company: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    publicService.getForm(token)
      .then(setForm)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const valid = values.name.trim() && /\S+@\S+\.\S+/.test(values.email) && values.summary.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !valid || sending) return;
    setSending(true); setError(null);
    try {
      await publicService.submitForm(token, values);
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f4] text-slate-900">
      <header className="border-b border-slate-200/70">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2.5 px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand"><Zap className="h-4 w-4 text-white" /></span>
          <span className="font-bold gradient-text">TaskFlow</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-12">
        {loading ? (
          <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-400" /></div>
        ) : notFound || !form ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <h1 className="font-display text-2xl font-bold">Form unavailable</h1>
            <p className="mt-2 text-sm text-slate-500">This intake form doesn’t exist or has been turned off.</p>
          </div>
        ) : sent ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <h1 className="font-display text-2xl font-bold">Request received</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              Thanks, {values.name.split(' ')[0] || 'there'} — the {form.team} team has your request and will follow up.
            </p>
          </div>
        ) : (
          <>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand-600">{form.team}</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">{form.title}</h1>
            {form.intro && <p className="mt-3 whitespace-pre-wrap text-slate-600">{form.intro}</p>}

            <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Your name</label>
                  <input className={inputCls} value={values.name} onChange={set('name')} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                  <input className={inputCls} type="email" value={values.email} onChange={set('email')} placeholder="you@company.com" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Summary</label>
                <input className={inputCls} value={values.summary} onChange={set('summary')} placeholder="A short title for your request" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Details</label>
                <textarea className={inputCls} rows={5} value={values.details} onChange={set('details')} placeholder="Anything that helps us understand the request…" />
              </div>
              <input type="text" tabIndex={-1} autoComplete="off" value={values.company} onChange={set('company')} className="hidden" aria-hidden="true" />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={!valid || sending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-ember transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Submitting…' : 'Submit request'}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-slate-400">
              Powered by <Link to="/" className="font-medium text-brand-600 hover:underline">TaskFlow</Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
};
