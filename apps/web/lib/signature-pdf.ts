import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { OfficeSignatureField } from "@acre/db";

export type SubmittedSignatureFieldValue = {
  fieldId: string;
  fieldType: OfficeSignatureField["fieldType"];
  textValue?: string;
  signatureMode?: "draw" | "type" | "upload";
  imageDataUrl?: string;
};

function dataUrlToBytes(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Signature image payload is invalid.");
  }

  return {
    mimeType: match[1],
    bytes: Uint8Array.from(Buffer.from(match[2], "base64"))
  };
}

function fitFontSize(text: string, width: number, height: number) {
  const safeTextLength = Math.max(1, text.trim().length);
  const widthDriven = width / (safeTextLength * 0.55);
  return Math.max(10, Math.min(height * 0.7, widthDriven));
}

export async function buildSignedPdf(input: {
  originalPdfBytes: Uint8Array;
  fields: OfficeSignatureField[];
  values: SubmittedSignatureFieldValue[];
}) {
  const pdf = await PDFDocument.load(input.originalPdfBytes);
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const helveticaOblique = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const timesItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const valuesByFieldId = new Map(input.values.map((value) => [value.fieldId, value]));

  for (const field of input.fields) {
    const pageIndex = field.page - 1;
    const page = pdf.getPage(pageIndex);

    if (!page) {
      throw new Error(`Signature field ${field.label} points to a missing PDF page.`);
    }

    const value = valuesByFieldId.get(field.id);
    if (!value && field.required) {
      throw new Error(`Field ${field.label} is required.`);
    }

    if (!value) {
      continue;
    }

    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const x = field.x * pageWidth;
    const width = field.width * pageWidth;
    const height = field.height * pageHeight;
    const y = pageHeight - ((field.y + field.height) * pageHeight);

    if (field.fieldType === "signature") {
      if (value.signatureMode === "type" && value.textValue?.trim()) {
        const fontSize = fitFontSize(value.textValue, width, height);
        page.drawText(value.textValue.trim(), {
          x: x + 6,
          y: y + Math.max(6, height * 0.2),
          font: timesItalic,
          size: fontSize,
          color: rgb(0.05, 0.09, 0.16)
        });
        continue;
      }

      if (value.imageDataUrl?.trim()) {
        const imagePayload = dataUrlToBytes(value.imageDataUrl.trim());
        const image =
          imagePayload.mimeType === "image/jpeg" || imagePayload.mimeType === "image/jpg"
            ? await pdf.embedJpg(imagePayload.bytes)
            : await pdf.embedPng(imagePayload.bytes);

        page.drawImage(image, {
          x,
          y,
          width,
          height
        });
        continue;
      }

      throw new Error(`Signature field ${field.label} is missing signature content.`);
    }

    const textValue = value.textValue?.trim() || field.defaultValue.trim();
    if (!textValue) {
      if (field.required) {
        throw new Error(`Field ${field.label} is required.`);
      }
      continue;
    }

    const font = field.fontStyle === "signature" ? timesItalic : field.fontStyle === "italic" ? helveticaOblique : helvetica;
    const fontSize = fitFontSize(textValue, width, height);
    page.drawText(textValue, {
      x: x + 6,
      y: y + Math.max(6, height * 0.2),
      font,
      size: fontSize,
      color: rgb(0.05, 0.09, 0.16),
      maxWidth: Math.max(12, width - 10)
    });
  }

  return pdf.save();
}
