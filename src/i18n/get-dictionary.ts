import type { SupportedLocale } from "@/i18n/locales";

const dictionaries = {
  ja: () => import("@/i18n/dictionaries/ja.json").then((m) => m.default),
  en: () => import("@/i18n/dictionaries/en.json").then((m) => m.default),
};

export async function getDictionary(locale: SupportedLocale) {
  return dictionaries[locale]();
}
