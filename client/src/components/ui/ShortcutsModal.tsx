import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard } from 'lucide-react';

// ── Shortcuts data ────────────────────────────────────────────────────────────

const sections: { title: string; shortcuts: { keys: string[]; description: string }[] }[] = [
  {
    title: 'Navigate',
    shortcuts: [
      { keys: ['D'], description: 'Go to Dashboard' },
      { keys: ['B'], description: 'Go to Kanban Board' },
      { keys: ['T'], description: 'Go to Team' },
      { keys: ['W'], description: 'Go to Workload' },
      { keys: ['A'], description: 'Go to Activity' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['N'], description: 'New task (on Board page)' },
      { keys: ['['], description: 'Toggle sidebar' },
      { keys: ['Ctrl', 'K'], description: 'Open Board (quick jump)' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['Esc'], description: 'Close modal / panel' },
      { keys: ['?'], description: 'Show this help' },
    ],
  },
];

// ── Key badge ─────────────────────────────────────────────────────────────────

const Key = ({ k }: { k: string }) => (
  <kbd className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1.5 font-mono text-xs font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
    {k}
  </kbd>
);

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal = ({ isOpen, onClose }: Props) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-brand-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sections */}
            <div className="divide-y divide-slate-50 px-5 dark:divide-slate-800/60">
              {sections.map((section) => (
                <div key={section.title} className="py-3.5">
                  <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {section.title}
                  </p>
                  <div className="space-y-2">
                    {section.shortcuts.map((s) => (
                      <div
                        key={s.description}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {s.description}
                        </span>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          {s.keys.map((k, i) => (
                            <>
                              {i > 0 && (
                                <span key={`plus-${i}`} className="text-xs text-slate-300">+</span>
                              )}
                              <Key key={k} k={k} />
                            </>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 pb-4 pt-1">
              <p className="text-center text-xs text-slate-400">
                Shortcuts are disabled while typing in text fields
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
