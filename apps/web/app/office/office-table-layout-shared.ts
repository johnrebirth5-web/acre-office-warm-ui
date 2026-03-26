import type { OfficeTableLayoutColumn, OfficeTableLayoutMap } from "@acre/db";

const minimumColumnWidth = 72;
const signatureSuffixPattern = /:sig-[a-z0-9]+$/;

function normalizeColumnWidth(width: number) {
  return Math.max(Math.round(width), minimumColumnWidth);
}

function hashColumnKeys(columnKeys: string[]) {
  let hash = 5381;

  for (const key of columnKeys) {
    for (let index = 0; index < key.length; index += 1) {
      hash = (((hash << 5) + hash) ^ key.charCodeAt(index)) >>> 0;
    }

    hash = (((hash << 5) + hash) ^ 31) >>> 0;
  }

  return hash.toString(36);
}

function buildOfficeTableLayoutSignature(columnKeys: string[]) {
  return `sig-${hashColumnKeys(columnKeys)}`;
}

function buildOfficeTableLayoutKey(baseKey: string, columnKeys: string[]) {
  return `${baseKey}:${buildOfficeTableLayoutSignature(columnKeys)}`;
}

function stripOfficeTableLayoutSignature(key: string) {
  return key.replace(signatureSuffixPattern, "");
}

function getOfficeTableLayoutLegacyKeys(key: string) {
  const baseKey = stripOfficeTableLayoutSignature(key);
  return baseKey === key ? [] : [baseKey];
}

function buildGridTemplate(columns: OfficeTableLayoutColumn[]) {
  return columns.map((column) => `${normalizeColumnWidth(column.width)}px`).join(" ");
}

function escapeHtmlForInlineScript(value: string) {
  return value.replace(/</g, "\\u003c");
}

function buildBootstrapLayoutJson(layouts: OfficeTableLayoutMap) {
  return escapeHtmlForInlineScript(JSON.stringify(layouts));
}

export {
  buildBootstrapLayoutJson,
  buildGridTemplate,
  buildOfficeTableLayoutKey,
  getOfficeTableLayoutLegacyKeys,
  minimumColumnWidth,
  stripOfficeTableLayoutSignature,
  type OfficeTableLayoutColumn,
  type OfficeTableLayoutMap
};
