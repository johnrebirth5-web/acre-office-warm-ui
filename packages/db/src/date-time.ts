const defaultDateTimeLocale = "en-US";

const defaultDateTimeOptions: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit"
};

export const defaultOfficeTimeZone = "America/New_York";

export function resolveTimeZone(value: string | null | undefined) {
  const timeZone = value?.trim();

  if (!timeZone) {
    return defaultOfficeTimeZone;
  }

  try {
    new Intl.DateTimeFormat(defaultDateTimeLocale, { timeZone }).format(new Date(0));
    return timeZone;
  } catch {
    return defaultOfficeTimeZone;
  }
}

export function formatDateTimeLabel(
  value: Date | null | undefined,
  options?: {
    timeZone?: string | null;
    locale?: string;
    emptyLabel?: string;
  }
) {
  if (!value) {
    return options?.emptyLabel ?? "—";
  }

  return value.toLocaleString(options?.locale ?? defaultDateTimeLocale, {
    ...defaultDateTimeOptions,
    timeZone: resolveTimeZone(options?.timeZone)
  });
}
