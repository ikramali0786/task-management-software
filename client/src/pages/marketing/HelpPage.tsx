import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ArrowRight, LifeBuoy } from 'lucide-react';
import { HELP_ARTICLES, HELP_CATEGORIES } from '@/lib/helpContent';
import { Eyebrow } from '@/components/marketing/Eyebrow';

export const HelpPage = () => {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return HELP_ARTICLES;
    return HELP_ARTICLES.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.excerpt.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query)
    );
  }, [query]);

  return (
    <>
      <section className="mk-grain relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-3xl px-5 pb-12 pt-16 text-center md:pt-20">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl gradient-brand">
            <LifeBuoy className="h-6 w-6 text-white" />
          </div>
          <div className="flex justify-center"><Eyebrow>Help center</Eyebrow></div>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-5xl">How can we help?</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">Search our guides, or browse by topic below.</p>
          <div className="relative mx-auto mt-6 max-w-xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search help articles…"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        {query ? (
          <>
            <p className="mb-5 text-sm text-slate-500">{filtered.length} result{filtered.length === 1 ? '' : 's'} for “{q}”</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((a) => (
                <ArticleCard key={a.slug} slug={a.slug} title={a.title} excerpt={a.excerpt} />
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-slate-400">No articles found. Try a different search, or <Link to="/contact" className="font-medium text-brand-600 hover:underline dark:text-brand-400">contact us</Link>.</p>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-10">
            {HELP_CATEGORIES.map((cat) => {
              const items = HELP_ARTICLES.filter((a) => a.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <h2 className="mb-4 font-display text-xl font-bold tracking-tight">{cat}</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {items.map((a) => (
                      <ArticleCard key={a.slug} slug={a.slug} title={a.title} excerpt={a.excerpt} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-display text-xl font-bold tracking-tight">Still need a hand?</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Our team is happy to help with anything not covered here.</p>
          <Link to="/contact" className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-ember transition-transform hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#e8502e 0%,#f97316 55%,#fb923c 100%)' }}>
            Contact support <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
};

const ArticleCard = ({ slug, title, excerpt }: { slug: string; title: string; excerpt: string }) => (
  <Link to={`/help/${slug}`} className="group rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500/40">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">{title}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{excerpt}</p>
      </div>
      <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
    </div>
  </Link>
);
