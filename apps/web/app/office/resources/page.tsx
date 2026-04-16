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
  if (value === "vendors") {
    return "vendors";
  }

  if (value === "training") {
    return "training";
  }

  return "documents";
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
  const documentCount = snapshot.resources.filter(
    (resource) => resource.type === "document",
  ).length;
  const trainingVideoCount = snapshot.resources.filter(
    (resource) => resource.type === "training_video",
  ).length;

  return (
    <OfficeListPageShell>
      <OfficeListPageHeader
        description="Publish exactly the three Front Office resources tabs from one admin workspace: Documents, Vendors, and Training."
        eyebrow="Office admin"
        summary={
          <>
            <SummaryChip label="Documents" value={documentCount} />
            <SummaryChip label="Vendors" value={snapshot.summary.vendorCount} />
            <SummaryChip label="Training" value={trainingVideoCount} />
          </>
        }
        title="Front Office Resources Publisher"
      />

      <OfficeResourcesClient activeTab={activeTab} snapshot={snapshot} />
    </OfficeListPageShell>
  );
}
