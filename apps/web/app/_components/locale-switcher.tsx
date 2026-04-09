"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { getLocaleCookieOptions, localeCookieName, type LocaleCode } from "../../lib/i18n/config";
import { useI18n } from "../../lib/i18n/client";

type LocaleSwitcherProps = {
  authenticated?: boolean;
  className?: string;
  variant?: "default" | "workspace";
};

const localeOptions = [
  { value: "en-US" as const, labelKey: "english" as const },
  { value: "zh-CN" as const, labelKey: "simplifiedChinese" as const },
];

function writeClientLocaleCookie(locale: LocaleCode) {
  const options = getLocaleCookieOptions();
  const parts = [
    `${localeCookieName}=${encodeURIComponent(locale)}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite}`,
  ];

  if (options.secure) {
    parts.push("Secure");
  }

  document.cookie = parts.join("; ");
}

export function LocaleSwitcher({
  authenticated = false,
  className,
  variant = "default",
}: LocaleSwitcherProps) {
  const router = useRouter();
  const { locale, messages, t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);
  const currentLocaleLabel =
    locale === "zh-CN"
      ? messages.common.simplifiedChinese
      : messages.common.english;

  async function handleChange(nextLocale: string) {
    if (nextLocale === locale || isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      if (authenticated) {
        const response = await fetch("/api/account/locale", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            locale: nextLocale,
          }),
        });

        if (!response.ok) {
          throw new Error(t((currentMessages) => currentMessages.common.languageUpdateFailed));
        }
      } else {
        writeClientLocaleCookie(nextLocale as LocaleCode);
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (variant === "workspace") {
    return (
      <label className={`office-company-switcher office-company-switcher-select${className ? ` ${className}` : ""}`}>
        <span className="office-company-switcher-copy">
          <span>{t((currentMessages) => currentMessages.localeSwitcher.label)}</span>
          <strong>{currentLocaleLabel}</strong>
        </span>
        <span aria-hidden="true" className="office-company-switcher-caret">
          ▾
        </span>
        <select
          aria-label={t((currentMessages) => currentMessages.localeSwitcher.ariaLabel)}
          className="office-company-switcher-native-select"
          disabled={isSaving}
          onChange={(event) => void handleChange(event.target.value)}
          value={locale}
        >
          {localeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.labelKey === "english"
                ? messages.common.english
                : messages.common.simplifiedChinese}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className={className}>
      <span className="sr-only">{t((currentMessages) => currentMessages.localeSwitcher.label)}</span>
      <select
        aria-label={t((currentMessages) => currentMessages.localeSwitcher.ariaLabel)}
        disabled={isSaving}
        onChange={(event) => void handleChange(event.target.value)}
        value={locale}
      >
        {localeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.labelKey === "english"
              ? messages.common.english
              : messages.common.simplifiedChinese}
          </option>
        ))}
      </select>
    </label>
  );
}
