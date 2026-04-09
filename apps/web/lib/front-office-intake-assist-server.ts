type FrontOfficeLeadIntakeAssistServerSourceMode =
  | "text"
  | "image"
  | "hybrid";

type FrontOfficeLeadIntakeAssistServerFormData = {
  transcriptText: string;
  image: Blob | null;
  sourceSurface: string | null;
};

type FrontOfficeLeadIntakeAssistServerValidationIssue = {
  error: string;
  status: 400 | 413;
};

type FrontOfficeLeadIntakeAssistServerInput = {
  transcriptText?: string;
  image?: Blob | null;
  recognizeImage?: (image: Blob) => Promise<string>;
};

type FrontOfficeLeadIntakeAssistServerResult = {
  rawText: string;
  sourceMode: FrontOfficeLeadIntakeAssistServerSourceMode;
  transcriptText: string;
  ocrText: string;
  hadImage: boolean;
  ocrSucceeded: boolean;
  transcriptFallbackUsed: boolean;
};

export const FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES =
  10 * 1024 * 1024;

function normalizeAssistText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function combineAssistText(transcriptText: string, ocrText: string) {
  return [transcriptText, ocrText].filter(Boolean).join("\n\n").trim();
}

export function readFrontOfficeLeadIntakeAssistServerFormData(
  formData: FormData,
): FrontOfficeLeadIntakeAssistServerFormData {
  const transcriptText = String(
    formData.get("transcript") ?? formData.get("assistTranscript") ?? "",
  ).trim();
  const imageValue = formData.get("image");
  const sourceSurface = String(formData.get("sourceSurface") ?? "").trim();

  return {
    transcriptText,
    image: imageValue instanceof Blob && imageValue.size > 0 ? imageValue : null,
    sourceSurface: sourceSurface || null,
  };
}

export function validateFrontOfficeLeadIntakeAssistServerInput(
  input: FrontOfficeLeadIntakeAssistServerFormData,
): {
  transcriptText: string;
  image: Blob | null;
  sourceSurface: string | null;
  issue: FrontOfficeLeadIntakeAssistServerValidationIssue | null;
} {
  const transcriptText = normalizeAssistText(input.transcriptText);
  const image = input.image;

  if (
    image &&
    image.size > FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES
  ) {
    return {
      transcriptText,
      image,
      sourceSurface: input.sourceSurface,
      issue: {
        error:
          "That screenshot is too large for quick server-side OCR. Try a tighter crop under 10 MB.",
        status: 413,
      },
    };
  }

  if (!transcriptText && !image) {
    return {
      transcriptText,
      image: null,
      sourceSurface: input.sourceSurface,
      issue: {
        error:
          "Add a screenshot or paste the chat transcript first so Acre has something to extract from.",
        status: 400,
      },
    };
  }

  return {
    transcriptText,
    image,
    sourceSurface: input.sourceSurface,
    issue: null,
  };
}

async function recognizeFrontOfficeLeadIntakeAssistImage(image: Blob) {
  const { recognize } = await import("tesseract.js");
  const { data } = await recognize(image, "eng+chi_sim");

  return normalizeAssistText(String(data.text ?? ""));
}

export async function extractFrontOfficeLeadIntakeAssistServer(
  input: FrontOfficeLeadIntakeAssistServerInput,
): Promise<FrontOfficeLeadIntakeAssistServerResult> {
  const transcriptText = normalizeAssistText(input.transcriptText ?? "");
  const hadImage = Boolean(input.image);
  const sourceMode: FrontOfficeLeadIntakeAssistServerSourceMode =
    hadImage && transcriptText
      ? "hybrid"
      : hadImage
        ? "image"
        : "text";

  let ocrText = "";
  let ocrSucceeded = false;
  let transcriptFallbackUsed = false;

  if (input.image) {
    try {
      const recognizeImage =
        input.recognizeImage ?? recognizeFrontOfficeLeadIntakeAssistImage;
      ocrText = normalizeAssistText(await recognizeImage(input.image));
      ocrSucceeded = true;
    } catch {
      ocrText = "";
      ocrSucceeded = false;
    }
  }

  transcriptFallbackUsed = hadImage && Boolean(transcriptText) && !ocrText;
  const rawText = combineAssistText(transcriptText, ocrText);

  return {
    rawText,
    sourceMode,
    transcriptText,
    ocrText,
    hadImage,
    ocrSucceeded,
    transcriptFallbackUsed,
  };
}
