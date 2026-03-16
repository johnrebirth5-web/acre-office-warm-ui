import { getDefaultAppPath } from "@acre/auth";
import { changeInternalPassword } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext, mustChangePassword } from "../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../lib/request-origin";

function buildErrorRedirect(requestOrigin: string, error: string) {
  return NextResponse.redirect(new URL(`/change-password?error=${error}`, requestOrigin), 303);
}

export async function POST(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const context = await getRequestSessionContext(request, {
    allowPasswordChangeRequired: true
  });

  if (!context) {
    return NextResponse.redirect(new URL("/login", requestOrigin), 303);
  }

  const formData = await request.formData();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const forced = mustChangePassword(context);

  if (!newPassword) {
    return buildErrorRedirect(requestOrigin, "missing_password");
  }

  if (newPassword !== confirmPassword) {
    return buildErrorRedirect(requestOrigin, "mismatch");
  }

  try {
    await changeInternalPassword({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      currentPassword: forced ? undefined : currentPassword,
      newPassword
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to change password.";

    if (message.includes("Current password is incorrect")) {
      return buildErrorRedirect(requestOrigin, "current_password");
    }

    if (message.includes("at least")) {
      return buildErrorRedirect(requestOrigin, "password_length");
    }

    return buildErrorRedirect(requestOrigin, "unknown");
  }

  const destination = forced ? getDefaultAppPath(context.currentMembership.role) : "/office/account";
  return NextResponse.redirect(new URL(destination, requestOrigin), 303);
}
