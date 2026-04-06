import { PDFDocument } from "pdf-lib";

export type ExtractedPdfMetadata = {
  pageCount: number | null;
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
  creationDate: string;
  modificationDate: string;
};

function normalizeMetadataValue(value: string | null | undefined) {
  return value?.replace(/\u0000/g, "").trim() ?? "";
}

function normalizeMetadataDate(value: Date | undefined) {
  if (!value || Number.isNaN(value.getTime())) {
    return "";
  }

  return value.toISOString();
}

function parsePdfKeywords(value: string) {
  return [...new Set(value.split(/[,;\n|]+/).map((entry) => entry.trim()).filter(Boolean))];
}

export function isPdfFileLike(fileName: string, mimeType: string | null | undefined) {
  return normalizeMetadataValue(mimeType).toLowerCase() === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
}

export async function extractPdfMetadata(bytes: Uint8Array): Promise<ExtractedPdfMetadata | null> {
  try {
    const document = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false
    });

    return {
      pageCount: document.getPageCount() || null,
      title: normalizeMetadataValue(document.getTitle()),
      author: normalizeMetadataValue(document.getAuthor()),
      subject: normalizeMetadataValue(document.getSubject()),
      keywords: parsePdfKeywords(normalizeMetadataValue(document.getKeywords())),
      creator: normalizeMetadataValue(document.getCreator()),
      producer: normalizeMetadataValue(document.getProducer()),
      creationDate: normalizeMetadataDate(document.getCreationDate()),
      modificationDate: normalizeMetadataDate(document.getModificationDate())
    };
  } catch {
    return null;
  }
}
