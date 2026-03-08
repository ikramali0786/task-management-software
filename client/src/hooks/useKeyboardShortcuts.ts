import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface Options {
  onToggleShortcuts: () => void;
  onToggleSidebar: () => void;
  /** Called when ⌘K is pressed — opens the global search modal */
  onOpenSearch?: () => void;
  /** Called when N is pressed — opens the quick-create task modal */
  onOpenQuickCreate?: () => void;
}

/** Returns true when the user is actively typing in a form element */
const isTyping = (): boolean => {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (el as HTMLElement).isContentEditable ||
    (el as HTMLElement).getAttribute('role') === 'textbox'
  );
};

/**
 * Global keyboard shortcuts hook.
 * Attach once in AppLayout (or any top-level component that persists across routes).
 *
 * Shortcut map:
 *   ?         → show shortcuts help modal
 *   [         → toggle sidebar (collapse on desktop / open-close on mobile)
 *   D         → Dashboard
 *   B         → Board
 *   L         → Calendar
 *   C         → AI Chatbots
 *   T         → Team
 *   W         → Workload
 *   A         → Activity
 *   S         → Settings
 *   N         → quick-create task modal
 *   ⌘/Ctrl+K  → global search modal
 */
export const useKeyboardShortcuts = ({
  onToggleShortcuts,
  onToggleSidebar,
  onOpenSearch,
  onOpenQuickCreate,
}: Options) => {
  const navigate = useNavigate();

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const isCtrlCmd = e.ctrlKey || e.metaKey;

      // ⌘K / Ctrl+K — global search (fires even while typing so user can always search)
      if (isCtrlCmd && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        onOpenSearch?.();
        return;
      }

      // All other shortcuts: never fire while the user is typing
      if (isTyping()) return;
      if (isCtrlCmd) return; // ignore other Ctrl/Cmd combos

      switch (e.key) {
        case '?':
          onToggleShortcuts();
          break;
        case '[':
          onToggleSidebar();
          break;
        case 'd':
        case 'D':
          navigate('/');
          break;
        case 'b':
        case 'B':
          navigate('/board');
          break;
        case 'l':
        case 'L':
          navigate('/calendar');
          break;
        case 't':
        case 'T':
          navigate('/team');
          break;
        case 'w':
        case 'W':
          navigate('/workload');
          break;
        case 'a':
        case 'A':
          navigate('/activity');
          break;
        case 'c':
        case 'C':
          navigate('/chatbots');
          break;
        case 's':
        case 'S':
          navigate('/settings');
          break;
        case 'n':
        case 'N':
          onOpenQuickCreate?.();
          break;
        default:
          break;
      }
    },
    [navigate, onToggleShortcuts, onToggleSidebar, onOpenSearch, onOpenQuickCreate]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);
};
