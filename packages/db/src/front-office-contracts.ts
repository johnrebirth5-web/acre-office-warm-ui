export const frontOfficeHandoffStagePatterns = [
  "negotiation",
  "application",
  "offer",
  "won",
  "contract",
] as const;

export function isFrontOfficeStageReadyForBackOffice(
  stage: string | null | undefined,
) {
  const normalized = stage?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return false;
  }

  return frontOfficeHandoffStagePatterns.some((pattern) =>
    normalized.includes(pattern),
  );
}

export function buildFrontOfficeHandoffSummary(
  stage: string,
  clientName: string,
) {
  return `${clientName} reached ${stage}. Formal transaction, signatures, or archival workflow should continue in Back Office.`;
}
