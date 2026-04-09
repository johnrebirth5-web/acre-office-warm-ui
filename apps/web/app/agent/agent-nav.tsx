"use client";

import {
  WorkspaceNav,
  type WorkspaceNavGroup,
} from "../_components/workspace-nav";
import { useI18n } from "../../lib/i18n/client";

export function AgentNav() {
  const { t } = useI18n();
  const frontOfficeNavGroups: WorkspaceNavGroup[] = [
    {
      title: t((messages) => messages.agentNav.groups.execution),
      icon: "◫",
      items: [
        { href: "/agent/dashboard", label: t((messages) => messages.agentNav.items.dashboard) },
        { href: "/agent/clients", label: t((messages) => messages.agentNav.items.clients) },
        { href: "/agent/calendar", label: t((messages) => messages.agentNav.items.calendar) },
        { href: "/agent/listings", label: t((messages) => messages.agentNav.items.listings) },
        { href: "/agent/notifications", label: t((messages) => messages.agentNav.items.activity) },
        { href: "/agent/resources", label: t((messages) => messages.agentNav.items.resources) },
      ],
    },
  ];

  return (
    <WorkspaceNav
      brandPanelClassName="agent-brand-panel"
      currentWorkspaceName={t((messages) => messages.agentNav.workspaceName)}
      homeHref="/agent/dashboard"
      navGroups={frontOfficeNavGroups}
      navigationLabel={t((messages) => messages.agentNav.navigationLabel)}
      releaseBadgeClassName="site-release-badge-agent-panel"
      sidebarClassName="agent-sidebar"
      switcherClassName="agent-company-switcher"
      switcherLabel={t((messages) => messages.agentNav.switcherLabel)}
      switcherShortcuts={[
        {
          href: "/listing-studio/dashboard",
          label: t((messages) => messages.agentNav.shortcuts.listingStudio.label),
          description: t((messages) => messages.agentNav.shortcuts.listingStudio.description),
        },
        {
          href: "/office/dashboard",
          label: t((messages) => messages.agentNav.shortcuts.backOffice.label),
          description: t((messages) => messages.agentNav.shortcuts.backOffice.description),
        },
      ]}
    />
  );
}
