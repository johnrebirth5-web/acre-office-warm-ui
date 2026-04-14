import { NextResponse } from "next/server";
import {
  FRONT_OFFICE_LEAD_INTAKE_OCR_MAX_IMAGE_BYTES,
  buildFrontOfficeLeadIntakeOcrMetadata,
  normalizeFrontOfficeLeadIntakeOcrText,
  recognizeFrontOfficeLeadIntakeOcrImage,
  type FrontOfficeLeadIntakeOcrMetadata,
} from "./front-office-intake-ocr";
import {
  buildFrontOfficeLeadIntakeAiPreviewText,
  extractFrontOfficeLeadIntakeWithOpenAi,
} from "./front-office-intake-openai";
import type { FrontOfficeLeadIntakeAiExtraction } from "./front-office-intake-ai";

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

type FrontOfficeLeadIntakeAssistServerWarningCode =
  | "empty_payload"
  | "oversized_image"
  | "ocr_failed"
  | "transcript_fallback"
  | "no_readable_text";

type FrontOfficeLeadIntakeAssistServerWarning = {
  code: FrontOfficeLeadIntakeAssistServerWarningCode;
  label: string;
  detail: string;
};

type FrontOfficeLeadIntakeAssistServerProvenance = {
  transcript: {
    present: boolean;
    source: "form_data" | "none";
  };
  image: {
    present: boolean;
    source: "upload" | "none";
    ocrAttempted: boolean;
    ocrSucceeded: boolean;
  };
  rawText: {
    sourceMode: FrontOfficeLeadIntakeAssistServerSourceMode;
    transcriptIncluded: boolean;
    ocrIncluded: boolean;
    fallbackUsed: boolean;
  };
};

type FrontOfficeLeadIntakeAssistServerMetadata = {
  ocr: FrontOfficeLeadIntakeOcrMetadata;
  provenance: FrontOfficeLeadIntakeAssistServerProvenance;
  warnings: FrontOfficeLeadIntakeAssistServerWarning[];
};

type FrontOfficeLeadIntakeAssistServerInput = {
  transcriptText?: string;
  image?: Blob | null;
  recognizeImage?: (image: Blob) => Promise<string>;
  extractWithOpenAi?: typeof extractFrontOfficeLeadIntakeWithOpenAi;
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
  aiExtraction: FrontOfficeLeadIntakeAiExtraction | null;
  metadata: FrontOfficeLeadIntakeAssistServerMetadata;
};

export const FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES =
  FRONT_OFFICE_LEAD_INTAKE_OCR_MAX_IMAGE_BYTES;

const defaultFrontOfficeLeadIntakeAssistRouteDependencies = {
  canViewOfficeContacts: (_subject: unknown) => true,
  readFormData: readFrontOfficeLeadIntakeAssistServerFormData,
  validateInput: validateFrontOfficeLeadIntakeAssistServerInput,
  extract: extractFrontOfficeLeadIntakeAssistServer,
};

function combineAssistText(transcriptText: string, ocrText: string) {
  return [transcriptText, ocrText].filter(Boolean).join("\n\n").trim();
}

function buildFrontOfficeLeadIntakeAssistServerMetadata(input: {
  transcriptText: string;
  image: Blob | null;
  ocr: FrontOfficeLeadIntakeOcrMetadata;
  transcriptFallbackUsed: boolean;
  sourceMode: FrontOfficeLeadIntakeAssistServerSourceMode;
  warningCodes?: FrontOfficeLeadIntakeAssistServerWarningCode[];
}): FrontOfficeLeadIntakeAssistServerMetadata {
  const transcriptPresent = Boolean(
    normalizeFrontOfficeLeadIntakeOcrText(input.transcriptText),
  );
  const imagePresent = Boolean(input.image);
  const warningCodes = new Set(input.warningCodes ?? []);
  const warnings: FrontOfficeLeadIntakeAssistServerWarning[] = [];

  if (warningCodes.has("empty_payload")) {
    warnings.push({
      code: "empty_payload",
      label: "No intake source supplied",
      detail:
        "Add a screenshot or paste the transcript so Acre has a source trail to review.",
    });
  }

  if (warningCodes.has("oversized_image")) {
    warnings.push({
      code: "oversized_image",
      label: "Screenshot too large for OCR",
      detail:
        `The uploaded image crossed the ${input.ocr.capability.maxImageBytes / (1024 * 1024)} MB local OCR limit, so Acre stopped before local Tesseract ran.`,
    });
  }

  if (imagePresent && input.ocr.attempted && !input.ocr.succeeded) {
    warnings.push({
      code: "ocr_failed",
      label: "Screenshot OCR returned no text",
      detail:
        "Acre ran the local-only OCR resolver with local Tesseract, but the image did not produce readable text.",
    });
  }

  if (input.transcriptFallbackUsed) {
    warnings.push({
      code: "transcript_fallback",
      label: "Transcript used as fallback",
      detail:
        "The pasted transcript supplied the usable text after the local-only OCR resolver did not return a readable extract.",
    });
  }

  if (warningCodes.has("no_readable_text")) {
    warnings.push({
      code: "no_readable_text",
      label: "No readable intake text yet",
      detail:
        "Try a tighter crop or paste the conversation directly so Acre can extract fields from the source text.",
    });
  }

  return {
    ocr: input.ocr,
    provenance: {
      transcript: {
        present: transcriptPresent,
        source: transcriptPresent ? "form_data" : "none",
      },
      image: {
        present: imagePresent,
        source: imagePresent ? "upload" : "none",
        ocrAttempted: input.ocr.attempted,
        ocrSucceeded: input.ocr.succeeded,
      },
      rawText: {
        sourceMode: input.sourceMode,
        transcriptIncluded: transcriptPresent,
        ocrIncluded: input.ocr.succeeded && imagePresent,
        fallbackUsed: input.transcriptFallbackUsed,
      },
    },
    warnings,
  };
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
  metadata: FrontOfficeLeadIntakeAssistServerMetadata;
  issue: FrontOfficeLeadIntakeAssistServerValidationIssue | null;
} {
  const transcriptText = normalizeFrontOfficeLeadIntakeOcrText(
    input.transcriptText,
  );
  const image = input.image;

  if (
    image &&
    image.size > FRONT_OFFICE_LEAD_INTAKE_ASSIST_MAX_IMAGE_BYTES
  ) {
    return {
      transcriptText,
      image,
      sourceSurface: input.sourceSurface,
      metadata: buildFrontOfficeLeadIntakeAssistServerMetadata({
        transcriptText,
        image,
        ocr: buildFrontOfficeLeadIntakeOcrMetadata({
          attempted: false,
          succeeded: false,
          fallbackUsed: false,
        }),
        transcriptFallbackUsed: false,
        sourceMode:
          transcriptText && image ? "hybrid" : image ? "image" : "text",
        warningCodes: ["oversized_image"],
      }),
      issue: {
        error:
          "That screenshot is too large for local OCR. Try a tighter crop under 10 MB.",
        status: 413,
      },
    };
  }

  if (!transcriptText && !image) {
    return {
      transcriptText,
      image: null,
      sourceSurface: input.sourceSurface,
      metadata: buildFrontOfficeLeadIntakeAssistServerMetadata({
        transcriptText,
        image: null,
        ocr: buildFrontOfficeLeadIntakeOcrMetadata({
          attempted: false,
          succeeded: false,
          fallbackUsed: false,
        }),
        transcriptFallbackUsed: false,
        sourceMode: "text",
        warningCodes: ["empty_payload"],
      }),
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
    metadata: buildFrontOfficeLeadIntakeAssistServerMetadata({
      transcriptText,
      image,
      ocr: buildFrontOfficeLeadIntakeOcrMetadata({
        attempted: false,
        succeeded: false,
        fallbackUsed: false,
      }),
      transcriptFallbackUsed: false,
      sourceMode:
        transcriptText && image ? "hybrid" : image ? "image" : "text",
    }),
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
        metadata: validation.metadata,
      },
      { status: validation.issue.status },
    );
  }

  const extraction = await extract({
    transcriptText: validation.transcriptText,
    image: validation.image,
  });

  if (!extraction.rawText && !extraction.aiExtraction?.fields.length) {
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
  return recognizeFrontOfficeLeadIntakeOcrImage(image);
}

export async function extractFrontOfficeLeadIntakeAssistServer(
  input: FrontOfficeLeadIntakeAssistServerInput,
): Promise<FrontOfficeLeadIntakeAssistServerResult> {
  const transcriptText = normalizeFrontOfficeLeadIntakeOcrText(
    input.transcriptText ?? "",
  );
  const hadImage = Boolean(input.image);

  let ocrText = "";
  let ocrSucceeded = false;
  let transcriptFallbackUsed = false;

  if (input.image) {
    try {
      const recognizeImage =
        input.recognizeImage ?? recognizeFrontOfficeLeadIntakeAssistImage;
      ocrText = normalizeFrontOfficeLeadIntakeOcrText(
        await recognizeImage(input.image),
      );
      ocrSucceeded = true;
    } catch {
      ocrText = "";
      ocrSucceeded = false;
    }
  }

  transcriptFallbackUsed = hadImage && Boolean(transcriptText) && !ocrText;
  const sourceMode: FrontOfficeLeadIntakeAssistServerSourceMode =
    hadImage && transcriptText
      ? "hybrid"
      : hadImage
        ? "image"
        : "text";
  const rawText = combineAssistText(transcriptText, ocrText);
  let aiExtraction: FrontOfficeLeadIntakeAiExtraction | null = null;

  try {
    const extractWithOpenAi =
      input.extractWithOpenAi ?? extractFrontOfficeLeadIntakeWithOpenAi;

    aiExtraction = await extractWithOpenAi({
      rawText,
      transcriptText,
      ocrText,
      image: input.image ?? null,
      sourceMode,
    });
  } catch {
    aiExtraction = null;
  }

  const previewText =
    !rawText && aiExtraction ? buildFrontOfficeLeadIntakeAiPreviewText(aiExtraction) : rawText;

  return {
    rawText: previewText,
    sourceMode,
    transcriptText,
    ocrText,
    hadImage,
    ocrSucceeded,
    transcriptFallbackUsed,
    aiExtraction,
    metadata: buildFrontOfficeLeadIntakeAssistServerMetadata({
      transcriptText,
      image: input.image ?? null,
      ocr: buildFrontOfficeLeadIntakeOcrMetadata({
        attempted: hadImage,
        succeeded: ocrSucceeded,
        fallbackUsed: hadImage && Boolean(transcriptText) && !ocrText,
      }),
      transcriptFallbackUsed,
      sourceMode,
      warningCodes:
        !previewText && hadImage ? ["no_readable_text"] : undefined,
    }),
  };
}
