import { SummaryChip } from "@acre/ui";
import { getOfficeResourcesAdminSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import {
  OfficeListPageHeader,
  OfficeListPageShell,
} from "../_components/office-list-page-template";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeResourcesClient } from "../resources/office-resources-client";

export default async function OfficeTrainingPage() {
  const context = await requireOfficeSession();

  if (context.currentMembership.role !== "office_admin") {
    redirect("/office/dashboard");
  }

  const snapshot = await getOfficeResourcesAdminSnapshot({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    timeZone: context.currentUser.timezone,
  });
  const trainingVideos = snapshot.resources.filter(
    (resource) => resource.type === "training_video",
  );
  const publishedTrainingVideos = trainingVideos.filter(
    (resource) => resource.isPublished,
  ).length;
  const staleTrainingVideos = snapshot.staleResources.filter(
    (resource) => resource.type === "training_video",
  ).length;

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        description="Manage YouTube-based training videos in their own module so they stay separate from the PDF and document directory."
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip
              label="Training videos"
              value={trainingVideos.length}
            />
            <SummaryChip
              label="Published"
              tone="accent"
              value={publishedTrainingVideos}
            />
            <SummaryChip
              label="Drafts"
              value={trainingVideos.length - publishedTrainingVideos}
            />
            <SummaryChip label="Stale" value={staleTrainingVideos} />
          </>
        }
        title="Training"
      />

      <OfficeResourcesClient resourceMode="training" snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
