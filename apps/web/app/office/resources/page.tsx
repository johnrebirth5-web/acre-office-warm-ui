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
  const resourceCount = snapshot.resources.filter(
    (resource) => resource.type !== "training_video",
  ).length;
  const publishedResourceCount = snapshot.resources.filter(
    (resource) => resource.type !== "training_video" && resource.isPublished,
  ).length;
  const staleResourceCount = snapshot.staleResources.filter(
    (resource) => resource.type !== "training_video",
  ).length;

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        description="Manage the agent-facing document directory: keep PDFs, templates, playbooks, and vendors cleanly separated from YouTube training."
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Resources" value={resourceCount} />
            <SummaryChip
              label="Published"
              tone="accent"
              value={publishedResourceCount}
            />
            <SummaryChip label="Vendors" value={snapshot.summary.vendorCount} />
            <SummaryChip label="Stale" value={staleResourceCount} />
          </>
        }
        title="Resources"
      />

      <OfficeResourcesClient resourceMode="resources" snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
