import Link from "next/link";
import { getContactById, getOfficeContactFieldSchema } from "@acre/db";
import { SummaryChip } from "@acre/ui";
import { notFound } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import {
  OfficeDetailPageHeader,
  OfficeDetailPageShell,
} from "../../_components/office-detail-page-template";
import { ContactDetailClient } from "./contact-detail-client";

type ContactDetailPageProps = {
  params: Promise<{
    contactId: string;
  }>;
};

export default async function OfficeContactDetailPage({
  params,
}: ContactDetailPageProps) {
  const context = await requireOfficeSession();
  const { contactId } = await params;
  const [contact, schema] = await Promise.all([
    getContactById({
      organizationId: context.currentOrganization.id,
      viewerMembershipId: context.currentMembership.id,
      contactId,
      officeId: context.currentOffice?.id ?? null,
    }),
    getOfficeContactFieldSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
    }),
  ]);

  if (!contact) {
    notFound();
  }

  return (
    <OfficeDetailPageShell className="office-contact-detail-page">
      <OfficeDetailPageHeader
        description={contact.email || contact.phone || contact.source}
        eyebrow="Contact detail"
        summary={
          <>
            <Link
              className="office-button-secondary office-button-sm"
              href="/office/contacts"
            >
              Back to contacts
            </Link>
            <SummaryChip label="Type" value={contact.contactType || "—"} />
            <SummaryChip
              label="Stage"
              tone="accent"
              value={contact.stage || "—"}
            />
            <SummaryChip label="Intent" value={contact.intent || "—"} />
          </>
        }
        title={contact.fullName}
      />

      <ContactDetailClient contact={contact} schema={schema} />
    </OfficeDetailPageShell>
  );
}
