import { redirect } from "next/navigation";

export default function AgentTrainingRedirectPage() {
  redirect("/agent/resources?tab=training");
}
