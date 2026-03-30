"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  canAccessOfficeCommissionWorkspace,
  canAccessOfficeSettings,
  canViewOfficeAgents,
  canViewOfficeChecklists,
  canViewOfficeFields,
  canViewOfficeTeams,
  canViewOfficeUsers,
  canManageOfficeSettings,
  type PermissionSubject
} from "@acre/auth";

function getSettingsLinks(currentAccess: PermissionSubject) {
  return [
    { href: "/office/settings", label: "Overview", isVisible: canAccessOfficeSettings(currentAccess) },
    { href: "/office/settings/roles", label: "Roles", isVisible: canManageOfficeSettings(currentAccess) },
    { href: "/office/settings/email-delivery", label: "Email delivery", isVisible: canManageOfficeSettings(currentAccess) },
    { href: "/office/settings/users", label: "Users", isVisible: canViewOfficeUsers(currentAccess) || canViewOfficeAgents(currentAccess) },
    { href: "/office/settings/teams", label: "Teams", isVisible: canViewOfficeTeams(currentAccess) },
    { href: "/office/settings/fields", label: "Fields", isVisible: canViewOfficeFields(currentAccess) },
    { href: "/office/settings/checklists", label: "Checklists", isVisible: canViewOfficeChecklists(currentAccess) },
    { href: "/office/settings/commission-plans", label: "Commission plans", isVisible: canAccessOfficeCommissionWorkspace(currentAccess) }
  ].filter((link) => link.isVisible);
}

type OfficeSettingsNavProps = {
  currentAccess: PermissionSubject;
};

export function OfficeSettingsNav({ currentAccess }: OfficeSettingsNavProps) {
  const pathname = usePathname();
  const settingsLinks = getSettingsLinks(currentAccess);

  return (
    <nav className="office-settings-nav" aria-label="Office settings sections">
      {settingsLinks.map((link) => {
        const isActive = link.href === "/office/settings" ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link className={`office-settings-nav-link${isActive ? " is-active" : ""}`} href={link.href} key={link.href}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
