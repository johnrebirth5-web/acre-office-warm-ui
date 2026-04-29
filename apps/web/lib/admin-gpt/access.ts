import { can, type PermissionSubject, type UserRole } from "@acre/auth";

const ADMIN_GPT_ROLES = new Set<UserRole>(["owner", "office_admin"]);

function getSubjectRole(subject: PermissionSubject) {
  return typeof subject === "string" ? subject : subject.role;
}

export function canAccessAdminGpt(subject: PermissionSubject) {
  return ADMIN_GPT_ROLES.has(getSubjectRole(subject)) && can(subject, "ai:use");
}
