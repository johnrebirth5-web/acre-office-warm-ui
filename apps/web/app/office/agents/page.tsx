import { redirect } from "next/navigation";

type OfficeAgentsPageProps = {
  searchParams?: Promise<{
    officeId?: string;
    role?: string;
    teamId?: string;
    onboardingStatus?: string;
    membershipStatus?: string;
    q?: string;
  }>;
};

export default async function OfficeAgentsPage(props: OfficeAgentsPageProps) {
  const searchParams = (await props.searchParams) ?? {};
  const nextSearchParams = new URLSearchParams();
  nextSearchParams.set("view", "operations");

  if (searchParams.q) {
    nextSearchParams.set("q", searchParams.q);
  }

  if (searchParams.role) {
    nextSearchParams.set("role", searchParams.role);
  }

  if (searchParams.officeId) {
    nextSearchParams.set("officeId", searchParams.officeId);
  }

  if (searchParams.teamId) {
    nextSearchParams.set("teamId", searchParams.teamId);
  }

  if (searchParams.onboardingStatus) {
    nextSearchParams.set("onboardingStatus", searchParams.onboardingStatus);
  }

  if (searchParams.membershipStatus) {
    nextSearchParams.set("membershipStatus", searchParams.membershipStatus);
  }

  redirect(`/office/settings/users?${nextSearchParams.toString()}`);
}
