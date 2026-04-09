export type FrontOfficeLeadIntakeOcrProvider = "local_tesseract";
export type FrontOfficeLeadIntakeOcrProviderChain =
  readonly FrontOfficeLeadIntakeOcrProvider[];
export type FrontOfficeLeadIntakeOcrMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp";
export type FrontOfficeLeadIntakeOcrResolverMode = "local_only";

export type FrontOfficeLeadIntakeOcrFallback = "none" | "transcript";

export const FRONT_OFFICE_LEAD_INTAKE_OCR_MAX_IMAGE_BYTES =
  10 * 1024 * 1024;

export const FRONT_OFFICE_LEAD_INTAKE_OCR_ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const satisfies readonly FrontOfficeLeadIntakeOcrMimeType[];

export const FRONT_OFFICE_LEAD_INTAKE_OCR_PROVIDER_CHAIN = [
  "local_tesseract",
] as const satisfies FrontOfficeLeadIntakeOcrProviderChain;

export type FrontOfficeLeadIntakeOcrCapability = {
  resolverMode: FrontOfficeLeadIntakeOcrResolverMode;
  providerBacked: false;
  providerChain: FrontOfficeLeadIntakeOcrProviderChain;
  maxImageBytes: number;
  acceptedMimeTypes: readonly FrontOfficeLeadIntakeOcrMimeType[];
  fallbackStory: "transcript_fallback";
};

export type FrontOfficeLeadIntakeOcrResolver = {
  capability: FrontOfficeLeadIntakeOcrCapability;
  selectedProvider: FrontOfficeLeadIntakeOcrProvider;
};

export type FrontOfficeLeadIntakeOcrMetadata = {
  capability: FrontOfficeLeadIntakeOcrCapability;
  providerChain: FrontOfficeLeadIntakeOcrProviderChain;
  provider: FrontOfficeLeadIntakeOcrProvider;
  resolverMode: FrontOfficeLeadIntakeOcrResolverMode;
  attempted: boolean;
  succeeded: boolean;
  fallback: FrontOfficeLeadIntakeOcrFallback;
};

const FRONT_OFFICE_LEAD_INTAKE_OCR_CAPABILITY: FrontOfficeLeadIntakeOcrCapability =
  {
    resolverMode: "local_only",
    providerBacked: false,
    providerChain: FRONT_OFFICE_LEAD_INTAKE_OCR_PROVIDER_CHAIN,
    maxImageBytes: FRONT_OFFICE_LEAD_INTAKE_OCR_MAX_IMAGE_BYTES,
    acceptedMimeTypes: FRONT_OFFICE_LEAD_INTAKE_OCR_ACCEPTED_MIME_TYPES,
    fallbackStory: "transcript_fallback",
  };

export function resolveFrontOfficeLeadIntakeOcrContract(): FrontOfficeLeadIntakeOcrResolver {
  return {
    capability: FRONT_OFFICE_LEAD_INTAKE_OCR_CAPABILITY,
    selectedProvider: FRONT_OFFICE_LEAD_INTAKE_OCR_PROVIDER_CHAIN[0],
  };
}

export function normalizeFrontOfficeLeadIntakeOcrText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export function buildFrontOfficeLeadIntakeOcrMetadata(input: {
  attempted: boolean;
  succeeded: boolean;
  fallbackUsed: boolean;
}): FrontOfficeLeadIntakeOcrMetadata {
  const contract = resolveFrontOfficeLeadIntakeOcrContract();

  return {
    capability: contract.capability,
    providerChain: contract.capability.providerChain,
    provider: contract.selectedProvider,
    resolverMode: contract.capability.resolverMode,
    attempted: input.attempted,
    succeeded: input.succeeded,
    fallback: input.fallbackUsed ? "transcript" : "none",
  };
}

export async function recognizeFrontOfficeLeadIntakeOcrImage(
  image: Blob,
  recognizeImage?: (image: Blob) => Promise<string>,
) {
  const recognize =
    recognizeImage ??
    (async (blob: Blob) => {
      const { recognize } = await import("tesseract.js");
      const { data } = await recognize(blob, "eng+chi_sim");
      return String(data.text ?? "");
    });

  return normalizeFrontOfficeLeadIntakeOcrText(
    await recognize(image),
  );
}
