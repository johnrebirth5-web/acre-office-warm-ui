import { SummaryChip } from "@acre/ui";
import { getOfficeResourcesAdminSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import {
  OfficeListPageHeader,
  OfficeListPageShell,
} from "../_components/office-list-page-template";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeResourcesClient } from "./office-resources-client";

export default async function OfficeResourcesPage() {
  const context = await requireOfficeSession();

  if (context.currentMembership.role !== "office_admin") {
    redirect("/office/dashboard");
  }

  const snapshot = await getOfficeResourcesAdminSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        description="Manage the simple agent-facing directory: published resources, vendor records, and a small cleanup signal."
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Resources" value={snapshot.summary.resourceCount} />
            <SummaryChip
              label="Published"
              tone="accent"
              value={snapshot.summary.publishedResourceCount}
            />
            <SummaryChip label="Vendors" value={snapshot.summary.vendorCount} />
            <SummaryChip
              label="Stale"
              value={snapshot.summary.staleResourceCount}
            />
          </>
        }
        title="Resources"
      />

      <OfficeResourcesClient snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
