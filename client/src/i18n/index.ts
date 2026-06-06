import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ar from './locales/ar.json';
import { setUserLocale } from '@/lib/utils';

/**
 * i18n setup. English ships in-bundle as the source of truth; additional
 * locales are drop-in: add `locales/<lang>.json`, register it in `resources`
 * below and in `LANGUAGES`, and every translated string follows automatically.
 */

export const LANGUAGES: { code: string; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  // Additional locales are drop-in: add a JSON file + entries here and in `resources`.
];

export const resources = {
  en: { translation: en },
  ar: { translation: ar },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: LANGUAGES.map((l) => l.code),
    nonExplicitSupportedLngs: true, // 'en-US' → 'en'
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'taskflow-lang',
      caches: ['localStorage'],
    },
  });

/** Keep <html lang>/<html dir> and the date-formatting locale in sync. */
const applyLanguage = (lng: string) => {
  const meta = LANGUAGES.find((l) => l.code === lng) || LANGUAGES[0];
  document.documentElement.lang = meta.code;
  document.documentElement.dir = meta.dir;
  setUserLocale(lng);
};
applyLanguage(i18n.resolvedLanguage || 'en');
i18n.on('languageChanged', applyLanguage);

export default i18n;
