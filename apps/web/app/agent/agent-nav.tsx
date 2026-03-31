"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteReleaseBadge } from "../site-release-badge";

const frontOfficeNavItems = [
  { href: "/agent/dashboard", label: "Dashboard", shortLabel: "Home" },
  { href: "/agent/clients", label: "Clients", shortLabel: "Clients" },
  { href: "/agent/listings", label: "Listings", shortLabel: "Listings" },
  { href: "/agent/notifications", label: "Activity", shortLabel: "Alerts" },
  { href: "/agent/resources", label: "Resources", shortLabel: "Resources" }
] as const;

export function AgentNav() {
  const pathname = usePathname();
  const items = frontOfficeNavItems;

  return (
    <>
      <aside className="sidebar office-dashboard-sidebar agent-sidebar">
        <div className="office-logo-panel agent-brand-panel">
          <Image
            alt="Acre New York Realty logo"
            className="office-logo-image"
            height={1404}
            priority
            src="/acre-logo-nyr.png"
            width={1175}
          />
        </div>

        <SiteReleaseBadge className="site-release-badge-office site-release-badge-agent-panel" />

        <div className="office-company-switcher agent-company-switcher">
          <strong>FRONT OFFICE</strong>
          <span>▾</span>
        </div>

        <section className="nav-group agent-nav-group">
          <header className="office-nav-header agent-nav-header">
            <span>◫</span>
            <strong>Overview</strong>
          </header>
          <div className="nav-items agent-nav-links">
            {items.map((item) => (
              <Link
                key={item.href}
                className={`office-nav-link agent-nav-link${pathname === item.href ? " is-active" : ""}`}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </section>
      </aside>

      <nav className="mobile-rail office-mobile-rail">
        {items.map((item) => (
          <Link key={item.href} className={pathname === item.href ? "is-active" : ""} href={item.href}>
            {item.shortLabel}
          </Link>
        ))}
      </nav>
    </>
  );
}
