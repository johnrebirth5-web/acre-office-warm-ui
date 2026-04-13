export type FrontOfficeLeadDuplicatePreviewCandidate = {
  id: string;
  fullName: string;
  stage: string;
  sourceLabel: string;
  nextTouchLabel: string;
  href: string;
  areasLabel?: string;
  email?: string;
  phone?: string;
};

export type FrontOfficeLeadDuplicatePreviewNeedle = {
  fullName: string;
  sourceLabel: string;
  preferredAreas?: string;
  source?: string;
  email?: string;
  phone?: string;
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
  recommendedActionLabel: string;
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

function normalizeEmail(value: string | undefined) {
  return normalizeWhitespace(value ?? "").toLowerCase();
}

function normalizePhoneDigits(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function buildNameTokens(value: string) {
  return normalizeLoose(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreNameMatch(candidateName: string, needleName: string) {
  const candidateCompact = normalizeCompact(candidateName);
  const needleCompact = normalizeCompact(needleName);

  if (!candidateCompact || !needleCompact) {
    return null;
  }

  if (candidateCompact === needleCompact) {
    return {
      score: 4,
      reason: "Same normalized name",
    };
  }

  const candidateTokens = buildNameTokens(candidateName);
  const needleTokens = buildNameTokens(needleName);

  if (!candidateTokens.length || !needleTokens.length) {
    return null;
  }

  const overlappingTokens = needleTokens.filter((token) =>
    candidateTokens.includes(token),
  );
  const smallerTokenCount = Math.min(
    candidateTokens.length,
    needleTokens.length,
  );

  if (
    smallerTokenCount >= 2 &&
    overlappingTokens.length === smallerTokenCount
  ) {
    return {
      score: 3,
      reason: "Same name tokens in a different order",
    };
  }

  return null;
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
          item.length >= 2 &&
          !item.includes("not captured") &&
          item !== "unknown",
      ),
  );
}

function buildMeaningfulSource(value: string | undefined) {
  const normalized = normalizeLoose(value ?? "");

  if (!normalized || normalized === "manual entry") {
    return "";
  }

  if (normalized.includes("wechat")) {
    return "wechat";
  }

  if (normalized.includes("referral")) {
    return "referral";
  }

  if (normalized.includes("open house")) {
    return "open house";
  }

  return normalized;
}

function hasReason(reasons: string[], predicate: (reason: string) => boolean) {
  return reasons.some(predicate);
}

function scoreCandidateMatch(input: {
  candidate: FrontOfficeLeadDuplicatePreviewCandidate;
  needle: FrontOfficeLeadDuplicatePreviewNeedle;
}) {
  const reasons: string[] = [];
  let score = 0;
  const normalizedCandidateEmail = normalizeEmail(input.candidate.email);
  const normalizedNeedleEmail = normalizeEmail(input.needle.email);
  const normalizedCandidatePhone = normalizePhoneDigits(input.candidate.phone);
  const normalizedNeedlePhone = normalizePhoneDigits(input.needle.phone);
  const nameMatch = input.needle.fullName
    ? scoreNameMatch(input.candidate.fullName, input.needle.fullName)
    : null;

  if (
    normalizedCandidateEmail &&
    normalizedNeedleEmail &&
    normalizedCandidateEmail === normalizedNeedleEmail
  ) {
    reasons.push(`Same email from ${input.needle.sourceLabel}`);
    score += 5;
  }

  if (
    normalizedCandidatePhone &&
    normalizedNeedlePhone &&
    normalizedCandidatePhone === normalizedNeedlePhone
  ) {
    reasons.push(`Same phone from ${input.needle.sourceLabel}`);
    score += 4;
  }

  if (nameMatch) {
    reasons.push(`${nameMatch.reason} from ${input.needle.sourceLabel}`);
    score += nameMatch.score;
  }

  if (!reasons.length) {
    return null;
  }

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

function buildConfidenceLabel(input: { score: number; reasons: string[] }) {
  const hasEmail = hasReason(input.reasons, (reason) =>
    reason.startsWith("Same email"),
  );
  const hasPhone = hasReason(input.reasons, (reason) =>
    reason.startsWith("Same phone"),
  );
  const hasName = hasReason(input.reasons, (reason) => reason.includes("name"));

  if (hasEmail && hasPhone) {
    return "Very high visible duplicate risk";
  }

  if (hasEmail || hasPhone) {
    return input.score >= 6
      ? "High visible duplicate risk"
      : "Likely visible duplicate via contact info";
  }

  if (hasName && input.score >= 4) {
    return "Likely visible duplicate, review first";
  }

  return "Visible name collision only, review first";
}

function buildRecommendedActionLabel(reasons: string[]) {
  const hasEmail = hasReason(reasons, (reason) =>
    reason.startsWith("Same email"),
  );
  const hasPhone = hasReason(reasons, (reason) =>
    reason.startsWith("Same phone"),
  );
  const hasContactInfoMatch = hasEmail || hasPhone;
  const hasNameMatch = hasReason(reasons, (reason) => reason.includes("name"));
  const hasAreaOverlap = hasReason(reasons, (reason) =>
    reason.startsWith("Area overlap"),
  );
  const hasSourceMatch = hasReason(reasons, (reason) =>
    reason.startsWith("Source label also lines up"),
  );

  if (hasEmail && hasPhone) {
    return "Open the existing record first, compare contact info, next step, and source, and only create a new lead if it is clearly different.";
  }

  if (hasContactInfoMatch) {
    return "Open the existing record first, compare contact info, stage, and next step, then review duplicates only if it looks like the same person.";
  }

  if (hasNameMatch) {
    return "Compare phone, email, stage, and preferred areas in the existing record before creating anything new.";
  }

  if (hasAreaOverlap || hasSourceMatch) {
    return "Open the existing record first, then compare preferred areas, source, and next step before deciding whether to create a separate client record.";
  }

  return "Review the existing record first, then compare contact details, stage, and next step before creating a separate client record.";
}

export function buildFrontOfficeLeadDuplicatePreview(input: {
  candidates: FrontOfficeLeadDuplicatePreviewCandidate[];
  needles: FrontOfficeLeadDuplicatePreviewNeedle[];
}) {
  const merged = new Map<string, FrontOfficeLeadDuplicatePreviewMatch>();

  for (const needle of input.needles) {
    if (
      !needle.fullName.trim() &&
      !normalizeEmail(needle.email) &&
      !normalizePhoneDigits(needle.phone)
    ) {
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
        confidenceLabel: buildConfidenceLabel({
          score: nextScore,
          reasons: nextReasons,
        }),
        matchStrength: nextScore,
        matchReasons: nextReasons,
        recommendedActionLabel: buildRecommendedActionLabel(nextReasons),
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
