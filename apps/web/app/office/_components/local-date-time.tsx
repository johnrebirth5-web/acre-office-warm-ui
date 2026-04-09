"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../../../lib/i18n/client";

type LocalDateTimeProps = {
  value: string;
  fallbackLabel?: string;
  emptyLabel?: string;
};

const localDateTimeFormat: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit"
};

export function formatLocalDateTimeValue(value: string, locale = "en-US") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(locale, localDateTimeFormat);
}

export function LocalDateTime({
  value,
  fallbackLabel,
  emptyLabel = "—"
}: LocalDateTimeProps) {
  const { locale } = useI18n();
  const [label, setLabel] = useState(fallbackLabel ?? emptyLabel);

  useEffect(() => {
    if (!value.trim()) {
      setLabel(emptyLabel);
      return;
    }

    setLabel(formatLocalDateTimeValue(value, locale));
  }, [emptyLabel, locale, value]);

  return (
    <time dateTime={value} suppressHydrationWarning>
      {label}
    </time>
  );
}
