import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { aiService } from '@/services/aiService';
import { useUIStore } from '@/store/uiStore';

interface Props {
  teamId: string;
}

// Minimal Markdown element styling (no typography plugin in this project).
const mdComponents = {
  h1: (p: any) => <p className="mb-1 mt-3 text-sm font-bold text-slate-900 dark:text-slate-100" {...p} />,
  h2: (p: any) => <p className="mb-1 mt-3 text-sm font-bold text-slate-900 dark:text-slate-100" {...p} />,
  h3: (p: any) => <p className="mb-1 mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100" {...p} />,
  p: (p: any) => <p className="mb-2 leading-relaxed" {...p} />,
  ul: (p: any) => <ul className="mb-2 ml-4 list-disc space-y-1" {...p} />,
  ol: (p: any) => <ol className="mb-2 ml-4 list-decimal space-y-1" {...p} />,
  li: (p: any) => <li className="leading-snug" {...p} />,
  strong: (p: any) => <strong className="font-semibold text-slate-900 dark:text-slate-100" {...p} />,
  code: (p: any) => <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] dark:bg-slate-800" {...p} />,
};

export const AiSummaryCard = ({ teamId }: Props) => {
  const { addToast } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const text = await aiService.summary(teamId, 7);
      setSummary(text);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code !== 'PLAN_LIMIT') {
        addToast({
          type: 'error',
          title: "Couldn't generate summary",
          message: code === 'NO_AI_KEY'
            ? 'Add an OpenAI key in Team Settings → AI & API.'
            : err?.response?.data?.message || 'Please try again.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="gradient-brand flex h-9 w-9 items-center justify-center rounded-xl">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Weekly AI summary</h3>
            <p className="text-xs text-slate-400">A standup-style digest of the last 7 days.</p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : summary ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? 'Generating…' : summary ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {summary && (
        <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-slate-700/60 dark:text-slate-300">
          <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {summary}
          </Markdown>
        </div>
      )}
    </div>
  );
};
