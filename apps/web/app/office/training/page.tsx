import { redirect } from "next/navigation";

export default function OfficeTrainingRedirectPage() {
  redirect("/office/resources?tab=training");
}
