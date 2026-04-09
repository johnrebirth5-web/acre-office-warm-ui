"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createI18nHelpers, type TranslationMessages } from "./index";
import type { LocaleCode } from "./config";

type I18nContextValue = ReturnType<typeof createI18nHelpers>;

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  locale: LocaleCode;
  messages: TranslationMessages;
  children: ReactNode;
};

export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  return (
    <I18nContext.Provider value={createI18nHelpers(locale, messages)}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider.");
  }

  return context;
}
