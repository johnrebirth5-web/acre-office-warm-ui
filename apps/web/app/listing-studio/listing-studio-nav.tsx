"use client";

import {
  WorkspaceNav,
  type WorkspaceNavGroup,
} from "../_components/workspace-nav";

const listingStudioNavGroups: WorkspaceNavGroup[] = [
  {
    title: "Studio",
    icon: "◫",
    items: [
      { href: "/listing-studio/dashboard", label: "Dashboard" },
      { href: "/listing-studio/listings", label: "Listings" },
    ],
  },
];

export function ListingStudioNav() {
  return (
    <WorkspaceNav
      currentWorkspaceName="Listing Studio"
      homeHref="/listing-studio/dashboard"
      navGroups={listingStudioNavGroups}
      navigationLabel="Listing Studio navigation"
      switcherClassName="listing-studio-switcher"
      switcherLabel="Workspace"
      switcherShortcuts={[
        {
          href: "/agent/dashboard",
          label: "Front Office",
          description: "Clients, calendar, outreach, and active follow-up",
        },
        {
          href: "/office/dashboard",
          label: "Back Office",
          description: "Transactions, approvals, accounting, and formal ops",
        },
      ]}
    />
  );
}
