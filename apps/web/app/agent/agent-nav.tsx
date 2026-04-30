"use client";

import {
  WorkspaceNav,
  type WorkspaceNavGroup,
} from "../_components/workspace-nav";
import { CompanySwitcher } from "../_components/company-switcher";
import { useI18n } from "../../lib/i18n/client";

type AgentNavProps = {
  currentCompanyId: string | null;
  companies: Array<{ id: string; name: string }>;
  homeHref: string;
  permissions: string[];
};

export function AgentNav({
  currentCompanyId,
  companies,
  homeHref,
  permissions,
}: AgentNavProps) {
  const { t } = useI18n();
  const canViewDashboard = permissions.includes("dashboard:view");
  const canViewClients = permissions.includes("clients:view");
  const canViewProjects =
    permissions.includes("project_signing:view") ||
    permissions.includes("signatures:view");
  const canViewStudio = permissions.includes("listing_studio:view");
  const canViewResources = permissions.includes("resources:view");
  const canViewActivity =
    permissions.includes("notifications:view") ||
    permissions.includes("events:view") ||
    permissions.includes("clients:view") ||
    permissions.includes("dashboard:view");
  const restrictedBadge = t(
    (messages) => messages.workspaceNav.restrictedNavBadge,
  );

  function buildAccessWarning(label: string) {
    return {
      title: t((messages) => messages.workspaceNav.restrictedNavTitle, {
        feature: label,
      }),
      description: t(
        (messages) => messages.workspaceNav.restrictedNavDescription,
        {
          feature: label,
        },
      ),
    };
  }

  const frontOfficeNavGroups: WorkspaceNavGroup[] = [
    {
      title: t((messages) => messages.agentNav.groups.execution),
      icon: "◫",
      items: [
        {
          href: "/agent/dashboard",
          label: t((messages) => messages.agentNav.items.dashboard),
          accessWarning: canViewDashboard
            ? undefined
            : buildAccessWarning(
                t((messages) => messages.agentNav.items.dashboard),
              ),
          badgeText: canViewDashboard ? undefined : restrictedBadge,
        },
        {
          href: "/agent/clients",
          label: t((messages) => messages.agentNav.items.clients),
          accessWarning: canViewClients
            ? undefined
            : buildAccessWarning(
                t((messages) => messages.agentNav.items.clients),
              ),
          badgeText: canViewClients ? undefined : restrictedBadge,
        },
        {
          href: "/agent/projects",
          label: t((messages) => messages.agentNav.items.projects),
          accessWarning: canViewProjects
            ? undefined
            : buildAccessWarning(
                t((messages) => messages.agentNav.items.projects),
              ),
          badgeText: canViewProjects ? undefined : restrictedBadge,
        },
        {
          href: "/agent/calendar",
          label: t((messages) => messages.agentNav.items.calendar),
          accessWarning: canViewDashboard
            ? undefined
            : buildAccessWarning(
                t((messages) => messages.agentNav.items.calendar),
              ),
          badgeText: canViewDashboard ? undefined : restrictedBadge,
        },
        {
          href: "/listing-studio/listings",
          label: t((messages) => messages.agentNav.items.studio),
          accessWarning: canViewStudio
            ? undefined
            : buildAccessWarning(
                t((messages) => messages.agentNav.items.studio),
              ),
          badgeText: canViewStudio ? undefined : restrictedBadge,
          children: [
            {
              href: "/listing-studio/dashboard",
              label: t((messages) => messages.agentNav.items.studioDashboard),
              accessWarning: canViewStudio
                ? undefined
                : buildAccessWarning(
                    t((messages) => messages.agentNav.items.studio),
                  ),
              badgeText: canViewStudio ? undefined : restrictedBadge,
            },
            {
              href: "/listing-studio/listings",
              label: t((messages) => messages.agentNav.items.studioListings),
              accessWarning: canViewStudio
                ? undefined
                : buildAccessWarning(
                    t((messages) => messages.agentNav.items.studio),
                  ),
              badgeText: canViewStudio ? undefined : restrictedBadge,
            },
            {
              href: "/listing-studio/collections",
              label: t((messages) => messages.agentNav.items.studioCollections),
              accessWarning: canViewStudio
                ? undefined
                : buildAccessWarning(
                    t((messages) => messages.agentNav.items.studio),
                  ),
              badgeText: canViewStudio ? undefined : restrictedBadge,
            },
            {
              href: "/listing-studio/shares",
              label: t((messages) => messages.agentNav.items.studioShares),
              accessWarning: canViewStudio
                ? undefined
                : buildAccessWarning(
                    t((messages) => messages.agentNav.items.studio),
                  ),
              badgeText: canViewStudio ? undefined : restrictedBadge,
            },
          ],
        },
        {
          href: "/agent/notifications",
          label: t((messages) => messages.agentNav.items.activity),
          accessWarning: canViewActivity
            ? undefined
            : buildAccessWarning(
                t((messages) => messages.agentNav.items.activity),
              ),
          badgeText: canViewActivity ? undefined : restrictedBadge,
        },
        {
          href: "/agent/resources",
          label: t((messages) => messages.agentNav.items.resources),
          accessWarning: canViewResources
            ? undefined
            : buildAccessWarning(
                t((messages) => messages.agentNav.items.resources),
              ),
          badgeText: canViewResources ? undefined : restrictedBadge,
        },
      ],
    },
  ];

  return (
    <WorkspaceNav
      brandPanelClassName="agent-brand-panel"
      companySwitcher={
        <CompanySwitcher
          companies={companies}
          currentCompanyId={currentCompanyId}
          homeHref={homeHref}
        />
      }
      currentWorkspaceName={t((messages) => messages.agentNav.workspaceName)}
      homeHref={homeHref}
      mobileCompanySwitcher={
        <CompanySwitcher
          className="office-mobile-workspace-secondary-switcher"
          companies={companies}
          currentCompanyId={currentCompanyId}
          homeHref={homeHref}
        />
      }
      navGroups={frontOfficeNavGroups}
      navigationLabel={t((messages) => messages.agentNav.navigationLabel)}
      releaseBadgeClassName="site-release-badge-agent-panel"
      sidebarClassName="agent-sidebar"
      switcherClassName="agent-company-switcher"
      switcherLabel={t((messages) => messages.agentNav.switcherLabel)}
      switcherShortcuts={[
        {
          href: "/office/dashboard",
          label: t((messages) => messages.agentNav.shortcuts.backOffice.label),
          description: t(
            (messages) => messages.agentNav.shortcuts.backOffice.description,
          ),
        },
      ]}
    />
  );
}
