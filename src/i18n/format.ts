import type { SupportedLocale } from "@/i18n/locales";

export function formatDate(
  value: string | Date,
  locale: SupportedLocale,
  options?: Intl.DateTimeFormatOptions,
) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(date);
}

export function formatNumber(
  value: number,
  locale: SupportedLocale,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(
  value: number,
  locale: SupportedLocale,
  currency = locale === "ja" ? "JPY" : "USD",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number, locale: SupportedLocale) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}
