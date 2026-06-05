import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import ar from './locales/ar.json';
import uk from './locales/uk.json';
import deAT from './locales/de-AT.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'de-AT', name: 'Viennese', nativeName: 'Wienerisch' },
  { code: 'fr', name: 'French', nativeName: 'Fran\u00e7ais' },
  { code: 'es', name: 'Spanish', nativeName: 'Espa\u00f1ol' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Portugu\u00eas' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'uk', name: 'Ukrainian', nativeName: '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430' },
  { code: 'ar', name: 'Arabic', nativeName: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', dir: 'rtl' },
] as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      de: { common: de },
      'de-AT': { common: deAT },
      fr: { common: fr },
      es: { common: es },
      it: { common: it },
      pt: { common: pt },
      nl: { common: nl },
      pl: { common: pl },
      uk: { common: uk },
      ar: { common: ar },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'admin-language',
      caches: ['localStorage'],
      // When auto-detecting from the browser, strip region codes so that
      // e.g. navigator "de-AT" resolves to standard "de", not Wienerisch.
      // Explicit user choice (stored in localStorage) is checked first in
      // detection order and used as-is — so selecting "de-AT" in
      // preferences still works.
      convertDetectedLanguage: (lng: string) => {
        try {
          const stored = localStorage.getItem('admin-language');
          if (stored) return lng; // explicit choice — keep exact code
        } catch { /* SSR / test env — no localStorage */ }
        return lng.split('-')[0]; // browser auto-detect — strip region
      },
    },
  });

export default i18n;
