import { getOfficeContactFieldSchema, listContacts, officeContactsPageDefaults, officeContactsPageLimits } from "@acre/db";
import { requireOfficeSession } from "../../../lib/auth-session";
import { ContactsClient } from "./contacts-client";

type OfficeContactsPageProps = {
  searchParams?: Promise<{
    q?: string;
    stage?: string;
    page?: string;
    pageSize?: string;
  }>;
};

function parsePositiveInteger(value: string | undefined, fallback: number, max?: number) {
  const numeric = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }

  return max ? Math.min(numeric, max) : numeric;
}

export default async function OfficeContactsPage(props: OfficeContactsPageProps) {
  const context = await requireOfficeSession();
  const searchParams = (await props.searchParams) ?? {};
  const q = searchParams.q?.trim() ?? "";
  const stage = searchParams.stage?.trim() || "All";
  const page = parsePositiveInteger(searchParams.page, officeContactsPageDefaults.page);
  const pageSize = parsePositiveInteger(searchParams.pageSize, officeContactsPageDefaults.pageSize, officeContactsPageLimits.maxPageSize);
  const result = await listContacts({
    organizationId: context.currentOrganization.id,
    viewerMembershipId: context.currentMembership.id,
    officeId: context.currentOffice?.id ?? null,
    search: q,
    stage,
    page,
    pageSize
  });
  const schema = await getOfficeContactFieldSchema({
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null
  });

  return <ContactsClient contacts={result.contacts} filters={{ q, stage }} page={result.page} pageSize={result.pageSize} schema={schema} totalCount={result.totalCount} totalPages={result.totalPages} />;
}
