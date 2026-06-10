import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Sun, Bell, Users, Crown, Code2, ScrollText, ListPlus, Share2,
  Settings as SettingsIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageContainer';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { BillingSettings } from '@/components/settings/BillingSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
import { DeveloperSettings } from '@/components/settings/DeveloperSettings';
import { AutomationSettings } from '@/components/settings/AutomationSettings';
import { AuditLogSettings } from '@/components/settings/AuditLogSettings';
import { CustomFieldSettings } from '@/components/settings/CustomFieldSettings';
import { SharingSettings } from '@/components/settings/SharingSettings';
import { cn } from '@/lib/utils';

type Tab = 'general' | 'billing' | 'notifications' | 'automations' | 'fields' | 'sharing' | 'audit' | 'security' | 'appearance' | 'developer';

const TABS: { id: Tab; i18nKey: string; icon: React.ElementType }[] = [
  { id: 'general', i18nKey: 'settings.tabs.general', icon: User },
  { id: 'billing', i18nKey: 'settings.tabs.billing', icon: Crown },
  { id: 'notifications', i18nKey: 'settings.tabs.notifications', icon: Bell },
  { id: 'automations', i18nKey: 'settings.tabs.automations', icon: Users },
  { id: 'fields', i18nKey: 'settings.tabs.fields', icon: ListPlus },
  { id: 'sharing', i18nKey: 'settings.tabs.sharing', icon: Share2 },
  { id: 'developer', i18nKey: 'settings.tabs.developer', icon: Code2 },
  { id: 'audit', i18nKey: 'settings.tabs.audit', icon: ScrollText },
  { id: 'security', i18nKey: 'settings.tabs.security', icon: Lock },
  { id: 'appearance', i18nKey: 'settings.tabs.appearance', icon: Sun },
];

// Quick lookup of a tab's icon + label by id.
const TAB_META = Object.fromEntries(TABS.map((t) => [t.id, t])) as Record<Tab, (typeof TABS)[number]>;

// Grouped sections for the settings sidebar nav.
const TAB_GROUPS: { heading: string; tabs: Tab[] }[] = [
  { heading: 'Account', tabs: ['general', 'notifications', 'security', 'appearance'] },
  { heading: 'Workspace', tabs: ['billing', 'automations', 'fields', 'sharing', 'audit'] },
  { heading: 'Developer', tabs: ['developer'] },
];

// Each tab maps to a self-contained settings component (each reads its own
// stores/services). The shell only owns tab selection + layout.
const TAB_CONTENT: Record<Tab, React.ComponentType> = {
  general: GeneralSettings,
  billing: BillingSettings,
  notifications: NotificationSettings,
  automations: AutomationSettings,
  fields: CustomFieldSettings,
  sharing: SharingSettings,
  developer: DeveloperSettings,
  audit: AuditLogSettings,
  security: SecuritySettings,
  appearance: AppearanceSettings,
};

const tabVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const SettingsPage = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  // Open the billing tab when returning from Stripe (?billing=…); BillingSettings
  // handles the toast + clears the param on mount.
  const [activeTab, setActiveTab] = useState<Tab>(searchParams.get('billing') ? 'billing' : 'general');

  const ActiveContent = TAB_CONTENT[activeTab];

  return (
    <div className="mx-auto w-full max-w-5xl p-6 md:p-8">
      <PageHeader icon={SettingsIcon} title={t('settings.title')} description={t('settings.description')} />

      <div className="md:flex md:gap-8">
        {/* Mobile: horizontal scrollable tab strip */}
        <div className="mb-5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 md:hidden">
          {TABS.map(({ id, i18nKey, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all',
                activeTab === id
                  ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'border-slate-200 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(i18nKey)}
            </button>
          ))}
        </div>

        {/* Desktop: grouped vertical nav */}
        <nav className="hidden md:block md:w-52 md:shrink-0">
          <div className="sticky top-8 space-y-5">
            {TAB_GROUPS.map((group) => (
              <div key={group.heading}>
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.heading}</p>
                <div className="space-y-0.5">
                  {group.tabs.map((id) => {
                    const { icon: Icon, i18nKey } = TAB_META[id];
                    return (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          activeTab === id
                            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {t(i18nKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.15 }}
            >
              <ActiveContent />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
