import { Link } from 'react-router-dom';
import { Check, Minus, Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { FEATURE_MATRIX, PLAN_PRICES } from '@/lib/plans';
import { Eyebrow } from '@/components/marketing/Eyebrow';
import { Reveal, StaggerGroup, StaggerItem } from '@/components/marketing/motion';

const TIERS = [
  {
    key: 'free' as const,
    name: 'Free',
    price: 0,
    tagline: 'For individuals and small teams getting started.',
    highlights: ['Up to 5 members', '1 team', 'Kanban, calendar & list views', '50 AI messages / mo'],
    cta: 'Start free',
    featured: false,
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: PLAN_PRICES.pro.monthly,
    tagline: 'For growing teams that need automation and AI.',
    highlights: ['Unlimited members & teams', 'Automations & custom fields', 'API, webhooks & Slack', '2,000 AI messages / mo'],
    cta: 'Choose Pro',
    featured: true,
  },
  {
    key: 'business' as const,
    name: 'Business',
    price: PLAN_PRICES.business.monthly,
    tagline: 'For organizations that need control and scale.',
    highlights: ['Everything in Pro', 'Advanced analytics & audit log', 'SSO / SAML', '10,000 AI messages / mo'],
    cta: 'Choose Business',
    featured: false,
  },
];

const cell = (val: string, accent = false) =>
  val === '—' ? (
    <Minus className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-600" />
  ) : val === 'Included' ? (
    <Check className={`mx-auto h-4 w-4 ${accent ? 'text-brand-500' : 'text-emerald-500'}`} />
  ) : (
    <span className={accent ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}>{val}</span>
  );

export const PricingPage = () => {
  const { isAuthenticated, user } = useAuthStore();
  const loggedIn = isAuthenticated && user;
  const ctaHref = (tier: string) =>
    loggedIn ? `/app/settings?billing=plans` : tier === 'free' ? '/register' : `/register?plan=${tier}`;

  return (
    <>
      <section className="mk-grain relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-500/[0.06] to-transparent" />
        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-8 pt-16 text-center md:pt-24">
          <div className="flex justify-center"><Eyebrow>Pricing</Eyebrow></div>
          <h1 className="mt-4 font-display text-5xl font-extrabold tracking-tight md:text-6xl">
            Scales <span className="mk-underline">with your team</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            Per-seat, billed monthly. Cancel anytime. Start free and upgrade when you’re ready.
          </p>
        </div>
      </section>

      {/* Tier cards */}
      <StaggerGroup className="mx-auto grid max-w-6xl gap-5 px-5 pb-14 lg:grid-cols-3">
        {TIERS.map((t) => (
          <StaggerItem
            key={t.key}
            hover
            className={`relative flex flex-col rounded-2xl border p-6 ${
              t.featured
                ? 'border-brand-300 bg-white shadow-ember dark:border-brand-500/40 dark:bg-slate-900'
                : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
            }`}
          >
            {t.featured && (
              <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                <Sparkles className="h-3 w-3" /> Most popular
              </span>
            )}
            <h2 className="text-lg font-bold">{t.name}</h2>
            <p className="mt-1 min-h-[40px] text-sm text-slate-500 dark:text-slate-400">{t.tagline}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-4xl font-extrabold">${t.price}</span>
              <span className="text-sm text-slate-400">{t.price === 0 ? 'forever' : '/ seat / mo'}</span>
            </div>
            <ul className="mt-5 space-y-2.5">
              {t.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" /> {h}
                </li>
              ))}
            </ul>
            <Link
              to={ctaHref(t.key)}
              className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${
                t.featured
                  ? 'text-white shadow-ember'
                  : 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200'
              }`}
              style={t.featured ? { background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' } : undefined}
            >
              {loggedIn ? 'Go to billing' : t.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>

      {/* Comparison table */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <h2 className="mb-6 text-center font-display text-2xl font-bold tracking-tight">Compare every feature</h2>
        <Reveal className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <th className="px-4 py-3 text-left font-semibold text-slate-500">Feature</th>
                <th className="px-4 py-3 text-center font-semibold">Free</th>
                <th className="px-4 py-3 text-center font-semibold">Pro</th>
                <th className="px-4 py-3 text-center font-semibold text-brand-600 dark:text-brand-400">Business</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row) => (
                <tr key={row.label} className="border-b border-slate-100 last:border-0 dark:border-slate-800/60">
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.label}</td>
                  <td className="px-4 py-3 text-center">{cell(row.free)}</td>
                  <td className="px-4 py-3 text-center">{cell(row.pro)}</td>
                  <td className="px-4 py-3 text-center">{cell(row.business, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Questions about plans? <Link to="/contact" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">Talk to us →</Link>
        </p>
      </section>
    </>
  );
};
