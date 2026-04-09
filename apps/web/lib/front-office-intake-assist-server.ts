import { NextResponse } from "next/server";

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

type FrontOfficeLeadIntakeAssistRouteContext = {
  currentMembership: unknown;
} | null;

type FrontOfficeLeadIntakeAssistRouteRequest = {
  formData(): Promise<FormData>;
};

type FrontOfficeLeadIntakeAssistRouteDependencies = {
  canViewOfficeContacts?: (subject: any) => boolean;
  readFormData?: typeof readFrontOfficeLeadIntakeAssistServerFormData;
  validateInput?: typeof validateFrontOfficeLeadIntakeAssistServerInput;
  extract?: typeof extractFrontOfficeLeadIntakeAssistServer;
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

const defaultFrontOfficeLeadIntakeAssistRouteDependencies = {
  canViewOfficeContacts: (_subject: unknown) => true,
  readFormData: readFrontOfficeLeadIntakeAssistServerFormData,
  validateInput: validateFrontOfficeLeadIntakeAssistServerInput,
  extract: extractFrontOfficeLeadIntakeAssistServer,
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

export async function handleFrontOfficeLeadIntakeAssistServerRoute(
  request: FrontOfficeLeadIntakeAssistRouteRequest,
  context: FrontOfficeLeadIntakeAssistRouteContext,
  dependencies: FrontOfficeLeadIntakeAssistRouteDependencies = {},
) {
  const {
    canViewOfficeContacts,
    readFormData,
    validateInput,
    extract,
  } = {
    ...defaultFrontOfficeLeadIntakeAssistRouteDependencies,
    ...dependencies,
  };

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!canViewOfficeContacts(context.currentMembership)) {
    return NextResponse.json(
      { error: "Lead intake review access required." },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      { error: "Invalid intake assist payload." },
      { status: 400 },
    );
  }

  const { transcriptText, image, sourceSurface } = readFormData(formData);
  const validation = validateInput({
    transcriptText,
    image,
    sourceSurface,
  });

  if (validation.issue) {
    return NextResponse.json(
      {
        error: validation.issue.error,
        sourceSurface,
      },
      { status: validation.issue.status },
    );
  }

  const extraction = await extract({
    transcriptText: validation.transcriptText,
    image: validation.image,
  });

  if (!extraction.rawText) {
    return NextResponse.json(
      {
        error: extraction.hadImage
          ? "That screenshot did not produce readable text. Try a tighter crop or paste the transcript directly."
          : "Add a screenshot or paste the chat transcript first so Acre has something to extract from.",
        sourceSurface,
        ...extraction,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ...extraction,
    sourceSurface,
  });
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
