import { shouldUseSecureCookies } from "../auth-session-config";

export const defaultLocale = "en-US" as const;
export const supportedLocales = ["en-US", "zh-CN"] as const;
export const localeCookieName = "acre_locale";
export const localeCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

export type LocaleCode = (typeof supportedLocales)[number];

const localeAliasMap: Record<string, LocaleCode> = {
  en: "en-US",
  "en-us": "en-US",
  zh: "zh-CN",
  "zh-cn": "zh-CN",
  "zh-hans": "zh-CN",
  "zh-sg": "zh-CN",
};

export function isSupportedLocale(value: string | null | undefined): value is LocaleCode {
  return supportedLocales.includes(value as LocaleCode);
}

export function coerceLocaleCode(value: string | null | undefined): LocaleCode {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return defaultLocale;
  }

  return localeAliasMap[normalized] ?? defaultLocale;
}

export function assertSupportedLocale(value: string | null | undefined): LocaleCode {
  if (!value?.trim()) {
    throw new Error("Locale is required.");
  }

  const normalized = value.trim().toLowerCase();
  const supported = localeAliasMap[normalized];

  if (!supported) {
    throw new Error("Unsupported locale.");
  }

  return supported;
}

export function resolveLocaleFromAcceptLanguage(headerValue: string | null | undefined): LocaleCode {
  if (!headerValue?.trim()) {
    return defaultLocale;
  }

  const candidates = headerValue
    .split(",")
    .map((entry) => entry.split(";")[0]?.trim())
    .filter((entry): entry is string => Boolean(entry));

  for (const candidate of candidates) {
    const resolved = localeAliasMap[candidate.toLowerCase()];

    if (resolved) {
      return resolved;
    }
  }

  return defaultLocale;
}

export function resolvePreferredLocale(input: {
  userLocale?: string | null | undefined;
  cookieLocale?: string | null | undefined;
  acceptLanguage?: string | null | undefined;
}): LocaleCode {
  if (input.userLocale?.trim()) {
    return coerceLocaleCode(input.userLocale);
  }

  if (input.cookieLocale?.trim()) {
    return coerceLocaleCode(input.cookieLocale);
  }

  return resolveLocaleFromAcceptLanguage(input.acceptLanguage);
}

export function getLocaleCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: shouldUseSecureCookies(),
    path: "/",
    priority: "high" as const,
    maxAge: localeCookieMaxAgeSeconds,
  };
}
