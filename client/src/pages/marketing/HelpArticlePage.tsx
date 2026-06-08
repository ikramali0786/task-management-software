import { Link, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { findArticle, HELP_ARTICLES } from '@/lib/helpContent';

const mdComponents = {
  h2: (p: any) => <h2 className="mb-3 mt-6 font-display text-2xl font-bold tracking-tight first:mt-0" {...p} />,
  h3: (p: any) => <h3 className="mb-2 mt-5 text-lg font-semibold" {...p} />,
  p: (p: any) => <p className="mb-4 leading-relaxed text-slate-600 dark:text-slate-300" {...p} />,
  ul: (p: any) => <ul className="mb-4 ml-5 list-disc space-y-1.5 text-slate-600 dark:text-slate-300" {...p} />,
  ol: (p: any) => <ol className="mb-4 ml-5 list-decimal space-y-1.5 text-slate-600 dark:text-slate-300" {...p} />,
  li: (p: any) => <li className="leading-relaxed" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-slate-900 dark:text-slate-100" {...p} />,
  code: (p: any) => <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-brand-700 dark:bg-slate-800 dark:text-brand-300" {...p} />,
  a: (p: any) => <a className="font-medium text-brand-600 hover:underline dark:text-brand-400" {...p} />,
};

export const HelpArticlePage = () => {
  const { slug } = useParams();
  const article = slug ? findArticle(slug) : undefined;

  if (!article) {
    return (
      <section className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">Article not found</h1>
        <p className="mt-2 text-slate-500">This help article doesn’t exist or was moved.</p>
        <Link to="/help" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
          <ArrowLeft className="h-4 w-4" /> Back to help center
        </Link>
      </section>
    );
  }

  const related = HELP_ARTICLES.filter((a) => a.category === article.category && a.slug !== article.slug).slice(0, 3);

  return (
    <section className="mx-auto max-w-3xl px-5 py-14">
      <Link to="/help" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-brand-600 dark:hover:text-brand-400">
        <ArrowLeft className="h-4 w-4" /> Help center
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-brand-500">{article.category}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">{article.title}</h1>

      <article className="mt-8 text-[15px]">
        <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>{article.body}</Markdown>
      </article>

      {related.length > 0 && (
        <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-800">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Related</h2>
          <div className="space-y-2">
            {related.map((a) => (
              <Link key={a.slug} to={`/help/${a.slug}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 transition-colors hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-500/40">
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{a.title}</span>
                <ArrowRight className="h-4 w-4 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12 rounded-2xl bg-slate-100 p-6 text-center dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-300">Didn’t find what you needed?</p>
        <Link to="/contact" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Contact support <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
};
