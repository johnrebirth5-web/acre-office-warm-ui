export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parsePositiveInteger(
  value: string | null,
  fallback: number,
  max?: number,
) {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return fallback;
  }

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const numeric = Number.parseInt(normalized, 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return null;
  }

  return typeof max === "number" ? Math.min(numeric, max) : numeric;
}

export function parseAllowedString<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback?: T,
): T | null {
  const normalized = value?.trim() ?? "";

  if (!normalized) {
    return fallback ?? null;
  }

  return allowed.includes(normalized as T) ? (normalized as T) : null;
}

export async function readJsonObject(
  request: Pick<Request, "json">,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return isPlainObject(body) ? body : null;
  } catch {
    return null;
  }
}
