"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { agentSections } from "@acre/backoffice";
import { Badge } from "@acre/ui";
import { SiteReleaseBadge } from "../site-release-badge";

export function AgentNav() {
  const pathname = usePathname();
  const items = agentSections[0].items;

  return (
    <>
      <aside className="sidebar office-dashboard-sidebar agent-sidebar">
        <div className="office-logo-panel agent-brand-panel">
          <div className="brand-mark agent-brand-mark">
            <span>Acre</span>
            <strong>Front Office</strong>
            <p>Daily client execution, listing outreach, and the next clear handoff into formal Back Office workflow.</p>
          </div>
        </div>

        <SiteReleaseBadge className="site-release-badge-office site-release-badge-agent-panel" />

        <section className="nav-group agent-nav-group">
          <header className="office-nav-header agent-nav-header">
            <span>FO</span>
            <strong>{agentSections[0].title}</strong>
          </header>
          <p>{agentSections[0].summary}</p>
          <div className="nav-items agent-nav-links">
            {items.map((item) => (
              <Link
                key={item.href}
                className={`office-nav-card agent-nav-card${pathname === item.href ? " is-active" : ""}`}
                href={item.href}
              >
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="sidebar-note office-sidebar-note agent-sidebar-note">
          <Badge tone="accent">Shared system</Badge>
          <strong>Front Office moves fast. Back Office stays formal.</strong>
          <p>Use this shell for action queues, outreach, and reminders. Open Back Office when a record needs transactions, signatures, or audit-safe follow-through.</p>
        </div>
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
