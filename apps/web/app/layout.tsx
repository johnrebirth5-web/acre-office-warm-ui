import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { I18nProvider } from "../lib/i18n/client";
import { getCurrentLocale, getServerI18n } from "../lib/i18n/server";
import "./globals.css";

const officeSans = Inter({
  subsets: ["latin"],
  variable: "--font-office-sans",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Acre Agent OS",
  description: "Internal operating system for Acre agents and office team."
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, messages } = await getServerI18n({
    locale: await getCurrentLocale(),
  });

  return (
    <html lang={locale}>
      <body className={`acre-root ${officeSans.variable}`}>
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
