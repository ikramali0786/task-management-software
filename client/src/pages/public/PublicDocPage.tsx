import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Zap, Loader2 } from 'lucide-react';
import { publicService, type PublicDocData } from '@/services/publicService';

const md = {
  h1: (p: any) => <h1 className="mb-3 mt-7 text-2xl font-bold text-slate-900 first:mt-0" {...p} />,
  h2: (p: any) => <h2 className="mb-2 mt-6 text-xl font-bold text-slate-900 first:mt-0" {...p} />,
  h3: (p: any) => <h3 className="mb-2 mt-4 text-base font-semibold text-slate-900" {...p} />,
  p: (p: any) => <p className="mb-3 leading-relaxed text-slate-700" {...p} />,
  ul: (p: any) => <ul className="mb-3 ml-5 list-disc space-y-1 text-slate-700" {...p} />,
  ol: (p: any) => <ol className="mb-3 ml-5 list-decimal space-y-1 text-slate-700" {...p} />,
  li: (p: any) => <li className="leading-relaxed" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-slate-900" {...p} />,
  a: (p: any) => <a className="font-medium text-brand-600 underline-offset-2 hover:underline" target="_blank" rel="noreferrer" {...p} />,
  blockquote: (p: any) => <blockquote className="mb-3 border-l-2 border-brand-300 pl-3 italic text-slate-500" {...p} />,
  code: ({ inline, ...p }: any) => inline
    ? <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-brand-600" {...p} />
    : <code className="font-mono text-sm" {...p} />,
  pre: (p: any) => <pre className="mb-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-sm text-slate-100" {...p} />,
  hr: () => <hr className="my-5 border-slate-200" />,
  table: (p: any) => <div className="mb-3 overflow-x-auto"><table className="w-full border-collapse text-sm" {...p} /></div>,
  th: (p: any) => <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left font-semibold" {...p} />,
  td: (p: any) => <td className="border border-slate-200 px-2 py-1" {...p} />,
  input: (p: any) => <input className="mr-1 accent-brand-500" disabled {...p} />,
};

export const PublicDocPage = () => {
  const { token } = useParams();
  const [data, setData] = useState<PublicDocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    publicService.getDoc(token).then(setData).catch(() => setNotFound(true)).finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#faf8f4]"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (notFound || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f4] px-5 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Page unavailable</h1>
          <p className="mt-2 text-sm text-slate-500">This shared page doesn’t exist or has been turned off.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8f4] text-slate-900">
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg gradient-brand"><Zap className="h-4 w-4 text-white" /></span>
          <span className="text-sm font-semibold text-slate-700">{data.team}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Read-only</span>
          <span className="ml-auto text-xs text-slate-400">Powered by <Link to="/" className="font-medium text-brand-600 hover:underline">TaskFlow</Link></span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="text-4xl leading-none">{data.icon}</span>
          <h1 className="text-3xl font-bold text-slate-900">{data.title}</h1>
        </div>
        {data.content.trim()
          ? <div className="text-[15px]"><ReactMarkdown remarkPlugins={[remarkGfm]} components={md as any}>{data.content}</ReactMarkdown></div>
          : <p className="text-sm text-slate-400">This page is empty.</p>}
      </main>
    </div>
  );
};
