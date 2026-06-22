import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Globe, Palette, Check } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { LANGUAGES } from '@/i18n';
import { cn } from '@/lib/utils';
import { Theme } from '@/types';

const themeOptions: { value: Theme; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, desc: 'Clean and bright' },
  { value: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
  { value: 'system', label: 'System', icon: Monitor, desc: 'Follows your OS' },
];

export const AppearanceSettings = () => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useUIStore();

  return (
    <div className="card">
      {/* Card header */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
          <Palette className="h-5 w-5 text-brand-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('settings.theme')}</h3>
          <p className="text-xs text-slate-400">{t('settings.themeHint')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {themeOptions.map(({ value, label, icon: Icon, desc }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={cn(
                'relative flex flex-col items-center gap-3 rounded-2xl border py-5 text-center transition-all duration-150',
                active
                  ? 'border-brand-400 bg-brand-50 shadow-soft dark:border-brand-500/50 dark:bg-brand-500/10'
                  : 'border-slate-200 bg-slate-50/60 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-soft dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-slate-600'
              )}
            >
              {active && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 shadow-sm shadow-brand-500/30">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}
              <div className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                active ? 'bg-brand-100 dark:bg-brand-500/20' : 'bg-slate-200 dark:bg-slate-700'
              )}>
                <Icon className={cn(
                  'h-5 w-5',
                  active ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
                )} />
              </div>
              <div>
                <p className={cn(
                  'text-sm font-semibold',
                  active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'
                )}>{label}</p>
                <p className="mt-0.5 text-xs text-slate-400">{desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Language */}
      <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Globe className="h-4 w-4 text-slate-400" /> {t('settings.language')}
        </h3>
        <p className="mb-3 text-xs text-slate-400">{t('settings.languageHint')}</p>
        <select
          value={i18n.resolvedLanguage}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="input-field"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
