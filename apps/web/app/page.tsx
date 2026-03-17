import { redirect } from "next/navigation";
import { getDefaultAppPath } from "@acre/auth";
import { getCurrentSessionContext, mustChangePassword } from "../lib/auth-session";

export default async function HomePage() {
  const context = await getCurrentSessionContext({
    allowPasswordChangeRequired: true
  });

  redirect(context ? (mustChangePassword(context) ? "/change-password" : getDefaultAppPath(context.currentMembership)) : "/login");
}
