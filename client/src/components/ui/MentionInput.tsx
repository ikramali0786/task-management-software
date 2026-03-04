import { useState, useRef } from 'react';
import { User } from '@/types';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange?: (userIds: string[]) => void;
  members: User[];
  placeholder?: string;
  rows?: number;
  className?: string;
  onBlur?: () => void;
}

export const extractMentions = (text: string, members: User[]): string[] => {
  const regex = /@(\w+)/g;
  const matched: string[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    const handle = m[1].toLowerCase();
    const member = members.find(
      (u) =>
        u.username?.toLowerCase() === handle ||
        u.name.toLowerCase().replace(/\s+/g, '') === handle
    );
    if (member) matched.push(member._id);
  }
  return [...new Set(matched)];
};

export const MentionInput = ({
  value,
  onChange,
  onMentionsChange,
  members,
  placeholder = 'Write something… use @ to mention teammates',
  rows = 4,
  className,
  onBlur,
}: MentionInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const filteredMembers =
    mentionQuery !== null
      ? members
          .filter((u) => {
            const q = mentionQuery.toLowerCase();
            return (
              u.name.toLowerCase().includes(q) ||
              (u.username && u.username.toLowerCase().includes(q))
            );
          })
          .slice(0, 5)
      : [];

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onChange(text);

    const cursor = e.target.selectionStart;
    const textBefore = text.slice(0, cursor);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(cursor - match[0].length);
      setShowDropdown(true);
      setFocusedIndex(0);
    } else {
      setMentionQuery(null);
      setShowDropdown(false);
    }

    if (onMentionsChange) {
      onMentionsChange(extractMentions(text, members));
    }
  };

  const selectMember = (member: User) => {
    const handle = member.username || member.name.replace(/\s+/g, '');
    const cursorPos = textareaRef.current?.selectionStart ?? mentionStart + (mentionQuery?.length ?? 0) + 1;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursorPos);
    const newValue = `${before}@${handle} ${after}`;
    onChange(newValue);
    if (onMentionsChange) {
      onMentionsChange(extractMentions(newValue, members));
    }
    setShowDropdown(false);
    setMentionQuery(null);
    setTimeout(() => {
      textareaRef.current?.focus();
      const pos = mentionStart + handle.length + 2;
      textareaRef.current?.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filteredMembers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filteredMembers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredMembers[focusedIndex]) {
        e.preventDefault();
        selectMember(filteredMembers[focusedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleBlur = () => {
    // Delay so onMouseDown in dropdown fires first
    setTimeout(() => {
      setShowDropdown(false);
      onBlur?.();
    }, 150);
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          'w-full resize-none rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
          className
        )}
      />

      {showDropdown && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {filteredMembers.map((member, i) => (
            <button
              key={member._id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selectMember(member);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                i === focusedIndex
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700'
              )}
            >
              <Avatar name={member.name} src={member.avatar} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                {member.username && (
                  <p className="truncate text-xs text-slate-400">@{member.username}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
