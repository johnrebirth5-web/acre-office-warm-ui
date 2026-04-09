export type FrontOfficeLeadIntakeOcrProvider = "local_tesseract";

export type FrontOfficeLeadIntakeOcrMode = "server_side";

export type FrontOfficeLeadIntakeOcrFallback = "none" | "transcript";

export type FrontOfficeLeadIntakeOcrMetadata = {
  provider: FrontOfficeLeadIntakeOcrProvider;
  mode: FrontOfficeLeadIntakeOcrMode;
  attempted: boolean;
  succeeded: boolean;
  fallback: FrontOfficeLeadIntakeOcrFallback;
};

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
  return {
    provider: "local_tesseract",
    mode: "server_side",
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
