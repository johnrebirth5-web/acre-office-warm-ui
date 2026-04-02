"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  canAccessAccountActivity,
  canAccessOfficeMail,
  canAccessOffice1099Tracker,
  canAccessOfficeAdminAccountingWorkspace,
  canAccessOfficeCommissionWorkspace,
  canAccessOfficeDocumentApprovals,
  canAccessOfficeNotifications,
  canAccessOfficeSettings,
  canAccessOfficeTasks,
  canManageOfficeSettings,
  canViewOfficeAgents,
  canViewOfficeChecklists,
  canViewOfficeContacts,
  canViewOfficeFields,
  canViewOfficeLibrary,
  canViewOfficeReports,
  canViewOfficeSignatures,
  canViewOfficeTeams,
  canViewOfficeTransactions,
  canViewOfficeUsers,
  type PermissionSubject,
} from "@acre/auth";
import {
  WorkspaceNav,
  type WorkspaceNavGroup,
} from "../_components/workspace-nav";

function canViewUnifiedUsers(subject: PermissionSubject) {
  return canViewOfficeUsers(subject) || canViewOfficeAgents(subject);
}

function getNavGroups(
  subject: PermissionSubject,
  mailUnreadCount: number
): WorkspaceNavGroup[] {
  return [
    {
      title: "Overview",
      icon: "◫",
      items: [
        { label: "Dashboard", href: "/office/dashboard" },
        { label: "Pipeline", href: "/office/pipeline" },
        {
          label: "Transactions",
          href: "/office/transactions",
          isVisible: canViewOfficeTransactions,
        },
        {
          label: "Contacts",
          href: "/office/contacts",
          isVisible: canViewOfficeContacts,
        },
        {
          label: "Reports",
          href: "/office/reports",
          isVisible: canViewOfficeReports,
        },
        {
          label: "Performance",
          href: "/office/performance",
          isVisible: canViewOfficeReports,
        },
        {
          label: "Activity",
          href: "/office/activity",
          isVisible: canAccessAccountActivity,
        },
        {
          label: "Library",
          href: "/office/library",
          isVisible: canViewOfficeLibrary,
        },
        {
          label: "Signatures",
          href: "/office/signatures",
          isVisible: canViewOfficeSignatures,
        },
        {
          label: "Accounting",
          href: "/office/accounting",
          isVisible: canAccessOfficeAdminAccountingWorkspace,
        },
        {
          label: "1099 Tracker",
          href: "/office/1099-tracker",
          isVisible: canAccessOffice1099Tracker,
        },
      ]
        .filter((item) => item.isVisible?.(subject) ?? true)
        .map(({ isVisible: _isVisible, ...item }) => item),
    },
    {
      title: "To Do",
      icon: "◔",
      items: [
        {
          label: "Approve docs",
          href: "/office/approve-docs",
          isVisible: canAccessOfficeDocumentApprovals,
        },
        {
          label: "Task list",
          href: "/office/tasks",
          isVisible: canAccessOfficeTasks,
        },
      ]
        .filter((item) => item.isVisible?.(subject) ?? true)
        .map(({ isVisible: _isVisible, ...item }) => item),
    },
    {
      title: "Settings",
      icon: "⚙",
      items: [
        {
          label: "Settings",
          href: "/office/settings",
          isVisible: canAccessOfficeSettings,
        },
        {
          label: "Roles",
          href: "/office/settings/roles",
          isVisible: canManageOfficeSettings,
        },
        {
          label: "Users",
          href: "/office/settings/users",
          isVisible: canViewUnifiedUsers,
        },
        {
          label: "Teams",
          href: "/office/settings/teams",
          isVisible: canViewOfficeTeams,
        },
        {
          label: "Checklists",
          href: "/office/settings/checklists",
          isVisible: canViewOfficeChecklists,
        },
        {
          label: "Fields",
          href: "/office/settings/fields",
          isVisible: canViewOfficeFields,
        },
        {
          label: "Commission plans",
          href: "/office/settings/commission-plans",
          isVisible: canAccessOfficeCommissionWorkspace,
        },
      ]
        .filter((item) => item.isVisible?.(subject) ?? true)
        .map(({ isVisible: _isVisible, ...item }) => item),
    },
    {
      title: "User",
      icon: "◉",
      items: [
        {
          label: "Mail",
          href: "/office/mail",
          badgeText: mailUnreadCount > 0 ? `+${mailUnreadCount}` : undefined,
          isVisible: canAccessOfficeMail,
        },
        {
          label: "Notifications",
          href: "/office/notifications",
          isVisible: canAccessOfficeNotifications,
        },
        { label: "Account", href: "/office/account" },
        { label: "Billing", href: "/office/billing" },
        { label: "Add-ons", kind: "muted" as const },
        {
          label: "Sign out",
          kind: "submit" as const,
          formAction: "/api/auth/logout",
        },
      ]
        .filter((item) => item.isVisible?.(subject) ?? true)
        .map(({ isVisible: _isVisible, ...item }) => item),
    },
  ].filter((group) => group.items.length > 0);
}

type OfficeNavProps = {
  currentOfficeName: string;
  currentAccess: PermissionSubject;
};

export function OfficeNav({
  currentOfficeName,
  currentAccess,
}: OfficeNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canViewMail = canAccessOfficeMail(currentAccess);
  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const mailRefreshKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    if (!canViewMail) {
      setMailUnreadCount(0);
      return;
    }

    let isActive = true;

    async function loadMailUnreadCount() {
      try {
        const response = await fetch("/api/office/mail/unread-count", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const body = (await response.json().catch(() => null)) as {
          unreadCount?: number;
        } | null;

        if (isActive) {
          setMailUnreadCount(Number(body?.unreadCount) || 0);
        }
      } catch {
        if (isActive) {
          setMailUnreadCount(0);
        }
      }
    }

    void loadMailUnreadCount();

    function handleUnreadCountRefresh() {
      void loadMailUnreadCount();
    }

    window.addEventListener("office-mail-unread-changed", handleUnreadCountRefresh);

    return () => {
      isActive = false;
      window.removeEventListener("office-mail-unread-changed", handleUnreadCountRefresh);
    };
  }, [canViewMail, mailRefreshKey]);

  return (
    <WorkspaceNav
      currentWorkspaceName="Back Office"
      homeHref="/office/dashboard"
      navGroups={getNavGroups(currentAccess, mailUnreadCount)}
      navigationLabel="Office navigation"
      switcherLabel="Workspace"
      switcherShortcut={{
        href: "/agent/dashboard",
        label: "Front Office",
        description: "Clients, outreach, calendar, and active follow-up",
      }}
    />
  );
}
