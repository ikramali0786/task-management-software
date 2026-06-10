import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Trash2, Save, ChevronDown } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { chatbotService } from '@/services/chatbotService';
import { Button } from '@/components/ui/Button';
import { Chatbot } from '@/types';
import { cn } from '@/lib/utils';
import { EMOJI_PICKS, COLOR_PICKS, MODEL_OPTIONS, COLOR_CLASSES } from '@/lib/chatbotUtils';

interface BotDrawerProps {
  bot: Chatbot | null;
  teamId: string;
  onSave: (bot: Chatbot) => void;
  onDelete: (botId: string) => void;
  onClose: () => void;
}

export const BotDrawer = ({ bot, teamId, onSave, onDelete, onClose }: BotDrawerProps) => {
  const { showConfirm, addToast } = useUIStore();
  const [name, setName] = useState(bot?.name || '');
  const [icon, setIcon] = useState(bot?.icon || '🤖');
  const [color, setColor] = useState(bot?.color || 'ember');
  const [description, setDescription] = useState(bot?.description || '');
  const [model, setModel] = useState<string>(bot?.model || 'gpt-4o-mini');
  const [systemPrompt, setSystemPrompt] = useState(bot?.systemPrompt || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const modelVal = model as 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo';
      if (bot) {
        const updated = await chatbotService.updateChatbot(bot._id, { name: name.trim(), icon, color, description, model: modelVal, systemPrompt });
        onSave(updated);
      } else {
        const created = await chatbotService.createChatbot({ teamId, name: name.trim(), icon, color, description, model: modelVal, systemPrompt });
        onSave(created);
      }
      addToast({ type: 'success', title: bot ? 'Bot updated' : 'Bot created' });
      onClose();
    } catch {
      addToast({ type: 'error', title: 'Failed to save bot' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!bot) return;
    const ok = await showConfirm({ title: 'Delete Bot', message: `Delete "${bot.name}"? This cannot be undone.`, confirmLabel: 'Delete', variant: 'danger' });
    if (!ok) return;
    setDeleting(true);
    try {
      await chatbotService.deleteChatbot(bot._id);
      onDelete(bot._id);
      addToast({ type: 'success', title: 'Bot deleted' });
      onClose();
    } catch {
      addToast({ type: 'error', title: 'Failed to delete bot' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 350, damping: 35 }}
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
    >
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <h3 className="flex-1 text-base font-semibold text-slate-900 dark:text-slate-100">{bot ? 'Edit Bot' : 'New Bot'}</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Name */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="e.g. Task Helper"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </div>

        {/* Icon picker */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Icon</label>
          <div className="grid grid-cols-10 gap-1.5">
            {EMOJI_PICKS.map((e) => (
              <button
                key={e}
                onClick={() => setIcon(e)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-all',
                  icon === e ? 'bg-brand-100 ring-2 ring-brand-400 dark:bg-brand-500/20' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PICKS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={c}
                className={cn('h-6 w-6 rounded-full transition-all', COLOR_CLASSES[c]?.bg || 'bg-slate-400', color === c ? 'ring-2 ring-offset-2 ring-brand-400' : '')}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="What does this bot do?"
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <p className="mt-1 text-right text-xs text-slate-400">{description.length}/200</p>
        </div>

        {/* Model */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">Model</label>
          <div className="relative">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-8 text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            maxLength={4000}
            placeholder="You are a helpful assistant that specializes in…"
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm text-slate-800 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <p className="mt-1 text-right text-xs text-slate-400">{systemPrompt.length}/4000</p>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex flex-shrink-0 items-center gap-2 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
        {bot && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800/40 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <Button onClick={handleSave} disabled={saving || !name.trim()} isLoading={saving}>
          {!saving && <Save className="h-3.5 w-3.5" />}
          {saving ? 'Saving…' : 'Save Bot'}
        </Button>
      </div>
    </motion.div>
  );
};
