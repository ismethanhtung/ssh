import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enTranslations from "../locales/en.json";
import viTranslations from "../locales/vi.json";

// Normalize language code (e.g., "en-US" -> "en")
const normalizeLanguage = (lng: string | undefined): string => {
    if (!lng) return "en";
    const code = lng.split("-")[0].toLowerCase();
    return code === "vi" ? "vi" : "en";
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: {
                translation: enTranslations,
            },
            vi: {
                translation: viTranslations,
            },
        },
        fallbackLng: "en",
        defaultNS: "translation",
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ["localStorage", "navigator"],
            caches: ["localStorage"],
            lookupLocalStorage: "i18nextLng",
            convertDetectedLanguage: normalizeLanguage,
        },
    });

export default i18n;

