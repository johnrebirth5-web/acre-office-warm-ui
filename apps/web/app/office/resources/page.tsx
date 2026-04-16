import { SummaryChip } from "@acre/ui";
import { getOfficeResourcesAdminSnapshot } from "@acre/db";
import { redirect } from "next/navigation";
import {
  OfficeListPageHeader,
  OfficeListPageShell,
} from "../_components/office-list-page-template";
import { requireOfficeSession } from "../../../lib/auth-session";
import { OfficeResourcesClient } from "./office-resources-client";

function getSearchParamValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() || "";
  }

  return value?.trim() || "";
}

function getActiveTab(value: string) {
  return value === "training" ? "training" : "resources";
}

export default async function OfficeResourcesPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireOfficeSession();

  if (context.currentMembership.role !== "office_admin") {
    redirect("/office/dashboard");
  }

  const resolvedSearchParams = props.searchParams
    ? await props.searchParams
    : {};
  const activeTab = getActiveTab(getSearchParamValue(resolvedSearchParams.tab));

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
  const trainingVideoCount = snapshot.resources.filter(
    (resource) => resource.type === "training_video",
  ).length;
  const staleResourceCount = snapshot.staleResources.filter((resource) =>
    activeTab === "training"
      ? resource.type === "training_video"
      : resource.type !== "training_video",
  ).length;

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        description="Manage the agent-facing directory from one workspace. Documents and vendors live in the Resources tab, while YouTube videos stay in the Training tab."
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Resources" value={resourceCount} />
            <SummaryChip label="Training" value={trainingVideoCount} />
            <SummaryChip label="Vendors" value={snapshot.summary.vendorCount} />
            <SummaryChip
              label="Published"
              tone="accent"
              value={publishedResourceCount}
            />
            <SummaryChip label="Stale" value={staleResourceCount} />
          </>
        }
        title="Resources & Training"
      />

      <OfficeResourcesClient resourceMode={activeTab} snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
