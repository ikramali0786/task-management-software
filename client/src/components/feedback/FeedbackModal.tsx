import { useState } from 'react';
import { Bug, Lightbulb, MessageSquare, Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { supportService } from '@/services/supportService';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'bug', label: 'Bug', icon: Bug, placeholder: 'What happened, and what did you expect instead?' },
  { id: 'idea', label: 'Idea', icon: Lightbulb, placeholder: 'What would make TaskFlow better for you?' },
  { id: 'other', label: 'Other', icon: MessageSquare, placeholder: 'Share anything on your mind…' },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

/**
 * In-app feedback — posts to the existing /support/contact endpoint (→ the
 * support inbox), pre-filled with the logged-in user's name + email. Built for
 * the beta round so testers can send notes without leaving the app.
 */
export const FeedbackModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [category, setCategory] = useState<CategoryId>('idea');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const trimmed = message.trim();
  const canSend = trimmed.length >= 10 && !sending;
  const active = CATEGORIES.find((c) => c.id === category)!;

  const submit = async () => {
    if (!canSend || !user) return;
    setSending(true);
    try {
      await supportService.contact({
        name: user.name,
        email: user.email,
        subject: `Beta feedback · ${active.label}`,
        message: trimmed,
        company: '',
      });
      addToast({ type: 'success', title: 'Thanks for the feedback! 🙏', message: 'It went straight to the team.' });
      setMessage('');
      setCategory('idea');
      onClose();
    } catch (err: any) {
      addToast({ type: 'error', title: "Couldn't send feedback", message: err?.response?.data?.message || 'Please try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Send feedback" size="md">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Found a bug or have an idea? Tell us — it goes straight to the team, and we read every message.
        </p>

        <div className="flex gap-2">
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                category === id
                  ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={5000}
            autoFocus
            placeholder={active.placeholder}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
            <span className="truncate">Sending as {user?.email}</span>
            <span className="shrink-0">{trimmed.length < 10 ? `${10 - trimmed.length} more character${10 - trimmed.length === 1 ? '' : 's'}` : `${message.length}/5000`}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <Button onClick={submit} disabled={!canSend} isLoading={sending} className="gap-1.5">
            {!sending && <Send className="h-3.5 w-3.5" />} Send feedback
          </Button>
        </div>
      </div>
    </Modal>
  );
};
