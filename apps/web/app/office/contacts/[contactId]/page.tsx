import { getContactById, getOfficeContactFieldSchema } from "@acre/db";
import { notFound } from "next/navigation";
import { requireOfficeSession } from "../../../../lib/auth-session";
import { ContactDetailClient } from "./contact-detail-client";

type ContactDetailPageProps = {
  params: Promise<{
    contactId: string;
  }>;
};

export default async function OfficeContactDetailPage({ params }: ContactDetailPageProps) {
  const context = await requireOfficeSession();
  const { contactId } = await params;
  const [contact, schema] = await Promise.all([
    getContactById(context.currentOrganization.id, contactId),
    getOfficeContactFieldSchema({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null
    })
  ]);

  if (!contact) {
    notFound();
  }

  return <ContactDetailClient contact={contact} schema={schema} />;
}
