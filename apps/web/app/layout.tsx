import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`acre-root ${officeSans.variable}`}>{children}</body>
    </html>
  );
}
