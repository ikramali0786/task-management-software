import { motion } from 'framer-motion';
import { Bot, Sparkles, FileText, BarChart2, Code2, MessageSquare, ExternalLink } from 'lucide-react';

interface BotCard {
  icon: React.ElementType;
  name: string;
  description: string;
  color: string;
  bg: string;
}

const BOTS: BotCard[] = [
  {
    icon: MessageSquare,
    name: 'Task Assistant',
    description: 'Ask questions about your tasks, deadlines, and priorities. Get instant answers about what needs attention.',
    color: 'text-brand-600 dark:text-brand-400',
    bg: 'bg-brand-50 dark:bg-brand-500/10',
  },
  {
    icon: FileText,
    name: 'Meeting Summarizer',
    description: 'Paste any meeting transcript and get a clean summary with key decisions and action items.',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-500/10',
  },
  {
    icon: BarChart2,
    name: 'Progress Reporter',
    description: 'Generate weekly or sprint team status reports automatically based on your task data.',
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-500/10',
  },
  {
    icon: Code2,
    name: 'Code Review Bot',
    description: 'Paste code snippets and get a review aligned with your team\'s standards and best practices.',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 28 } },
};

export const ChatbotsPage = () => {
  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10 text-center"
      >
        <div className="mb-4 inline-flex items-center justify-center rounded-2xl gradient-brand p-4 shadow-lg shadow-brand-500/20">
          <Bot className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">AI Chatbots</h1>
        <p className="mt-2 text-slate-500">
          Supercharge your workflow with purpose-built AI assistants.
        </p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-800/40 dark:bg-amber-500/10 dark:text-amber-400">
          <Sparkles className="h-3.5 w-3.5" />
          Powered by OpenAI · Coming Soon
        </div>
      </motion.div>

      {/* Bot Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2"
      >
        {BOTS.map((bot) => {
          const Icon = bot.icon;
          return (
            <motion.div
              key={bot.name}
              variants={item}
              className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Coming soon badge */}
              <span className="absolute right-3 top-3 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Coming Soon
              </span>

              <div className={`mb-4 inline-flex rounded-xl p-3 ${bot.bg}`}>
                <Icon className={`h-6 w-6 ${bot.color}`} />
              </div>

              <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">
                {bot.name}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {bot.description}
              </p>

              <div className="mt-5">
                <button
                  disabled
                  title="Feature roadmap Q3 2026"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400 cursor-not-allowed dark:border-slate-700 dark:text-slate-500"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open Chat
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Footer CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 rounded-2xl border border-brand-100 bg-brand-50/50 p-6 text-center dark:border-brand-800/30 dark:bg-brand-500/5"
      >
        <Sparkles className="mx-auto mb-3 h-6 w-6 text-brand-400" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Want to suggest a bot?
        </h3>
        <p className="mt-1 text-xs text-slate-400">
          AI Chatbots are on our roadmap for Q3 2026. More features coming as we grow.
        </p>
        <button
          disabled
          title="Feature roadmap Q3 2026"
          className="mt-4 rounded-lg border border-brand-200 bg-white px-4 py-2 text-xs font-medium text-brand-500 opacity-50 cursor-not-allowed dark:border-brand-800 dark:bg-transparent dark:text-brand-400"
        >
          Request a Bot
        </button>
      </motion.div>
    </div>
  );
};
