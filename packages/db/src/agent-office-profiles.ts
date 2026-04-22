import { type AgentOnboardingStatus } from "@prisma/client";

type SharedAgentProfileLike = {
  notes?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  startDate?: Date | null;
  onboardingStatus?: AgentOnboardingStatus | null;
  internalExtension?: string | null;
};

type AgentOfficeProfileLike = {
  id?: string;
  officeId: string;
  notes?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  expirationDate?: Date | null;
  onboardingStatus?: AgentOnboardingStatus | null;
  internalExtension?: string | null;
};

type MembershipAgentOfficeProfilesLike = {
  officeId?: string | null;
  agentProfile?: SharedAgentProfileLike | null;
  agentOfficeProfiles?: AgentOfficeProfileLike[];
};

export type ResolvedAgentOfficeProfileFields = {
  hasOfficeProfile: boolean;
  officeProfileId: string;
  officeId: string | null;
  notes: string;
  licenseNumber: string;
  licenseState: string;
  expirationDate: Date | null;
  onboardingStatus: AgentOnboardingStatus;
  internalExtension: string;
};

export function buildAgentOfficeProfileSeed(sharedProfile?: SharedAgentProfileLike | null) {
  return {
    notes: sharedProfile?.notes ?? null,
    licenseNumber: sharedProfile?.licenseNumber ?? null,
    licenseState: sharedProfile?.licenseState ?? null,
    expirationDate: sharedProfile?.startDate ?? null,
    onboardingStatus: sharedProfile?.onboardingStatus ?? "not_started",
    internalExtension: sharedProfile?.internalExtension ?? null,
  };
}

export function findAgentOfficeProfileForOffice(
  membership: MembershipAgentOfficeProfilesLike,
  officeId?: string | null,
) {
  const targetOfficeId = officeId ?? membership.officeId ?? null;

  if (!targetOfficeId) {
    return null;
  }

  return (
    membership.agentOfficeProfiles?.find(
      (profile) => profile.officeId === targetOfficeId,
    ) ?? null
  );
}

export function resolveAgentOfficeProfileFields(
  sharedProfile?: SharedAgentProfileLike | null,
  officeProfile?: AgentOfficeProfileLike | null,
): ResolvedAgentOfficeProfileFields {
  if (officeProfile) {
    return {
      hasOfficeProfile: true,
      officeProfileId: officeProfile.id ?? "",
      officeId: officeProfile.officeId,
      notes: officeProfile.notes ?? "",
      licenseNumber: officeProfile.licenseNumber ?? "",
      licenseState: officeProfile.licenseState ?? "",
      expirationDate: officeProfile.expirationDate ?? null,
      onboardingStatus:
        officeProfile.onboardingStatus ??
        sharedProfile?.onboardingStatus ??
        "not_started",
      internalExtension: officeProfile.internalExtension ?? "",
    };
  }

  return {
    hasOfficeProfile: false,
    officeProfileId: "",
    officeId: null,
    notes: sharedProfile?.notes ?? "",
    licenseNumber: sharedProfile?.licenseNumber ?? "",
    licenseState: sharedProfile?.licenseState ?? "",
    expirationDate: sharedProfile?.startDate ?? null,
    onboardingStatus: sharedProfile?.onboardingStatus ?? "not_started",
    internalExtension: sharedProfile?.internalExtension ?? "",
  };
}
