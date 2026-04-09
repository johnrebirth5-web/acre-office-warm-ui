import { defaultLocale, type LocaleCode } from "./config";
import { formatCurrency, formatDate, formatDateTime, formatNumber, formatPercent } from "./format";
import { enUSMessages } from "./messages/en-US";
import { zhCNMessages } from "./messages/zh-CN";

type DeepMessageShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : DeepMessageShape<T[Key]>;
};

export type TranslationMessages = DeepMessageShape<typeof enUSMessages>;
export type TranslationSelector = (messages: TranslationMessages) => string;
export type TranslationVariables = Record<string, string | number | boolean | null | undefined>;

export function getMessages(locale: LocaleCode): TranslationMessages {
  return locale === "zh-CN" ? zhCNMessages : enUSMessages;
}

export function interpolateMessage(template: string, values?: TranslationVariables) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function translate(
  messages: TranslationMessages,
  selector: TranslationSelector,
  values?: TranslationVariables,
) {
  return interpolateMessage(selector(messages), values);
}

export function createI18nHelpers(locale: LocaleCode = defaultLocale, messages = getMessages(locale)) {
  return {
    locale,
    messages,
    t: (selector: TranslationSelector, values?: TranslationVariables) => translate(messages, selector, values),
    formatDate: (value: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions) =>
      formatDate(value, locale, options),
    formatDateTime: (value: Date | string | number | null | undefined, options?: Intl.DateTimeFormatOptions) =>
      formatDateTime(value, locale, options),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, locale, options),
    formatCurrency: (value: number, currency?: string, options?: Intl.NumberFormatOptions) =>
      formatCurrency(value, locale, currency, options),
    formatPercent: (value: number, options?: Intl.NumberFormatOptions) => formatPercent(value, locale, options),
  };
}

export { defaultLocale } from "./config";
export type { LocaleCode } from "./config";
