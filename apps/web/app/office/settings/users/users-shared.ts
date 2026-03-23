import type { OfficeAdminUserDetailSnapshot, OfficeAdminUserRow } from "@acre/db";

export const createRoleOptions = [
  { value: "owner", label: "Owner" },
  { value: "office_admin", label: "Office Admin" },
  { value: "accountant", label: "Accountant" },
  { value: "human_resources", label: "Human Resources" },
  { value: "team_lead", label: "Team Lead" },
  { value: "agent", label: "Agent" }
] as const;

type UserSecurityShape = Pick<
  OfficeAdminUserRow,
  "statusValue" | "hasCredential" | "mustChangePassword" | "hasActiveInvitation" | "roleValue"
>;

type RoleEditorOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type EditableUserShape = Pick<OfficeAdminUserRow, "roleValue" | "statusValue" | "hasCredential"> & {
  hasActiveTeamAssignments?: boolean;
  hasActiveLeaderAssignments?: boolean;
};
type EditableUserDetailShape = Pick<
  OfficeAdminUserDetailSnapshot["profile"],
  "roleValue" | "statusValue" | "hasCredential" | "hasActiveTeamAssignments" | "hasActiveLeaderAssignments"
>;

function isTeamHierarchyAssignableRoleValue(roleValue: string) {
  return roleValue === "agent" || roleValue === "team_lead";
}

export function getRoleConfigurationHint(role: string) {
  if (role === "team_lead") {
    return "This controls account permissions only. Team hierarchy, branch ownership, and reporting lines are managed in Settings > Teams.";
  }

  if (role === "agent") {
    return "This controls account permissions only. Branch assignment and direct leader relationships are managed in Settings > Teams.";
  }

  return "This changes the system permission template. Team structure and reporting relationships are managed separately in Settings > Teams.";
}

export function getMembershipTone(status: OfficeAdminUserRow["statusValue"] | OfficeAdminUserDetailSnapshot["profile"]["statusValue"]) {
  if (status === "active") {
    return "success" as const;
  }

  if (status === "invited") {
    return "accent" as const;
  }

  return "neutral" as const;
}

export function getOnboardingTone(status: OfficeAdminUserDetailSnapshot["profile"]["onboardingStatusValue"]) {
  if (status === "complete") {
    return "success" as const;
  }

  if (status === "in_progress") {
    return "accent" as const;
  }

  return "warning" as const;
}

export function getAuthTone(user: UserSecurityShape) {
  if (user.mustChangePassword) {
    return "warning" as const;
  }

  if (user.hasCredential) {
    return "success" as const;
  }

  if (user.statusValue === "invited") {
    return "accent" as const;
  }

  return "neutral" as const;
}

export function getInvitationTone(user: UserSecurityShape) {
  if (user.hasActiveInvitation) {
    return "accent" as const;
  }

  if (user.statusValue === "invited") {
    return "warning" as const;
  }

  if (user.hasCredential) {
    return "success" as const;
  }

  return "neutral" as const;
}

export function getRoleEditorOptions(user: EditableUserShape | EditableUserDetailShape) {
  const baseOptions: RoleEditorOption[] =
    user.roleValue === "office_manager"
      ? [{ value: "office_manager", label: "Office Manager (Legacy)" }, ...createRoleOptions]
      : user.roleValue === "office_user"
        ? [{ value: "office_user", label: "Office User (Legacy)" }, ...createRoleOptions]
        : [...createRoleOptions];
  const lockAgentRole = Boolean(user.hasActiveLeaderAssignments) && user.roleValue !== "agent";
  const lockNonHierarchyRoles = Boolean(user.hasActiveTeamAssignments);

  return baseOptions.map((option) => {
    if (option.value === "agent" && lockAgentRole) {
      return {
        ...option,
        label: "Agent (remove team leadership first)",
        disabled: true
      };
    }

    if (lockNonHierarchyRoles && !isTeamHierarchyAssignableRoleValue(option.value) && option.value !== user.roleValue) {
      return {
        ...option,
        label: `${option.label} (remove team assignments first)`,
        disabled: true
      };
    }

    return option;
  });
}

export function getStatusEditorOptions(user: EditableUserShape | EditableUserDetailShape) {
  if (user.hasCredential) {
    return [
      { value: "active", label: "Active" },
      { value: "disabled", label: "Disabled" }
    ];
  }

  if (user.statusValue === "invited") {
    return [
      { value: "invited", label: "Invited" },
      { value: "disabled", label: "Disabled" }
    ];
  }

  return [
    { value: "disabled", label: "Disabled" },
    { value: "invited", label: "Invited" }
  ];
}

export function getIssueLinkLabel(user: UserSecurityShape) {
  if (user.hasActiveInvitation) {
    return user.statusValue === "invited" ? "Reissue invite" : "Reissue setup link";
  }

  if (user.statusValue === "invited") {
    return "Issue invite";
  }

  return user.hasCredential ? "Reset password" : "Issue setup link";
}

export function formatInviteExpiry(isoValue: string) {
  const expiresAt = new Date(isoValue);

  if (Number.isNaN(expiresAt.getTime())) {
    return "Pending";
  }

  return expiresAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export async function copyTextToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("Clipboard access is not available in this browser.");
  }

  await navigator.clipboard.writeText(value);
}
