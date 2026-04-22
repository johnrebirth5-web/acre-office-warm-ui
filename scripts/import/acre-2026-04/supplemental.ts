import { inflateRawSync } from "node:zlib";

export type SupplementalSheetName = "Acre NY" | "Acre NJ" | "Acre Rentals";
export type SupplementalOfficeSlug =
  | "acre-nj-llc"
  | "acre-ny-realty"
  | "acre-ny-rental";

export type SupplementalWorkbookRow = {
  sheetName: SupplementalSheetName;
  officeSlug: SupplementalOfficeSlug;
  sourceRowNumber: number;
  userName: string;
  licenseStateRaw: string;
  splitRaw: string;
  expirationRaw: string;
};

export type SupplementalSheetCount = {
  rows: number;
  groupedUsers: number;
};

export type SupplementalWorkbookParseResult = {
  rows: SupplementalWorkbookRow[];
  countsBySheet: Record<SupplementalSheetName, SupplementalSheetCount>;
};

export type SupplementalAggregatedUser = {
  sheetName: SupplementalSheetName;
  officeSlug: SupplementalOfficeSlug;
  userName: string;
  sourceRowNumbers: number[];
  licenseState: string;
  licenseStateValues: string[];
  expirationDate: string;
  expirationValues: string[];
  rawSplitTexts: string[];
  maxSplitPercent: number | null;
  maxSplitPercentLabel: string;
  noteBlock: string;
};

const worksheetHeader = [
  "User Name",
  "License state",
  "Custom agent split %",
  "Expiration date",
] as const;

const sheetOfficeSlugMap: Record<SupplementalSheetName, SupplementalOfficeSlug> = {
  "Acre NY": "acre-ny-realty",
  "Acre NJ": "acre-nj-llc",
  "Acre Rentals": "acre-ny-rental",
};

type ZipEntry = {
  compressedSize: number;
  compressionMethod: number;
  localHeaderOffset: number;
};

type WorksheetRow = {
  rowNumber: number;
  values: string[];
};

function isSupplementalSheetName(value: string): value is SupplementalSheetName {
  return value === "Acre NY" || value === "Acre NJ" || value === "Acre Rentals";
}

function parseXmlAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  const matcher = /([:\w-]+)="([^"]*)"/g;

  for (const match of tag.matchAll(matcher)) {
    const key = match[1] ?? "";
    const value = match[2] ?? "";

    if (key) {
      attributes[key] = decodeXmlText(value);
    }
  }

  return attributes;
}

function decodeXmlText(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function normalizeSupplementalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed === "#N/A" ? "" : trimmed;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumLength = 22;

  if (buffer.length < minimumLength) {
    throw new Error("Workbook ZIP is truncated.");
  }

  for (let offset = buffer.length - minimumLength; offset >= Math.max(0, buffer.length - 65557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error("Workbook ZIP central directory was not found.");
}

function readZipEntries(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map<string, ZipEntry>();
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error("Workbook ZIP central directory entry is invalid.");
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraFieldLength = buffer.readUInt16LE(cursor + 30);
    const fileCommentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString("utf8");

    entries.set(fileName, {
      compressedSize,
      compressionMethod,
      localHeaderOffset,
    });

    cursor += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
}

function readZipEntry(buffer: Buffer, entries: Map<string, ZipEntry>, fileName: string) {
  const entry = entries.get(fileName);

  if (!entry) {
    throw new Error(`Workbook ZIP is missing ${fileName}.`);
  }

  const offset = entry.localHeaderOffset;

  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`Workbook ZIP local header for ${fileName} is invalid.`);
  }

  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraFieldLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraFieldLength;
  const compressedData = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return compressedData;
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressedData);
  }

  throw new Error(
    `Workbook ZIP entry ${fileName} uses unsupported compression method ${entry.compressionMethod}.`,
  );
}

function getCellColumnIndex(reference: string) {
  const match = reference.match(/^([A-Z]+)/i);

  if (!match) {
    return 0;
  }

  let index = 0;

  for (const character of match[1] ?? "") {
    index = index * 26 + (character.toUpperCase().charCodeAt(0) - 64);
  }

  return Math.max(0, index - 1);
}

function readCellValue(cellXml: string, sharedStrings: string[]) {
  const openingTagMatch = cellXml.match(/^<c\b([^>]*)>/);

  if (!openingTagMatch) {
    return "";
  }

  const attributes = parseXmlAttributes(openingTagMatch[1] ?? "");
  const cellType = attributes.t ?? "";
  const inlineTextMatch = cellXml.match(/<is\b[^>]*>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
  const valueMatch = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  const rawValue = decodeXmlText(valueMatch?.[1] ?? "");

  if (cellType === "inlineStr") {
    return decodeXmlText(inlineTextMatch?.[1] ?? "");
  }

  if (cellType === "s") {
    const index = Number.parseInt(rawValue, 10);

    return Number.isNaN(index) ? "" : sharedStrings[index] ?? "";
  }

  return rawValue;
}

function parseSharedStrings(xml: string) {
  const values: string[] = [];
  const stringMatcher = /<si\b[^>]*>([\s\S]*?)<\/si>/g;

  for (const match of xml.matchAll(stringMatcher)) {
    const fragments = [...(match[1] ?? "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(
      (fragment) => decodeXmlText(fragment[1] ?? ""),
    );

    values.push(fragments.join(""));
  }

  return values;
}

function parseWorkbookSheets(xml: string) {
  return [...xml.matchAll(/<sheet\b([^>]*)\/>/g)].map((match) => {
    const attributes = parseXmlAttributes(match[1] ?? "");

    return {
      name: attributes.name ?? "",
      relationshipId: attributes["r:id"] ?? "",
    };
  });
}

function parseWorkbookRelationships(xml: string) {
  const relationships = new Map<string, string>();

  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/>/g)) {
    const attributes = parseXmlAttributes(match[1] ?? "");
    const relationshipId = attributes.Id ?? "";
    const target = attributes.Target ?? "";

    if (relationshipId && target) {
      relationships.set(relationshipId, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
    }
  }

  return relationships;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rows: WorksheetRow[] = [];
  const rowMatcher = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;

  for (const match of xml.matchAll(rowMatcher)) {
    const attributes = parseXmlAttributes(match[1] ?? "");
    const rowNumber = Number.parseInt(attributes.r ?? "", 10);
    const values: string[] = [];
    const cellMatcher = /<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g;

    for (const cellMatch of (match[2] ?? "").matchAll(cellMatcher)) {
      const cellXml = cellMatch[0] ?? "";
      const openingTagMatch = cellXml.match(/^<c\b([^>]*?)(?:\/>|>)/);

      if (!openingTagMatch) {
        continue;
      }

      const cellAttributes = parseXmlAttributes(openingTagMatch[1] ?? "");
      const columnIndex = getCellColumnIndex(cellAttributes.r ?? "");

      values[columnIndex] = readCellValue(cellXml, sharedStrings);
    }

    rows.push({
      rowNumber: Number.isNaN(rowNumber) ? rows.length + 1 : rowNumber,
      values: values.map((value) => value ?? ""),
    });
  }

  return rows;
}

function formatIsoDate(date: Date) {
  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}-${`${date.getUTCDate()}`.padStart(2, "0")}`;
}

function parseSupplementalExpirationDate(value: string | null | undefined) {
  const normalized = normalizeSupplementalText(value);

  if (!normalized) {
    return "";
  }

  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const serial = Number.parseFloat(normalized);

    if (Number.isFinite(serial)) {
      const milliseconds = Date.UTC(1899, 11, 30) + serial * 24 * 60 * 60 * 1000;

      return formatIsoDate(new Date(milliseconds));
    }
  }

  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? "" : formatIsoDate(parsed);
}

function uniqueInOrder(values: string[]) {
  const unique = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    if (!value || unique.has(value)) {
      continue;
    }

    unique.add(value);
    ordered.push(value);
  }

  return ordered;
}

function formatPercentLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "";
  }

  const rounded = Number.parseFloat(value.toFixed(4));

  if (Number.isInteger(rounded)) {
    return `${rounded}`;
  }

  return `${rounded}`.replace(/\.?0+$/g, "");
}

export function extractMaxSupplementalSplitPercent(value: string | null | undefined) {
  const normalized = normalizeSupplementalText(value).replaceAll("％", "%");

  if (!normalized) {
    return null;
  }

  if (/^-?\d+(?:\.\d+)?%$/.test(normalized)) {
    const percent = Number.parseFloat(normalized.slice(0, -1));

    return Number.isFinite(percent) ? percent : null;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    const numeric = Number.parseFloat(normalized);

    if (!Number.isFinite(numeric) || numeric < 0) {
      return null;
    }

    return numeric <= 1 ? numeric * 100 : numeric <= 100 ? numeric : null;
  }

  const matchedPercents = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((match) => Number.parseFloat(match[1] ?? ""))
    .filter((percent) => Number.isFinite(percent));

  if (matchedPercents.length === 0) {
    return null;
  }

  return Math.max(...matchedPercents);
}

export function appendSupplementalNote(existingNotes: string | null | undefined, noteBlock: string) {
  const normalizedExisting = existingNotes?.trim() ?? "";
  const normalizedNote = noteBlock.trim();

  if (!normalizedNote) {
    return normalizedExisting;
  }

  if (!normalizedExisting) {
    return normalizedNote;
  }

  if (normalizedExisting.includes(normalizedNote)) {
    return normalizedExisting;
  }

  return `${normalizedExisting}\n\n${normalizedNote}`;
}

function buildSupplementalNoteBlock(
  sheetName: SupplementalSheetName,
  sourceRowNumbers: number[],
  rawSplitTexts: string[],
  maxSplitPercentLabel: string,
  licenseState: string,
  licenseStateValues: string[],
  expirationDate: string,
  expirationValues: string[],
) {
  const lines = [
    `Supplemental roster import: ${sheetName}`,
    `Source rows: ${sourceRowNumbers.join(", ")}`,
  ];

  if (rawSplitTexts.length > 0) {
    lines.push("Raw split text:");

    for (const rawSplitText of rawSplitTexts) {
      lines.push(`- ${rawSplitText}`);
    }
  }

  if (maxSplitPercentLabel) {
    lines.push(`Resolved max split: ${maxSplitPercentLabel}%`);
  }

  if (licenseState) {
    lines.push(`Resolved license state: ${licenseState}`);
  }

  if (licenseStateValues.length > 1) {
    lines.push(`Conflicting license states: ${licenseStateValues.join(" | ")}`);
  }

  if (expirationDate) {
    lines.push(`Resolved expiration date: ${expirationDate}`);
  }

  if (expirationValues.length > 1) {
    lines.push(`Conflicting expiration values: ${expirationValues.join(" | ")}`);
  }

  return lines.join("\n");
}

export function aggregateSupplementalRows(rows: SupplementalWorkbookRow[]) {
  const grouped = new Map<string, SupplementalWorkbookRow[]>();
  const countsBySheet = Object.fromEntries(
    Object.keys(sheetOfficeSlugMap).map((sheetName) => [
      sheetName,
      {
        rows: 0,
        groupedUsers: 0,
      } satisfies SupplementalSheetCount,
    ]),
  ) as Record<SupplementalSheetName, SupplementalSheetCount>;

  for (const row of rows) {
    countsBySheet[row.sheetName].rows += 1;
    const key = `${row.sheetName}::${row.userName}`;
    const group = grouped.get(key) ?? [];

    group.push(row);
    grouped.set(key, group);
  }

  const aggregatedUsers = [...grouped.values()].map((group) => {
    const firstRow = group[0];

    if (!firstRow) {
      throw new Error("Supplemental row aggregation encountered an empty group.");
    }

    const sourceRowNumbers = group.map((row) => row.sourceRowNumber);
    const rawSplitTexts = uniqueInOrder(
      group
        .map((row) => normalizeSupplementalText(row.splitRaw))
        .filter(Boolean),
    );
    const splitPercents = group
      .map((row) => extractMaxSupplementalSplitPercent(row.splitRaw))
      .filter((value): value is number => value !== null);
    const maxSplitPercent = splitPercents.length > 0 ? Math.max(...splitPercents) : null;
    const maxSplitPercentLabel = formatPercentLabel(maxSplitPercent);
    const licenseStateValues = uniqueInOrder(
      group
        .map((row) => normalizeSupplementalText(row.licenseStateRaw))
        .filter(Boolean),
    );
    const expirationValues = uniqueInOrder(
      group
        .map((row) => parseSupplementalExpirationDate(row.expirationRaw))
        .filter(Boolean),
    );
    const licenseState = [...group]
      .reverse()
      .map((row) => normalizeSupplementalText(row.licenseStateRaw))
      .find(Boolean) ?? "";
    const expirationDate = [...group]
      .map((row) => parseSupplementalExpirationDate(row.expirationRaw))
      .filter(Boolean)
      .sort()
      .at(-1) ?? "";

    countsBySheet[firstRow.sheetName].groupedUsers += 1;

    return {
      sheetName: firstRow.sheetName,
      officeSlug: firstRow.officeSlug,
      userName: firstRow.userName,
      sourceRowNumbers,
      licenseState,
      licenseStateValues,
      expirationDate,
      expirationValues,
      rawSplitTexts,
      maxSplitPercent,
      maxSplitPercentLabel,
      noteBlock: buildSupplementalNoteBlock(
        firstRow.sheetName,
        sourceRowNumbers,
        rawSplitTexts,
        maxSplitPercentLabel,
        licenseState,
        licenseStateValues,
        expirationDate,
        expirationValues,
      ),
    } satisfies SupplementalAggregatedUser;
  });

  return {
    aggregatedUsers,
    countsBySheet,
  };
}

export function buildSupplementalWorkbookExportUrl(input: string) {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("Supplemental Google Sheet URL is required.");
  }

  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);

  if (idMatch?.[1]) {
    return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=xlsx`;
  }

  const parsed = new URL(trimmed);

  if (parsed.hostname === "docs.google.com" && parsed.pathname.includes("/export")) {
    parsed.searchParams.set("format", "xlsx");
    return parsed.toString();
  }

  throw new Error("Supplemental Google Sheet URL must point to a Google spreadsheet.");
}

export function parseSupplementalWorkbook(buffer: Buffer): SupplementalWorkbookParseResult {
  const entries = readZipEntries(buffer);
  const workbookXml = readZipEntry(buffer, entries, "xl/workbook.xml").toString("utf8");
  const workbookRelationshipsXml = readZipEntry(buffer, entries, "xl/_rels/workbook.xml.rels").toString("utf8");
  const sharedStringsXml = entries.has("xl/sharedStrings.xml")
    ? readZipEntry(buffer, entries, "xl/sharedStrings.xml").toString("utf8")
    : "";
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  const workbookRelationships = parseWorkbookRelationships(workbookRelationshipsXml);
  const workbookRows: SupplementalWorkbookRow[] = [];
  const countsBySheet = Object.fromEntries(
    Object.keys(sheetOfficeSlugMap).map((sheetName) => [
      sheetName,
      {
        rows: 0,
        groupedUsers: 0,
      } satisfies SupplementalSheetCount,
    ]),
  ) as Record<SupplementalSheetName, SupplementalSheetCount>;

  for (const sheet of parseWorkbookSheets(workbookXml)) {
    if (!isSupplementalSheetName(sheet.name)) {
      continue;
    }

    const target = workbookRelationships.get(sheet.relationshipId);

    if (!target) {
      throw new Error(`Workbook relationship ${sheet.relationshipId} was not found for ${sheet.name}.`);
    }

    const worksheetXml = readZipEntry(buffer, entries, target).toString("utf8");
    const worksheetRows = parseWorksheetRows(worksheetXml, sharedStrings);
    const header = worksheetRows[0]?.values.slice(0, worksheetHeader.length).map((value) => value?.trim() ?? "") ?? [];

    if (worksheetHeader.some((value, index) => header[index] !== value)) {
      throw new Error(`Worksheet ${sheet.name} does not match the expected header layout.`);
    }

    for (const row of worksheetRows.slice(1)) {
      const userName = normalizeSupplementalText(row.values[0] ?? "");

      if (!userName) {
        continue;
      }

      workbookRows.push({
        sheetName: sheet.name,
        officeSlug: sheetOfficeSlugMap[sheet.name],
        sourceRowNumber: row.rowNumber,
        userName,
        licenseStateRaw: normalizeSupplementalText(row.values[1] ?? ""),
        splitRaw: normalizeSupplementalText(row.values[2] ?? ""),
        expirationRaw: normalizeSupplementalText(row.values[3] ?? ""),
      });
      countsBySheet[sheet.name].rows += 1;
    }
  }

  return {
    rows: workbookRows,
    countsBySheet,
  };
}
