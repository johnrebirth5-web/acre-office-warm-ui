import { redirect } from "next/navigation";

type OfficeAgentProfilePageProps = {
  params: Promise<{
    membershipId: string;
  }>;
};

export default async function OfficeAgentProfilePage({ params }: OfficeAgentProfilePageProps) {
  const { membershipId } = await params;
  redirect(`/office/settings/users/${membershipId}`);
}
