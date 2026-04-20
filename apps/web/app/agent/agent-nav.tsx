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
};

export function AgentNav({ currentCompanyId, companies, homeHref }: AgentNavProps) {
  const { t } = useI18n();
  const frontOfficeNavGroups: WorkspaceNavGroup[] = [
    {
      title: t((messages) => messages.agentNav.groups.execution),
      icon: "◫",
      items: [
        {
          href: "/agent/dashboard",
          label: t((messages) => messages.agentNav.items.dashboard),
        },
        {
          href: "/agent/clients",
          label: t((messages) => messages.agentNav.items.clients),
        },
        {
          href: "/agent/calendar",
          label: t((messages) => messages.agentNav.items.calendar),
        },
        {
          href: "/agent/listings",
          label: t((messages) => messages.agentNav.items.listings),
        },
        {
          href: "/listing-studio/listings",
          label: t((messages) => messages.agentNav.items.studio),
          children: [
            {
              href: "/listing-studio/dashboard",
              label: t((messages) => messages.agentNav.items.studioDashboard),
            },
            {
              href: "/listing-studio/listings",
              label: t((messages) => messages.agentNav.items.studioListings),
            },
            {
              href: "/listing-studio/collections",
              label: t((messages) => messages.agentNav.items.studioCollections),
            },
            {
              href: "/listing-studio/shares",
              label: t((messages) => messages.agentNav.items.studioShares),
            },
          ],
        },
        {
          href: "/agent/notifications",
          label: t((messages) => messages.agentNav.items.activity),
        },
        {
          href: "/agent/resources",
          label: t((messages) => messages.agentNav.items.resources),
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
