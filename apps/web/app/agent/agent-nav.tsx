"use client";

import {
  WorkspaceNav,
  type WorkspaceNavGroup,
} from "../_components/workspace-nav";

const frontOfficeNavGroups: WorkspaceNavGroup[] = [
  {
    title: "Execution",
    icon: "◫",
    items: [
      { href: "/agent/dashboard", label: "Dashboard" },
      { href: "/agent/clients", label: "Clients" },
      { href: "/agent/calendar", label: "Calendar" },
      { href: "/agent/listings", label: "Listings" },
      { href: "/agent/notifications", label: "Activity" },
      { href: "/agent/resources", label: "Resources" },
    ],
  },
  {
    title: "Handoff",
    icon: "↔",
    items: [
      {
        label: "Front Office",
        badgeText: "clients, follow-up, calendar",
        kind: "muted",
      },
      {
        label: "Back Office",
        badgeText: "transactions, signatures, accounting",
        kind: "muted",
      },
    ],
  },
];

export function AgentNav() {
  return (
    <WorkspaceNav
      brandPanelClassName="agent-brand-panel"
      currentWorkspaceName="Front Office"
      homeHref="/agent/dashboard"
      navGroups={frontOfficeNavGroups}
      navigationLabel="Front Office workbench navigation"
      releaseBadgeClassName="site-release-badge-agent-panel"
      sidebarClassName="agent-sidebar"
      switcherClassName="agent-company-switcher"
      switcherLabel="Active workspace"
      switcherShortcuts={[
        {
          href: "/listing-studio/dashboard",
          label: "Listing Studio",
          description: "Capture listing packets, client-ready exports, and outbound materials",
        },
        {
          href: "/office/dashboard",
          label: "Back Office",
          description: "Transactions, signatures, accounting, and formal handoff",
        },
      ]}
    />
  );
}
