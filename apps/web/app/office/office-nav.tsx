"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  canAccessAccountActivity,
  canAccessOfficeAccounting,
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
  canViewOfficeTeams,
  canViewOfficeTransactions,
  canViewOfficeUsers,
  type PermissionSubject
} from "@acre/auth";
import { SiteReleaseBadge } from "../site-release-badge";

type NavGroup = {
  title: string;
  icon: string;
  items: Array<{ label: string; href?: string; isVisible?: (subject: PermissionSubject) => boolean }>;
};

function canViewUnifiedUsers(subject: PermissionSubject) {
  return canViewOfficeUsers(subject) || canViewOfficeAgents(subject);
}

function getNavGroups(subject: PermissionSubject): NavGroup[] {
  return [
    {
      title: "Overview",
      icon: "◫",
      items: [
        { label: "Dashboard", href: "/office/dashboard" },
        { label: "Pipeline", href: "/office/pipeline", isVisible: canViewOfficeTransactions },
        { label: "Transactions", href: "/office/transactions", isVisible: canViewOfficeTransactions },
        { label: "Contacts", href: "/office/contacts", isVisible: canViewOfficeContacts },
        { label: "Reports", href: "/office/reports", isVisible: canViewOfficeReports },
        { label: "Activity", href: "/office/activity", isVisible: canAccessAccountActivity },
        { label: "Library", href: "/office/library", isVisible: canViewOfficeLibrary },
        { label: "Accounting", href: "/office/accounting", isVisible: canAccessOfficeAccounting }
      ].filter((item) => item.isVisible?.(subject) ?? true)
    },
    {
      title: "To Do",
      icon: "◔",
      items: [
        { label: "Approve docs", href: "/office/approve-docs", isVisible: canAccessOfficeDocumentApprovals },
        { label: "Task list", href: "/office/tasks", isVisible: canAccessOfficeTasks }
      ].filter((item) => item.isVisible?.(subject) ?? true)
    },
    {
      title: "Settings",
      icon: "⚙",
      items: [
        { label: "Settings", href: "/office/settings", isVisible: canAccessOfficeSettings },
        { label: "Roles", href: "/office/settings/roles", isVisible: canManageOfficeSettings },
        { label: "Users", href: "/office/settings/users", isVisible: canViewUnifiedUsers },
        { label: "Teams", href: "/office/settings/teams", isVisible: canViewOfficeTeams },
        { label: "Checklists", href: "/office/settings/checklists", isVisible: canViewOfficeChecklists },
        { label: "Fields", href: "/office/settings/fields", isVisible: canViewOfficeFields },
        { label: "Commission plans", href: "/office/accounting#commission-management", isVisible: canAccessOfficeAccounting }
      ].filter((item) => item.isVisible?.(subject) ?? true)
    },
    {
      title: "User",
      icon: "◉",
      items: [
        { label: "Notifications", href: "/office/notifications", isVisible: canAccessOfficeNotifications },
        { label: "Account", href: "/office/account" },
        { label: "Billing", href: "/office/billing" },
        { label: "Add-ons" },
        { label: "Sign out" }
      ].filter((item) => item.isVisible?.(subject) ?? true)
    }
  ].filter((group) => group.items.length > 0);
}

type OfficeNavProps = {
  currentOfficeName: string;
  currentAccess: PermissionSubject;
};

function normalizeHref(href: string) {
  const [path, hashFragment] = href.split("#");
  return `${path}${hashFragment ? `#${hashFragment}` : ""}`;
}

function splitLocationKey(locationKey: string) {
  const [path, hashFragment] = locationKey.split("#");
  return {
    path,
    hash: hashFragment ? `#${hashFragment}` : ""
  };
}

export function OfficeNav({ currentOfficeName, currentAccess }: OfficeNavProps) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");
  const [pendingLocationKey, setPendingLocationKey] = useState<string | null>(null);
  const navGroups = getNavGroups(currentAccess);

  useLayoutEffect(() => {
    function syncHash() {
      setCurrentHash(window.location.hash);
    }

    syncHash();
  }, [pathname]);

  useEffect(() => {
    function syncHash() {
      setCurrentHash(window.location.hash);
    }

    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);

    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);

  const actualLocationKey = `${pathname}${currentHash}`;
  const effectiveLocationKey = pendingLocationKey ?? actualLocationKey;
  const effectiveLocation = splitLocationKey(effectiveLocationKey);

  useEffect(() => {
    if (pendingLocationKey && pendingLocationKey === actualLocationKey) {
      setPendingLocationKey(null);
    }
  }, [actualLocationKey, pendingLocationKey]);

  function hasHashVariant(path: string) {
    return navGroups.some((group) => group.items.some((item) => item.href?.startsWith(`${path}#`)));
  }

  function handleNavIntent(href: string) {
    setPendingLocationKey(normalizeHref(href));
  }

  function isSidebarItemActive(href: string) {
    const [path, hashFragment] = href.split("#");
    const targetHash = hashFragment ? `#${hashFragment}` : "";

    if (targetHash) {
      return effectiveLocation.path === path && effectiveLocation.hash === targetHash;
    }

    if (hasHashVariant(path)) {
      return effectiveLocation.path === path && effectiveLocation.hash.length === 0;
    }

    return effectiveLocation.path === path;
  }

  function isMobileSectionActive(href: string) {
    const path = href.split("#")[0];

    return pathname === path || pathname.startsWith(`${path}/`);
  }

  return (
    <>
      <aside className="sidebar office-dashboard-sidebar">
        <div className="office-logo-panel">
          <Image
            alt="Acre New York Realty logo"
            className="office-logo-image"
            height={1404}
            priority
            src="/acre-logo-nyr.png"
            width={1175}
          />
        </div>

        <SiteReleaseBadge className="site-release-badge-office" />

        <div className="office-company-switcher">
          <strong>{currentOfficeName.toUpperCase()}</strong>
          <span>▾</span>
        </div>

        <div className="office-nav-groups">
          {navGroups.map((group) => (
            <section className="office-nav-group" key={group.title}>
              <header className="office-nav-header">
                <span>{group.icon}</span>
                <strong>{group.title}</strong>
              </header>
              <div className="office-nav-items">
                {group.items.map((item) => {
                  if (item.href) {
                    const href = item.href;

                    return (
                      <Link
                        key={item.label}
                        className={`office-nav-link${isSidebarItemActive(href) ? " is-active" : ""}`}
                        href={href}
                        onClick={() => handleNavIntent(href)}
                      >
                        {item.label}
                      </Link>
                    );
                  }

                  if (item.label === "Sign out") {
                    return (
                      <form action="/api/auth/logout" className="office-nav-logout-form" key={item.label} method="post">
                        <button className="office-nav-link office-nav-link-button" type="submit">
                          {item.label}
                        </button>
                      </form>
                    );
                  }

                  return (
                    <span className="office-nav-link office-nav-link-muted" key={item.label}>
                      {item.label}
                    </span>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <nav className="mobile-rail office-mobile-rail">
        <Link className={isMobileSectionActive("/office/dashboard") ? "is-active" : ""} href="/office/dashboard">
          Dash
        </Link>
        {canAccessOfficeTasks(currentAccess) ? (
          <Link className={isMobileSectionActive("/office/tasks") ? "is-active" : ""} href="/office/tasks">
            Tasks
          </Link>
        ) : null}
        {canViewOfficeTransactions(currentAccess) ? (
          <Link className={isMobileSectionActive("/office/transactions") ? "is-active" : ""} href="/office/transactions">
            Trans
          </Link>
        ) : null}
        {canViewOfficeAgents(currentAccess) ? (
          <Link className={isMobileSectionActive("/office/agents") ? "is-active" : ""} href="/office/agents">
            Agents
          </Link>
        ) : null}
        {canAccessAccountActivity(currentAccess) ? (
          <Link className={isMobileSectionActive("/office/activity") ? "is-active" : ""} href="/office/activity">
            Activity
          </Link>
        ) : null}
        {canViewOfficeLibrary(currentAccess) ? (
          <Link className={isMobileSectionActive("/office/library") ? "is-active" : ""} href="/office/library">
            Library
          </Link>
        ) : null}
        {canAccessOfficeAccounting(currentAccess) ? (
          <Link className={isMobileSectionActive("/office/accounting") ? "is-active" : ""} href="/office/accounting">
            Acct
          </Link>
        ) : null}
        {canAccessOfficeSettings(currentAccess) ? (
          <Link className={isMobileSectionActive("/office/settings") ? "is-active" : ""} href="/office/settings">
            Admin
          </Link>
        ) : null}
      </nav>
    </>
  );
}
