"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  canAccessOfficeCommissionWorkspace,
  canAccessOfficeSettings,
  canManageOfficeSignatureTemplates,
  canViewOfficeAgents,
  canViewOfficeChecklists,
  canViewOfficeFields,
  canViewOfficeTeams,
  canViewOfficeUsers,
  canManageOfficeSettings,
  type PermissionSubject
} from "@acre/auth";
import { useI18n } from "../../../lib/i18n/client";

function getSettingsLinks(currentAccess: PermissionSubject, isZh: boolean) {
  return [
    { href: "/office/settings", label: isZh ? "总览" : "Overview", isVisible: canAccessOfficeSettings(currentAccess) },
    { href: "/office/settings/roles", label: isZh ? "角色" : "Roles", isVisible: canManageOfficeSettings(currentAccess) },
    { href: "/office/settings/email-delivery", label: isZh ? "邮件发送" : "Email delivery", isVisible: canManageOfficeSettings(currentAccess) },
    { href: "/office/settings/quickbooks", label: "QuickBooks", isVisible: canManageOfficeSettings(currentAccess) },
    { href: "/office/settings/users", label: isZh ? "用户与成员" : "Users", isVisible: canViewOfficeUsers(currentAccess) || canViewOfficeAgents(currentAccess) },
    { href: "/office/settings/teams", label: isZh ? "团队" : "Teams", isVisible: canViewOfficeTeams(currentAccess) },
    { href: "/office/settings/fields", label: isZh ? "字段" : "Fields", isVisible: canViewOfficeFields(currentAccess) },
    { href: "/office/settings/checklists", label: isZh ? "清单" : "Checklists", isVisible: canViewOfficeChecklists(currentAccess) },
    { href: "/office/settings/signature-drive", label: isZh ? "签署归档" : "Signature Drive", isVisible: canManageOfficeSignatureTemplates(currentAccess) || canManageOfficeSettings(currentAccess) },
    { href: "/office/settings/commission-plans", label: isZh ? "佣金方案" : "Commission plans", isVisible: canAccessOfficeCommissionWorkspace(currentAccess) }
  ].filter((link) => link.isVisible);
}

type OfficeSettingsNavProps = {
  currentAccess: PermissionSubject;
};

export function OfficeSettingsNav({ currentAccess }: OfficeSettingsNavProps) {
  const pathname = usePathname();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const settingsLinks = getSettingsLinks(currentAccess, isZh);

  return (
    <nav className="office-settings-nav" aria-label={isZh ? "后台设置分区" : "Office settings sections"}>
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
