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
  canViewOfficeOffers,
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
import { CompanySwitcher } from "../_components/company-switcher";
import { useI18n } from "../../lib/i18n/client";

function canViewUnifiedUsers(subject: PermissionSubject) {
  return canViewOfficeUsers(subject) || canViewOfficeAgents(subject);
}

function canViewOfficeResourcesWorkspace(subject: PermissionSubject) {
  return (
    (typeof subject === "string" ? subject : subject.role) === "office_admin"
  );
}

function getNavGroups(
  subject: PermissionSubject,
  mailUnreadCount: number,
  t: ReturnType<typeof useI18n>["t"],
): WorkspaceNavGroup[] {
  return [
    {
      title: t((messages) => messages.officeNav.groups.overview),
      icon: "◫",
      items: [
        {
          label: t((messages) => messages.officeNav.items.dashboard),
          href: "/office/dashboard",
        },
        {
          label: t((messages) => messages.officeNav.items.pipeline),
          href: "/office/pipeline",
        },
        {
          label: t((messages) => messages.officeNav.items.transactions),
          href: "/office/transactions",
          isVisible: canViewOfficeTransactions,
        },
        {
          label: t((messages) => messages.officeNav.items.offers),
          href: "/office/offers",
          isVisible: canViewOfficeOffers,
        },
        {
          label: t((messages) => messages.officeNav.items.contacts),
          href: "/office/contacts",
          isVisible: canViewOfficeContacts,
        },
        {
          label: t((messages) => messages.officeNav.items.reports),
          href: "/office/reports",
          isVisible: canViewOfficeReports,
        },
        {
          label: t((messages) => messages.officeNav.items.performance),
          href: "/office/performance",
          isVisible: canViewOfficeReports,
        },
        {
          label: t((messages) => messages.officeNav.items.activity),
          href: "/office/activity",
          isVisible: canAccessAccountActivity,
        },
        {
          label: t((messages) => messages.officeNav.items.library),
          href: "/office/library",
          isVisible: canViewOfficeLibrary,
        },
        {
          label: t((messages) => messages.officeNav.items.resources),
          href: "/office/resources",
          isVisible: canViewOfficeResourcesWorkspace,
        },
        {
          label: t((messages) => messages.officeNav.items.signatures),
          href: "/office/signatures",
          isVisible: canViewOfficeSignatures,
        },
        {
          label: t((messages) => messages.officeNav.items.accounting),
          href: "/office/accounting",
          isVisible: canAccessOfficeAdminAccountingWorkspace,
        },
        {
          label: t((messages) => messages.officeNav.items.tracker1099),
          href: "/office/1099-tracker",
          isVisible: canAccessOffice1099Tracker,
        },
      ]
        .filter((item) => item.isVisible?.(subject) ?? true)
        .map(({ isVisible: _isVisible, ...item }) => item),
    },
    {
      title: t((messages) => messages.officeNav.groups.todo),
      icon: "◔",
      items: [
        {
          label: t((messages) => messages.officeNav.items.approveDocs),
          href: "/office/approve-docs",
          isVisible: canAccessOfficeDocumentApprovals,
        },
        {
          label: t((messages) => messages.officeNav.items.taskList),
          href: "/office/tasks",
          isVisible: canAccessOfficeTasks,
        },
      ]
        .filter((item) => item.isVisible?.(subject) ?? true)
        .map(({ isVisible: _isVisible, ...item }) => item),
    },
    {
      title: t((messages) => messages.officeNav.groups.settings),
      icon: "⚙",
      items: [
        {
          label: t((messages) => messages.officeNav.items.settings),
          href: "/office/settings",
          isVisible: canAccessOfficeSettings,
        },
        {
          label: t((messages) => messages.officeNav.items.roles),
          href: "/office/settings/roles",
          isVisible: canManageOfficeSettings,
        },
        {
          label: t((messages) => messages.officeNav.items.users),
          href: "/office/settings/users",
          isVisible: canViewUnifiedUsers,
        },
        {
          label: t((messages) => messages.officeNav.items.teams),
          href: "/office/settings/teams",
          isVisible: canViewOfficeTeams,
        },
        {
          label: t((messages) => messages.officeNav.items.checklists),
          href: "/office/settings/checklists",
          isVisible: canViewOfficeChecklists,
        },
        {
          label: t((messages) => messages.officeNav.items.fields),
          href: "/office/settings/fields",
          isVisible: canViewOfficeFields,
        },
        {
          label: t((messages) => messages.officeNav.items.commissionPlans),
          href: "/office/settings/commission-plans",
          isVisible: canAccessOfficeCommissionWorkspace,
        },
      ]
        .filter((item) => item.isVisible?.(subject) ?? true)
        .map(({ isVisible: _isVisible, ...item }) => item),
    },
    {
      title: t((messages) => messages.officeNav.groups.user),
      icon: "◉",
      items: [
        {
          label: t((messages) => messages.officeNav.items.mail),
          href: "/office/mail",
          badgeText: mailUnreadCount > 0 ? `+${mailUnreadCount}` : undefined,
          isVisible: canAccessOfficeMail,
        },
        {
          label: t((messages) => messages.officeNav.items.notifications),
          href: "/office/notifications",
          isVisible: canAccessOfficeNotifications,
        },
        {
          label: t((messages) => messages.officeNav.items.account),
          href: "/office/account",
        },
        {
          label: t((messages) => messages.officeNav.items.billing),
          href: "/office/billing",
        },
        {
          label: t((messages) => messages.officeNav.items.addOns),
          kind: "muted" as const,
        },
        {
          label: t((messages) => messages.officeNav.items.signOut),
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
  currentCompanyId: string | null;
  companies: Array<{ id: string; name: string }>;
};

export function OfficeNav({
  currentOfficeName,
  currentAccess,
  currentCompanyId,
  companies,
}: OfficeNavProps) {
  const { t } = useI18n();
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

    window.addEventListener(
      "office-mail-unread-changed",
      handleUnreadCountRefresh,
    );

    return () => {
      isActive = false;
      window.removeEventListener(
        "office-mail-unread-changed",
        handleUnreadCountRefresh,
      );
    };
  }, [canViewMail, mailRefreshKey]);

  return (
    <WorkspaceNav
      companySwitcher={
        <CompanySwitcher
          companies={companies}
          currentCompanyId={currentCompanyId}
          homeHref="/office/dashboard"
        />
      }
      currentWorkspaceName={t((messages) => messages.officeNav.workspaceName)}
      homeHref="/office/dashboard"
      mobileCompanySwitcher={
        <CompanySwitcher
          className="office-mobile-workspace-secondary-switcher"
          companies={companies}
          currentCompanyId={currentCompanyId}
          homeHref="/office/dashboard"
        />
      }
      navGroups={getNavGroups(currentAccess, mailUnreadCount, t)}
      navigationLabel={t((messages) => messages.officeNav.navigationLabel)}
      switcherLabel={t((messages) => messages.officeNav.switcherShortLabel)}
      switcherShortcuts={[
        {
          href: "/agent/dashboard",
          label: t(
            (messages) => messages.officeNav.shortcuts.frontOffice.label,
          ),
          description: t(
            (messages) => messages.officeNav.shortcuts.frontOffice.description,
          ),
        },
      ]}
    />
  );
}
