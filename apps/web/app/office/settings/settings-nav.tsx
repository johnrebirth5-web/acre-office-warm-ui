"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsLinks = [
  { href: "/office/settings", label: "Overview" },
  { href: "/office/settings/users", label: "Users" },
  { href: "/office/settings/teams", label: "Teams" },
  { href: "/office/settings/fields", label: "Fields" },
  { href: "/office/settings/checklists", label: "Checklists" }
];

export function OfficeSettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="office-settings-nav" aria-label="Office settings sections">
      {settingsLinks.map((link) => {
        const isActive = link.href === "/office/settings" ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link className={`office-settings-nav-link${isActive ? " is-active" : ""}`} href={link.href} key={link.href}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
