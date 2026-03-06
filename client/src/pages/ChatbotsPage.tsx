import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Plus, Send, Settings2, Trash2, X, RotateCcw, AlertTriangle,
  ChevronDown, Save, Loader2, Sparkles,
} from 'lucide-react';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { chatbotService } from '@/services/chatbotService';
import { Chatbot, ChatMessage } from '@/types';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const EMOJI_PICKS = [
  '🤖','🧠','💡','📊','📝','🚀','🔍','⚡','🎯','💬',
  '🛠️','📋','🗂️','✅','💻','📈','🔥','🌟','🎨','🔧',
];

const COLOR_PICKS = ['indigo','violet','blue','sky','emerald','teal','amber','rose','orange','pink'];

const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (fast)' },
  { value: 'gpt-4o', label: 'GPT-4o (best)' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (legacy)' },
];

const COLOR_CLASSES: Record<string, { bg: string; text: string; ring: string }> = {
  indigo: { bg: 'bg-indigo-500',   text: 'text-indigo-600 dark:text-indigo-400',  ring: 'ring-indigo-400' },
  violet: { bg: 'bg-violet-500',   text: 'text-violet-600 dark:text-violet-400',  ring: 'ring-violet-400' },
  blue:   { bg: 'bg-blue-500',     text: 'text-blue-600 dark:text-blue-400',      ring: 'ring-blue-400' },
  sky:    { bg: 'bg-sky-500',      text: 'text-sky-600 dark:text-sky-400',        ring: 'ring-sky-400' },
  emerald:{ bg: 'bg-emerald-500',  text: 'text-emerald-600 dark:text-emerald-400',ring: 'ring-emerald-400' },
  teal:   { bg: 'bg-teal-500',     text: 'text-teal-600 dark:text-teal-400',      ring: 'ring-teal-400' },
  amber:  { bg: 'bg-amber-500',    text: 'text-amber-600 dark:text-amber-400',    ring: 'ring-amber-400' },
  rose:   { bg: 'bg-rose-500',     text: 'text-rose-600 dark:text-rose-400',      ring: 'ring-rose-400' },
  orange: { bg: 'bg-orange-500',   text: 'text-orange-600 dark:text-orange-400',  ring: 'ring-orange-400' },
  pink:   { bg: 'bg-pink-500',     text: 'text-pink-600 dark:text-pink-400',      ring: 'ring-pink-400' },
};

// ── Typing indicator ──────────────────────────────────────────────────────────

const TypingIndicator = () => (
  <div className="flex items-end gap-2">
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
      <Bot className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
    </div>
    <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3 dark:bg-slate-800">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ── Bot Drawer (create / edit) ────────────────────────────────────────────────

interface BotDrawerProps {
  bot: Chatbot | null; // null = create mode
  teamId: string;
  onSave: (bot: Chatbot) => void;
  onDelete: (botId: string) => void;
  onClose: () => void;
}

const BotDrawer = ({ bot, teamId, onSave, onDelete, onClose }: BotDrawerProps) => {
  const { showConfirm, addToast } = useUIStore();
  const [name, setName] = useState(bot?.name || '');
  const [icon, setIcon] = useState(bot?.icon || '🤖');
  const [color, setColor] = useState(bot?.color || 'indigo');
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
        <h3 className="flex-1 text-base font-semibold text-slate-900 dark:text-white">
          {bot ? 'Edit Bot' : 'New Bot'}
        </h3>
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
                  icon === e
                    ? 'bg-brand-100 ring-2 ring-brand-400 dark:bg-brand-500/20'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
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
                className={cn(
                  'h-6 w-6 rounded-full transition-all',
                  COLOR_CLASSES[c]?.bg || 'bg-slate-400',
                  color === c ? 'ring-2 ring-offset-2 ring-brand-400' : ''
                )}
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
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? 'Saving…' : 'Save Bot'}
        </button>
      </div>
    </motion.div>
  );
};

// ── Main ChatbotsPage ─────────────────────────────────────────────────────────

export const ChatbotsPage = () => {
  const { activeTeam } = useTeamStore();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();

  const [bots, setBots] = useState<Chatbot[]>([]);
  const [loadingBots, setLoadingBots] = useState(true);
  const [selectedBot, setSelectedBot] = useState<Chatbot | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [noKeyError, setNoKeyError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<Chatbot | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentMember = activeTeam?.members.find((m) => m.user._id === user?._id);
  const isOwner = activeTeam?.owner._id === user?._id;
  const isAdmin = isOwner || currentMember?.role === 'admin';

  // Load bots
  useEffect(() => {
    if (!activeTeam) return;
    setLoadingBots(true);
    chatbotService.getChatbots(activeTeam._id)
      .then((data) => setBots(data))
      .catch(() => addToast({ type: 'error', title: 'Failed to load chatbots' }))
      .finally(() => setLoadingBots(false));
  }, [activeTeam?._id]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, sending]);

  const handleSelectBot = (bot: Chatbot) => {
    setSelectedBot(bot);
    setChatHistory([]);
    setNoKeyError(false);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedBot || !activeTeam || sending) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setInput('');
    setSending(true);
    setNoKeyError(false);

    try {
      const reply = await chatbotService.sendMessage(selectedBot._id, activeTeam._id, newHistory);
      setChatHistory([...newHistory, reply]);
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || '';
      if (status === 400 && msg.toLowerCase().includes('api key')) {
        setNoKeyError(true);
      } else {
        addToast({ type: 'error', title: 'Failed to get response', message: msg || 'Please try again.' });
      }
      // Remove the user message we added optimistically if send failed
      setChatHistory(chatHistory);
    } finally {
      setSending(false);
    }
  }, [input, selectedBot, activeTeam, sending, chatHistory, addToast]);

  const handleDrawerSave = (saved: Chatbot) => {
    setBots((prev) => {
      const exists = prev.find((b) => b._id === saved._id);
      return exists ? prev.map((b) => (b._id === saved._id ? saved : b)) : [saved, ...prev];
    });
    if (selectedBot?._id === saved._id) setSelectedBot(saved);
  };

  const handleDrawerDelete = (botId: string) => {
    setBots((prev) => prev.filter((b) => b._id !== botId));
    if (selectedBot?._id === botId) { setSelectedBot(null); setChatHistory([]); }
  };

  const openCreate = () => { setEditingBot(null); setDrawerOpen(true); };
  const openEdit = (bot: Chatbot) => { setEditingBot(bot); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingBot(null); };

  const colorClasses = selectedBot ? (COLOR_CLASSES[selectedBot.color] || COLOR_CLASSES['indigo']) : COLOR_CLASSES['indigo'];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <Bot className="h-5 w-5 text-brand-500" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">AI Chatbots</h1>
        <div className="flex-1" />
        {isAdmin && (
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            New Bot
          </button>
        )}
      </div>

      {/* Body */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR */}
        <div className="flex w-72 flex-shrink-0 flex-col border-r border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex-1 overflow-y-auto p-3">
            {loadingBots ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              </div>
            ) : bots.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Sparkles className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-400">No bots yet</p>
                {isAdmin && (
                  <button
                    onClick={openCreate}
                    className="mt-1 text-xs font-medium text-brand-500 hover:text-brand-600"
                  >
                    Create your first bot →
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {bots.map((bot) => {
                  const cc = COLOR_CLASSES[bot.color] || COLOR_CLASSES['indigo'];
                  const isSelected = selectedBot?._id === bot._id;
                  return (
                    <button
                      key={bot._id}
                      onClick={() => handleSelectBot(bot)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-lg',
                          isSelected ? cc.bg + ' text-white' : 'bg-slate-100 dark:bg-slate-800'
                        )}
                      >
                        {bot.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          'truncate text-sm font-semibold',
                          isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-800 dark:text-slate-100'
                        )}>
                          {bot.name}
                        </p>
                        {bot.description && (
                          <p className="truncate text-xs text-slate-400">{bot.description}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isAdmin && bots.length > 0 && (
            <div className="flex-shrink-0 border-t border-slate-100 p-3 dark:border-slate-800">
              <button
                onClick={openCreate}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-2 text-xs font-medium text-slate-400 transition-colors hover:border-brand-300 hover:text-brand-500 dark:border-slate-700 dark:hover:border-brand-700"
              >
                <Plus className="h-3.5 w-3.5" />
                New Bot
              </button>
            </div>
          )}
        </div>

        {/* MAIN CHAT AREA */}
        <div className="flex flex-1 flex-col bg-slate-50 dark:bg-slate-950">
          {!selectedBot ? (
            /* No bot selected hero */
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center p-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-brand shadow-lg shadow-brand-500/20">
                <Bot className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Pick a Bot to Start</h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  {bots.length === 0
                    ? isAdmin
                      ? 'Create your first AI chatbot to get started.'
                      : 'No chatbots available yet. Ask an admin to create one.'
                    : 'Select a bot from the sidebar to begin a conversation.'}
                </p>
              </div>
              {isAdmin && bots.length === 0 && (
                <button
                  onClick={openCreate}
                  className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
                >
                  <Plus className="h-4 w-4" />
                  Create First Bot
                </button>
              )}
            </div>
          ) : (
            /* Chat UI */
            <>
              {/* Chat header */}
              <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-900">
                <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-xl', colorClasses.bg, 'text-white')}>
                  {selectedBot.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{selectedBot.name}</h3>
                  <p className="text-xs text-slate-400 truncate">{selectedBot.description || selectedBot.model}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {chatHistory.length > 0 && (
                    <button
                      onClick={() => { setChatHistory([]); setNoKeyError(false); }}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      title="Clear conversation"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Clear
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => openEdit(selectedBot)}
                      className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      title="Edit bot"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* No API key error banner */}
              <AnimatePresence>
                {noKeyError && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-5 py-3 dark:border-amber-800/30 dark:bg-amber-500/10">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        No OpenAI API key configured. Ask an admin to add one in{' '}
                        <strong>Team → Settings → AI & API Keys</strong>.
                      </p>
                      <button onClick={() => setNoKeyError(false)} className="ml-auto flex-shrink-0 text-amber-400 hover:text-amber-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {chatHistory.length === 0 && !sending && (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <span className={cn('flex h-14 w-14 items-center justify-center rounded-2xl text-3xl', colorClasses.bg, 'text-white')}>
                      {selectedBot.icon}
                    </span>
                    <h4 className="text-base font-semibold text-slate-700 dark:text-slate-200">{selectedBot.name}</h4>
                    <p className="max-w-xs text-sm text-slate-400">
                      {selectedBot.description || 'Start a conversation below.'}
                    </p>
                  </div>
                )}

                {chatHistory.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn('flex items-end gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}
                  >
                    {msg.role === 'assistant' && (
                      <div className={cn('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-base', colorClasses.bg, 'text-white')}>
                        {selectedBot.icon}
                      </div>
                    )}
                    <div
                      className={cn(
                        'max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                        msg.role === 'user'
                          ? 'rounded-br-sm bg-brand-500 text-white'
                          : 'rounded-bl-sm bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                      )}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}

                {sending && <TypingIndicator />}
                <div ref={chatEndRef} />
              </div>

              {/* Input bar */}
              <div className="flex-shrink-0 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-end gap-3">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={1}
                    placeholder={`Message ${selectedBot.name}… (Ctrl+Enter to send)`}
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    style={{ maxHeight: '120px', overflowY: 'auto' }}
                    onInput={(e) => {
                      const t = e.target as HTMLTextAreaElement;
                      t.style.height = 'auto';
                      t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className={cn(
                      'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white transition-all',
                      input.trim() && !sending
                        ? colorClasses.bg + ' hover:opacity-90'
                        : 'bg-slate-200 dark:bg-slate-700'
                    )}
                    title="Send (Ctrl+Enter)"
                  >
                    {sending
                      ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      : <Send className="h-4 w-4" />
                    }
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-slate-300 dark:text-slate-600">
                  Conversations are not saved — they reset when you leave this page.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Bot Drawer overlay */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={closeDrawer}
                className="absolute inset-0 z-10 bg-black/30 backdrop-blur-sm"
              />
              <BotDrawer
                bot={editingBot}
                teamId={activeTeam!._id}
                onSave={handleDrawerSave}
                onDelete={handleDrawerDelete}
                onClose={closeDrawer}
              />
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
