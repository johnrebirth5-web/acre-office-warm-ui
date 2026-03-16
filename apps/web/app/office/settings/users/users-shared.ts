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

type EditableUserShape = Pick<OfficeAdminUserRow, "roleValue" | "statusValue" | "hasCredential">;
type EditableUserDetailShape = Pick<OfficeAdminUserDetailSnapshot["profile"], "roleValue" | "statusValue" | "hasCredential">;

export function getRoleConfigurationHint(role: string) {
  if (role === "team_lead") {
    return "Team Lead 是账号权限层级。Leader I / Leader II 和直属汇报关系需要在 Settings > Teams 里设置。";
  }

  if (role === "agent") {
    return "Agent 是账号权限层级。成员归属、直属 Leader I / Leader II，以及是否独立都在 Settings > Teams 里维护。";
  }

  return "这里选择的是系统权限角色；团队层级和直属关系单独在 Settings > Teams 里维护。";
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
  if (user.roleValue === "office_manager") {
    return [{ value: "office_manager", label: "Office Manager (Legacy)" }, ...createRoleOptions];
  }

  if (user.roleValue === "office_user") {
    return [{ value: "office_user", label: "Office User (Legacy)" }, ...createRoleOptions];
  }

  return createRoleOptions;
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
