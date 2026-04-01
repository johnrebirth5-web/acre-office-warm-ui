"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import { SiteReleaseBadge } from "../site-release-badge";

type WorkspaceNavItem =
  | {
      label: string;
      href: string;
    }
  | {
      label: string;
      kind: "submit";
      formAction: string;
      formMethod?: "get" | "post";
    }
  | {
      label: string;
      kind: "muted";
    };

export type WorkspaceNavGroup = {
  title: string;
  icon: string;
  items: WorkspaceNavItem[];
};

type WorkspaceNavProps = {
  currentWorkspaceName: string;
  navigationLabel: string;
  switcherLabel: string;
  homeHref: string;
  navGroups: WorkspaceNavGroup[];
  sidebarClassName?: string;
  brandPanelClassName?: string;
  releaseBadgeClassName?: string;
  switcherClassName?: string;
};

type WorkspaceLocation = {
  path: string;
  hash: string;
};

type LinkNavItem = Extract<WorkspaceNavItem, { href: string }>;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeHref(href: string) {
  const [path, hashFragment] = href.split("#");
  return `${path}${hashFragment ? `#${hashFragment}` : ""}`;
}

function splitLocationKey(locationKey: string): WorkspaceLocation {
  const [path, hashFragment] = locationKey.split("#");

  return {
    path,
    hash: hashFragment ? `#${hashFragment}` : "",
  };
}

function isLinkItem(item: WorkspaceNavItem): item is LinkNavItem {
  return "href" in item;
}

export function WorkspaceNav({
  currentWorkspaceName,
  navigationLabel,
  switcherLabel,
  homeHref,
  navGroups,
  sidebarClassName,
  brandPanelClassName,
  releaseBadgeClassName,
  switcherClassName,
}: WorkspaceNavProps) {
  const pathname = usePathname();
  const [currentHash, setCurrentHash] = useState("");
  const [pendingLocationKey, setPendingLocationKey] = useState<string | null>(
    null,
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    return navGroups.some((group) =>
      group.items.some(
        (item) => isLinkItem(item) && item.href.startsWith(`${path}#`),
      ),
    );
  }

  function handleNavIntent(href: string) {
    setPendingLocationKey(normalizeHref(href));
  }

  function isSidebarItemActive(href: string) {
    const [path, hashFragment] = href.split("#");
    const targetHash = hashFragment ? `#${hashFragment}` : "";

    if (targetHash) {
      return (
        effectiveLocation.path === path && effectiveLocation.hash === targetHash
      );
    }

    if (hasHashVariant(path)) {
      return (
        effectiveLocation.path === path && effectiveLocation.hash.length === 0
      );
    }

    return effectiveLocation.path === path;
  }

  function isMobileSectionActive(href: string) {
    const path = href.split("#")[0];
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  function isMobileMenuItemActive(href: string) {
    return href.includes("#")
      ? isSidebarItemActive(href)
      : isMobileSectionActive(href);
  }

  const mobileActiveEntry =
    navGroups
      .flatMap((group) =>
        group.items.filter(isLinkItem).map((item) => ({
          group,
          item,
        })),
      )
      .find(({ item }) => isMobileMenuItemActive(item.href)) ?? null;
  const mobileCurrentLabel =
    mobileActiveEntry?.item.label ?? currentWorkspaceName;
  const mobileCurrentGroup =
    mobileActiveEntry?.group.title ?? currentWorkspaceName;
  const mobileMenuPanelId = `${navigationLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-panel`;

  return (
    <>
      <aside
        className={cx("sidebar", "office-dashboard-sidebar", sidebarClassName)}
      >
        <div className={cx("office-logo-panel", brandPanelClassName)}>
          <Image
            alt="Acre New York Realty logo"
            className="office-logo-image"
            height={1404}
            priority
            src="/acre-logo-nyr.png"
            width={1175}
          />
        </div>

        <SiteReleaseBadge
          className={cx("site-release-badge-office", releaseBadgeClassName)}
        />

        <div className={cx("office-company-switcher", switcherClassName)}>
          <strong>{switcherLabel}</strong>
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
                  if (isLinkItem(item)) {
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

                  if (item.kind === "submit") {
                    return (
                      <form
                        action={item.formAction}
                        className="office-nav-logout-form"
                        key={item.label}
                        method={item.formMethod ?? "post"}
                      >
                        <button
                          className="office-nav-link office-nav-link-button"
                          type="submit"
                        >
                          {item.label}
                        </button>
                      </form>
                    );
                  }

                  return (
                    <span
                      className="office-nav-link office-nav-link-muted"
                      key={item.label}
                    >
                      {item.label}
                    </span>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <nav
        className={`mobile-rail office-mobile-rail${isMobileMenuOpen ? " is-open" : ""}`}
        aria-label={navigationLabel}
      >
        <div className="office-mobile-rail-bar">
          <div className="office-mobile-rail-current">
            <span>{mobileCurrentGroup}</span>
            <strong>{mobileCurrentLabel}</strong>
          </div>

          <Link
            aria-label="Go to workspace home"
            className="office-mobile-rail-logo"
            href={homeHref}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Image
              alt="Acre New York Realty logo"
              className="office-mobile-rail-logo-image"
              height={1404}
              priority
              src="/acre-logo-nyr.png"
              width={1175}
            />
          </Link>

          <button
            aria-controls={mobileMenuPanelId}
            aria-expanded={isMobileMenuOpen}
            aria-label={
              isMobileMenuOpen
                ? "Close navigation menu"
                : "Open navigation menu"
            }
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
                      if (isLinkItem(item)) {
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

                      if (item.kind === "submit") {
                        return (
                          <form
                            action={item.formAction}
                            className="office-mobile-menu-form"
                            key={item.label}
                            method={item.formMethod ?? "post"}
                          >
                            <button
                              className="office-mobile-menu-link office-mobile-menu-link-button"
                              type="submit"
                            >
                              {item.label}
                            </button>
                          </form>
                        );
                      }

                      return (
                        <span
                          className="office-mobile-menu-link office-mobile-menu-link-muted"
                          key={item.label}
                        >
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
