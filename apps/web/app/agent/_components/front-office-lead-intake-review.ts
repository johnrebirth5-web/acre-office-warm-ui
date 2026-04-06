export type FrontOfficeLeadDuplicatePreviewCandidate = {
  id: string;
  fullName: string;
  stage: string;
  sourceLabel: string;
  nextTouchLabel: string;
  href: string;
  areasLabel?: string;
};

export type FrontOfficeLeadDuplicatePreviewNeedle = {
  fullName: string;
  sourceLabel: string;
  preferredAreas?: string;
  source?: string;
};

export type FrontOfficeLeadDuplicatePreviewMatch = {
  id: string;
  fullName: string;
  stage: string;
  sourceLabel: string;
  nextTouchLabel: string;
  href: string;
  confidenceLabel: string;
  matchStrength: number;
  matchReasons: string[];
};

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeCompact(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function normalizeLoose(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
}

function buildAreaTokens(value: string | undefined) {
  if (!value) {
    return new Set<string>();
  }

  return new Set(
    value
      .split(/,|，|\/|;|；|、/)
      .map((item) => normalizeLoose(item))
      .filter(
        (item) =>
          item.length >= 2 && !item.includes("not captured") && item !== "unknown",
      ),
  );
}

function buildMeaningfulSource(value: string | undefined) {
  const normalized = normalizeLoose(value ?? "");

  if (!normalized || normalized === "manual entry") {
    return "";
  }

  return normalized;
}

function scoreCandidateMatch(input: {
  candidate: FrontOfficeLeadDuplicatePreviewCandidate;
  needle: FrontOfficeLeadDuplicatePreviewNeedle;
}) {
  const candidateCompact = normalizeCompact(input.candidate.fullName);
  const needleCompact = normalizeCompact(input.needle.fullName);

  if (!candidateCompact || !needleCompact || candidateCompact !== needleCompact) {
    return null;
  }

  const reasons = [`Same name as ${input.needle.sourceLabel}`];
  let score = 2;

  const needleAreas = buildAreaTokens(input.needle.preferredAreas);
  const candidateAreas = buildAreaTokens(input.candidate.areasLabel);

  if (needleAreas.size > 0 && candidateAreas.size > 0) {
    const overlappingAreas = [...needleAreas].filter((token) =>
      candidateAreas.has(token),
    );

    if (overlappingAreas.length > 0) {
      reasons.push(`Area overlap: ${overlappingAreas.slice(0, 2).join(", ")}`);
      score += 1;
    }
  }

  const candidateSource = buildMeaningfulSource(input.candidate.sourceLabel);
  const needleSource = buildMeaningfulSource(input.needle.source);

  if (candidateSource && needleSource && candidateSource === needleSource) {
    reasons.push("Source label also lines up");
    score += 1;
  }

  return {
    score,
    reasons,
  };
}

function buildConfidenceLabel(score: number) {
  if (score >= 4) {
    return "Strong visible match";
  }

  if (score >= 3) {
    return "Likely visible match";
  }

  return "Visible name match";
}

export function buildFrontOfficeLeadDuplicatePreview(input: {
  candidates: FrontOfficeLeadDuplicatePreviewCandidate[];
  needles: FrontOfficeLeadDuplicatePreviewNeedle[];
}) {
  const merged = new Map<string, FrontOfficeLeadDuplicatePreviewMatch>();

  for (const needle of input.needles) {
    if (!needle.fullName.trim()) {
      continue;
    }

    for (const candidate of input.candidates) {
      const scored = scoreCandidateMatch({
        candidate,
        needle,
      });

      if (!scored) {
        continue;
      }

      const existing = merged.get(candidate.id);
      const nextReasons = existing
        ? [...new Set([...existing.matchReasons, ...scored.reasons])]
        : scored.reasons;
      const nextScore = existing
        ? Math.max(existing.matchStrength, scored.score)
        : scored.score;

      merged.set(candidate.id, {
        id: candidate.id,
        fullName: candidate.fullName,
        stage: candidate.stage,
        sourceLabel: candidate.sourceLabel,
        nextTouchLabel: candidate.nextTouchLabel,
        href: candidate.href,
        confidenceLabel: buildConfidenceLabel(nextScore),
        matchStrength: nextScore,
        matchReasons: nextReasons,
      });
    }
  }

  return [...merged.values()]
    .sort(
      (left, right) =>
        right.matchStrength - left.matchStrength ||
        left.fullName.localeCompare(right.fullName),
    )
    .slice(0, 4);
}
