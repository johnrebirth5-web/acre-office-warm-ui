import type { UserRole } from "@acre/auth";

export type OfficeScopeRecord = {
  id: string;
  name: string;
  slug: string;
  market: string;
  isPrimary: boolean;
};

export type MembershipOfficeAccessRecord = {
  officeId: string;
  office: OfficeScopeRecord;
};

const implicitAllOfficeRoles = new Set<UserRole>([
  "owner",
  "office_admin",
  "office_manager",
]);

function sortOffices(offices: readonly OfficeScopeRecord[]) {
  return [...offices].sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function roleHasImplicitAllOfficeAccess(role: UserRole) {
  return implicitAllOfficeRoles.has(role);
}

export function resolveMembershipAccessibleOffices(input: {
  role: UserRole;
  allOffices: readonly OfficeScopeRecord[];
  defaultOfficeId: string | null;
  officeAccesses?: readonly MembershipOfficeAccessRecord[];
}) {
  const allOffices = sortOffices(input.allOffices);

  if (roleHasImplicitAllOfficeAccess(input.role)) {
    return allOffices;
  }

  if (input.officeAccesses && input.officeAccesses.length > 0) {
    const officesById = new Map(allOffices.map((office) => [office.id, office]));
    return sortOffices(
      input.officeAccesses
        .map((access) => officesById.get(access.officeId) ?? access.office)
        .filter((office): office is OfficeScopeRecord => Boolean(office)),
    );
  }

  if (input.defaultOfficeId) {
    const defaultOffice =
      allOffices.find((office) => office.id === input.defaultOfficeId) ?? null;

    if (defaultOffice) {
      return [defaultOffice];
    }
  }

  return allOffices;
}

export function resolveCurrentOfficeSelection(input: {
  activeOfficeId?: string | null;
  defaultOfficeId: string | null;
  accessibleOffices: readonly OfficeScopeRecord[];
}) {
  const accessibleOffices = sortOffices(input.accessibleOffices);

  if (accessibleOffices.length === 0) {
    return null;
  }

  if (input.activeOfficeId) {
    const activeOffice = accessibleOffices.find(
      (office) => office.id === input.activeOfficeId,
    );

    if (activeOffice) {
      return activeOffice;
    }
  }

  if (input.defaultOfficeId) {
    const defaultOffice = accessibleOffices.find(
      (office) => office.id === input.defaultOfficeId,
    );

    if (defaultOffice) {
      return defaultOffice;
    }
  }

  return accessibleOffices[0] ?? null;
}

export function normalizeSelectedOfficeIds(
  officeIds: readonly string[] | null | undefined,
) {
  return [...new Set((officeIds ?? []).map((officeId) => officeId.trim()).filter(Boolean))];
}

export function resolveMembershipOfficeAssignment(input: {
  role: UserRole;
  allOffices: readonly OfficeScopeRecord[];
  defaultOfficeId?: string | null;
  selectedOfficeIds?: readonly string[] | null;
}) {
  const allOffices = sortOffices(input.allOffices);
  const officesById = new Map(allOffices.map((office) => [office.id, office]));
  const nextDefaultOfficeId =
    typeof input.defaultOfficeId === "string" && input.defaultOfficeId.trim()
      ? input.defaultOfficeId.trim()
      : null;

  if (nextDefaultOfficeId && !officesById.has(nextDefaultOfficeId)) {
    throw new Error("Selected default company was not found.");
  }

  if (roleHasImplicitAllOfficeAccess(input.role)) {
    return {
      hasImplicitAllOfficeAccess: true,
      defaultOfficeId: nextDefaultOfficeId,
      explicitOfficeIds: [] as string[],
    };
  }

  const selectedOfficeIds = normalizeSelectedOfficeIds(input.selectedOfficeIds).filter(
    (officeId) => officesById.has(officeId),
  );
  const explicitOfficeIds = selectedOfficeIds.length
    ? selectedOfficeIds
    : nextDefaultOfficeId
      ? [nextDefaultOfficeId]
      : [];

  if (explicitOfficeIds.length === 0) {
    throw new Error("Choose at least one company for this member.");
  }

  const resolvedDefaultOfficeId = nextDefaultOfficeId ?? explicitOfficeIds[0] ?? null;

  if (!resolvedDefaultOfficeId) {
    throw new Error("Choose a default company for this member.");
  }

  if (!explicitOfficeIds.includes(resolvedDefaultOfficeId)) {
    throw new Error("Default company must be included in company access.");
  }

  return {
    hasImplicitAllOfficeAccess: false,
    defaultOfficeId: resolvedDefaultOfficeId,
    explicitOfficeIds,
  };
}
