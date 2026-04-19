const ONE_MEGABYTE = 1024 * 1024;
const DEFAULT_MULTIPART_OVERHEAD_BYTES = ONE_MEGABYTE;

export const DEFAULT_UPLOAD_MAX_BYTES = 25 * ONE_MEGABYTE;
export const DEFAULT_UPLOAD_BATCH_MAX_BYTES = 50 * ONE_MEGABYTE;

function parseContentLength(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function formatUploadLimit(maxBytes: number) {
  return `${Math.round(maxBytes / ONE_MEGABYTE)} MB`;
}

export function getCombinedUploadSize(files: readonly File[]) {
  return files.reduce((total, file) => total + file.size, 0);
}

export function getOversizedUpload(
  files: readonly File[],
  maxBytes = DEFAULT_UPLOAD_MAX_BYTES,
) {
  return files.find((file) => file.size > maxBytes) ?? null;
}

export function hasAllowedMimePrefix(
  file: File,
  allowedMimePrefixes: readonly string[],
) {
  return Boolean(file.type) && allowedMimePrefixes.some((prefix) => file.type.startsWith(prefix));
}

export function getUnsupportedMimeUpload(
  files: readonly File[],
  allowedMimePrefixes: readonly string[],
) {
  return files.find((file) => !hasAllowedMimePrefix(file, allowedMimePrefixes)) ?? null;
}

export function isMultipartPayloadTooLarge(
  request: { headers: Pick<Headers, "get"> },
  maxBytes: number,
  overheadBytes = DEFAULT_MULTIPART_OVERHEAD_BYTES,
) {
  const contentLength = parseContentLength(request.headers.get("content-length"));
  return contentLength !== null && contentLength > maxBytes + overheadBytes;
}
