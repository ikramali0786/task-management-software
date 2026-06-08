import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, Loader2, CheckCircle2, MessageSquare, BookOpen } from 'lucide-react';
import { supportService } from '@/services/supportService';
import { Eyebrow } from '@/components/marketing/Eyebrow';
import { Reveal } from '@/components/marketing/motion';

export const ContactPage = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', company: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email) && form.subject.trim() && form.message.trim().length >= 10;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || sending) return;
    setSending(true);
    setError(null);
    try {
      await supportService.contact(form);
      setSent(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong. Please email us directly.');
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

  return (
    <section className="mx-auto max-w-5xl px-5 py-16 md:py-20">
      <Reveal className="grid gap-10 md:grid-cols-2">
        {/* Left: intro + quick links */}
        <div>
          <Eyebrow>Support</Eyebrow>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight md:text-5xl">Get in touch</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Questions about plans, a bug to report, or feedback? Send us a message and we’ll get back to you.
          </p>
          <div className="mt-8 space-y-3">
            <Link to="/help" className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-500/40">
              <BookOpen className="h-5 w-5 text-brand-500" />
              <div>
                <p className="text-sm font-semibold">Browse the help center</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Guides and answers to common questions.</p>
              </div>
            </Link>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <MessageSquare className="h-5 w-5 text-brand-500" />
              <div>
                <p className="text-sm font-semibold">Typical response time</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Within 1–2 business days.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: form / success */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          {sent ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-500" />
              <h2 className="text-lg font-semibold">Message sent</h2>
              <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                Thanks for reaching out — we’ll reply to <span className="font-medium text-slate-700 dark:text-slate-200">{form.email}</span> soon.
              </p>
              <Link to="/" className="mt-6 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">Back to home</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
                  <input className={inputCls} value={form.name} onChange={set('name')} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Email</label>
                  <input className={inputCls} type="email" value={form.email} onChange={set('email')} placeholder="you@company.com" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Subject</label>
                <input className={inputCls} value={form.subject} onChange={set('subject')} placeholder="How can we help?" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Message</label>
                <textarea className={inputCls} rows={5} value={form.message} onChange={set('message')} placeholder="Tell us a bit more…" />
              </div>
              {/* Honeypot — hidden from users, catches bots */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.company}
                onChange={set('company')}
                className="hidden"
                aria-hidden="true"
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                disabled={!valid || sending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-ember transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? 'Sending…' : 'Send message'}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
                <Mail className="h-3 w-3" /> We’ll only use your email to reply.
              </p>
            </form>
          )}
        </div>
      </Reveal>
    </section>
  );
};
