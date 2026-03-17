"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { OfficeUsersWorkspaceSnapshot, OfficeUsersWorkspaceView } from "@acre/db";
import { OfficeSettingsUsersClient } from "./users-client";
import { OfficeSettingsUsersOperationsView } from "./users-operations-view";

type OfficeSettingsUsersWorkspaceClientProps = {
  snapshot: OfficeUsersWorkspaceSnapshot;
  canManageUsers: boolean;
};

function buildViewHref(pathname: string, searchParams: URLSearchParams, nextView: OfficeUsersWorkspaceView) {
  const nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.set("view", nextView);

  if (nextView === "access") {
    nextSearchParams.delete("teamId");
    nextSearchParams.delete("onboardingStatus");
    nextSearchParams.delete("membershipStatus");
  } else {
    nextSearchParams.delete("status");
  }

  const query = nextSearchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function OfficeSettingsUsersWorkspaceClient({
  snapshot,
  canManageUsers
}: OfficeSettingsUsersWorkspaceClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearchParams = new URLSearchParams(searchParams.toString());

  return (
    <>
      {snapshot.availableViews.length > 1 ? (
        <section className="office-section-card">
          <div className="office-section-body">
            <div className="office-inline-form office-inline-form-compact">
              {snapshot.availableViews.map((view) => {
                const isActive = snapshot.activeView === view;
                const label = view === "access" ? "Access" : "Operations";
                return (
                  <Link
                    className={`office-button ${isActive ? "office-button-primary" : "office-button-secondary"}`}
                    href={buildViewHref(pathname, currentSearchParams, view)}
                    key={view}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {snapshot.activeView === "access" && snapshot.access ? (
        <OfficeSettingsUsersClient canManageUsers={canManageUsers} snapshot={snapshot.access} />
      ) : null}

      {snapshot.activeView === "operations" && snapshot.operations ? (
        <OfficeSettingsUsersOperationsView snapshot={snapshot.operations} />
      ) : null}
    </>
  );
}
