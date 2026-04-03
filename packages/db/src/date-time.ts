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

export function formatDateTimeInputValue(
  value: Date | null | undefined,
  options?: {
    timeZone?: string | null;
    locale?: string;
  },
) {
  if (!value) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat(
    options?.locale ?? defaultDateTimeLocale,
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
      timeZone: resolveTimeZone(options?.timeZone),
    },
  );
  const parts = formatter.formatToParts(value);
  const partMap = new Map(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const year = partMap.get("year");
  const month = partMap.get("month");
  const day = partMap.get("day");
  const hour = partMap.get("hour");
  const minute = partMap.get("minute");

  if (!year || !month || !day || !hour || !minute) {
    return "";
  }

  return `${year}-${month}-${day}T${hour}:${minute}`;
}
