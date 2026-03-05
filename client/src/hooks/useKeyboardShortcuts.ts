import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface Options {
  onToggleShortcuts: () => void;
  onToggleSidebar: () => void;
  /** Called when N is pressed — intended to open a new-task form on the Board */
  onNewTask?: () => void;
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
 *   [         → toggle sidebar
 *   D         → Dashboard
 *   B         → Board
 *   C         → AI Chatbots
 *   T         → Team
 *   W         → Workload
 *   A         → Activity
 *   S         → Settings
 *   N         → trigger onNewTask callback
 *   Ctrl/⌘+K  → jump to Board (quick-open)
 */
export const useKeyboardShortcuts = ({
  onToggleShortcuts,
  onToggleSidebar,
  onNewTask,
}: Options) => {
  const navigate = useNavigate();

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      // Never fire while the user is typing
      if (isTyping()) return;

      const isCtrlCmd = e.ctrlKey || e.metaKey;

      if (isCtrlCmd) {
        if (e.key === 'k' || e.key === 'K') {
          e.preventDefault();
          navigate('/board');
        }
        return; // ignore other Ctrl/Cmd combos
      }

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
          onNewTask?.();
          break;
        default:
          break;
      }
    },
    [navigate, onToggleShortcuts, onToggleSidebar, onNewTask]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);
};
