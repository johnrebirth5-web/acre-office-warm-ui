import { defaultLocale, type LocaleCode } from "./config";

type DateLike = Date | string | number | null | undefined;

function parseDate(value: DateLike) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

export function formatDate(value: DateLike, locale: LocaleCode = defaultLocale, options?: Intl.DateTimeFormatOptions) {
  const parsed = parseDate(value);

  if (!parsed) {
    return "";
  }

  return parsed.toLocaleDateString(locale, options ?? {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(
  value: DateLike,
  locale: LocaleCode = defaultLocale,
  options?: Intl.DateTimeFormatOptions,
) {
  const parsed = parseDate(value);

  if (!parsed) {
    return "";
  }

  return parsed.toLocaleString(locale, options ?? {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatNumber(
  value: number,
  locale: LocaleCode = defaultLocale,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatCurrency(
  value: number,
  locale: LocaleCode = defaultLocale,
  currency = "USD",
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

export function formatPercent(
  value: number,
  locale: LocaleCode = defaultLocale,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}
