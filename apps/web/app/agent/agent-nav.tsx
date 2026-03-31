"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { agentSections } from "@acre/backoffice";
import { SiteReleaseBadge } from "../site-release-badge";

export function AgentNav() {
  const pathname = usePathname();
  const items = agentSections[0].items;

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
