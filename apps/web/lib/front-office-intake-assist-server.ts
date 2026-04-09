type FrontOfficeLeadIntakeAssistServerSourceMode =
  | "text"
  | "image"
  | "hybrid";

type FrontOfficeLeadIntakeAssistServerFormData = {
  transcriptText: string;
  image: Blob | null;
  sourceSurface: string | null;
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
};

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

  const rawText = combineAssistText(transcriptText, ocrText);

  return {
    rawText,
    sourceMode,
    transcriptText,
    ocrText,
    hadImage,
    ocrSucceeded,
  };
}
