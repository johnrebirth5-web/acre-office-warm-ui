"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  canAccessAccountActivity,
  canAccessOfficeAdminAccountingWorkspace,
  canAccessOfficeCommissionWorkspace,
  canAccessOfficeDocumentApprovals,
  canAccessOffice1099Tracker,
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
        { label: "Performance", href: "/office/performance", isVisible: canViewOfficeReports },
        { label: "Activity", href: "/office/activity", isVisible: canAccessAccountActivity },
        { label: "Library", href: "/office/library", isVisible: canViewOfficeLibrary },
        { label: "Accounting", href: "/office/accounting", isVisible: canAccessOfficeAdminAccountingWorkspace },
        { label: "1099 Tracker", href: "/office/1099-tracker", isVisible: canAccessOffice1099Tracker }
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
        { label: "Commission plans", href: "/office/settings/commission-plans", isVisible: canAccessOfficeCommissionWorkspace }
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [actualLocationKey]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

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

  function isMobileMenuItemActive(href: string) {
    return href.includes("#") ? isSidebarItemActive(href) : isMobileSectionActive(href);
  }

  const mobileActiveEntry =
    navGroups
      .flatMap((group) => group.items.map((item) => ({ group, item })))
      .find(({ item }) => item.href && isMobileMenuItemActive(item.href)) ?? null;
  const mobileCurrentLabel = mobileActiveEntry?.item.label ?? "Navigation";
  const mobileCurrentGroup = mobileActiveEntry?.group.title ?? currentOfficeName;
  const mobileMenuPanelId = "office-mobile-menu-panel";

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

      <nav className={`mobile-rail office-mobile-rail${isMobileMenuOpen ? " is-open" : ""}`} aria-label="Office navigation">
        <div className="office-mobile-rail-bar">
          <div className="office-mobile-rail-current">
            <span>{mobileCurrentGroup}</span>
            <strong>{mobileCurrentLabel}</strong>
          </div>

          <button
            aria-controls={mobileMenuPanelId}
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            className={`office-mobile-menu-button${isMobileMenuOpen ? " is-open" : ""}`}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {isMobileMenuOpen ? (
          <>
            <button
              aria-label="Close navigation menu"
              className="office-mobile-menu-backdrop"
              onClick={() => setIsMobileMenuOpen(false)}
              type="button"
            />

            <div className="office-mobile-menu-panel" id={mobileMenuPanelId}>
              {navGroups.map((group) => (
                <section className="office-mobile-menu-group" key={group.title}>
                  <header className="office-mobile-menu-header">
                    <span>{group.icon}</span>
                    <strong>{group.title}</strong>
                  </header>

                  <div className="office-mobile-menu-items">
                    {group.items.map((item) => {
                      if (item.href) {
                        const href = item.href;

                        return (
                          <Link
                            key={item.label}
                            className={`office-mobile-menu-link${isMobileMenuItemActive(href) ? " is-active" : ""}`}
                            href={href}
                            onClick={() => {
                              handleNavIntent(href);
                              setIsMobileMenuOpen(false);
                            }}
                          >
                            {item.label}
                          </Link>
                        );
                      }

                      if (item.label === "Sign out") {
                        return (
                          <form action="/api/auth/logout" className="office-mobile-menu-form" key={item.label} method="post">
                            <button className="office-mobile-menu-link office-mobile-menu-link-button" type="submit">
                              {item.label}
                            </button>
                          </form>
                        );
                      }

                      return (
                        <span className="office-mobile-menu-link office-mobile-menu-link-muted" key={item.label}>
                          {item.label}
                        </span>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : null}
      </nav>
    </>
  );
}
