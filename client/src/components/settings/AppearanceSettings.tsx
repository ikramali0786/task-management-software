import { useTranslation } from 'react-i18next';
import { Sun, Moon, Monitor, Globe } from 'lucide-react';
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
      <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{t('settings.theme')}</h3>
      <p className="mb-5 text-xs text-slate-400">{t('settings.themeHint')}</p>
      <div className="grid grid-cols-3 gap-3">
        {themeOptions.map(({ value, label, icon: Icon, desc }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              'flex flex-col items-center gap-3 rounded-xl border py-5 text-center transition-all',
              theme === value
                ? 'border-brand-400 bg-brand-50 dark:border-brand-600 dark:bg-brand-500/10'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600'
            )}
          >
            <div className={cn(
              'rounded-lg p-2',
              theme === value ? 'bg-brand-100 dark:bg-brand-500/20' : 'bg-slate-200 dark:bg-slate-700'
            )}>
              <Icon className={cn(
                'h-5 w-5',
                theme === value ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
              )} />
            </div>
            <div>
              <p className={cn(
                'text-sm font-semibold',
                theme === value ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'
              )}>{label}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
            {theme === value && (
              <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Active</span>
            )}
          </button>
        ))}
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
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
};
