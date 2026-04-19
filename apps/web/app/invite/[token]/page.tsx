import { Button } from "@acre/ui";
import { getInvitationSnapshot } from "@acre/db";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  consumePublicTokenRateLimit,
  PUBLIC_INVITATION_READ_RATE_LIMIT_OPTIONS,
} from "../../../lib/public-token-rate-limit";
import { SignatureStatusCallout } from "../../sign/[token]/signature-status-callout";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "mismatch":
      return "Password confirmation does not match.";
    case "password_length":
      return "Password is too short.";
    case "missing_password":
      return "Enter a password to continue.";
    case "rate_limited":
      return "Too many invitation attempts. Please wait a moment and try again.";
    default:
      return error ? "Unable to complete this invitation." : "";
  }
}

type InviteCalloutState = {
  tone: "info" | "success" | "warning" | "error";
  icon: "clock" | "check" | "x" | "question" | "timer";
  title: string;
  description?: string;
  action?: {
    label: string;
    href: string;
  };
};

function buildMailtoHref(subject: string, body: string) {
  const params = new URLSearchParams({
    subject,
    body,
  });

  return `mailto:?${params.toString()}`;
}

function getInviteUnavailableCallout(
  status: string,
  email: string,
): InviteCalloutState {
  if (status === "accepted") {
    return {
      tone: "success",
      icon: "check",
      title: "This invitation was already accepted.",
      description: "Sign in with your email and password to continue.",
      action: {
        label: "Sign in",
        href: "/login",
      },
    };
  }

  if (status === "expired") {
    return {
      tone: "warning",
      icon: "clock",
      title: "This invitation has expired.",
      description: "Ask your inviter to send a fresh link.",
      action: {
        label: "Request a fresh link",
        href: buildMailtoHref(
          "Request a new Acre invitation link",
          `Hi,\n\nPlease send me a fresh Acre invitation link for ${email || "my account"}.\n\nThank you.`,
        ),
      },
    };
  }

  if (status === "revoked" || status === "org_disabled" || status === "org-disabled") {
    return {
      tone: "error",
      icon: "x",
      title:
        status === "revoked"
          ? "This invitation has been cancelled."
          : "This organization can no longer accept this invite.",
      description:
        status === "revoked"
          ? "An administrator revoked this invitation before it was accepted."
          : "Contact the sender or your admin team for a new access path.",
    };
  }

  return {
    tone: "info",
    icon: "question",
    title: "This invitation link isn't valid.",
  };
}

function getInviteFormErrorCallout(error?: string): InviteCalloutState | null {
  const errorMessage = getErrorMessage(error);

  if (!errorMessage) {
    return null;
  }

  if (error === "rate_limited") {
    return {
      tone: "warning",
      icon: "timer",
      title: "Too many invitation attempts. Try again in a moment.",
    };
  }

  return {
    tone: "error",
    icon: "x",
    title: "We couldn't complete this invitation yet.",
    description: errorMessage,
  };
}

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const headerStore = await headers();
  const rateLimitDecision = await consumePublicTokenRateLimit({
    scope: "public/invitations/read",
    request: headerStore,
    token,
    options: PUBLIC_INVITATION_READ_RATE_LIMIT_OPTIONS,
  });

  if (!rateLimitDecision.allowed) {
    notFound();
  }

  const snapshot = await getInvitationSnapshot(token);
  const query = (await searchParams) ?? {};
  const isReady = snapshot.status === "ready";
  const isInvite = snapshot.requiresActivation;
  const unavailableCallout = getInviteUnavailableCallout(query.error || snapshot.status, snapshot.email);
  const formErrorCallout = getInviteFormErrorCallout(query.error);

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <section className="auth-card">
          <div className="auth-card-copy">
            <span className="auth-eyebrow">Internal Account</span>
            <h2>{isInvite ? "Accept your invitation" : "Set your password"}</h2>
            <p>
              {isReady
                ? `Finish setup for ${snapshot.email} and start using the internal Acre workspace.`
                : "This invitation link is no longer available in its current state."}
            </p>
          </div>

          {isReady ? (
            <form action="/api/auth/invitations/accept" className="auth-form" method="post">
              <input name="token" type="hidden" value={token} />

              <label className="auth-field">
                <span>First name</span>
                <input defaultValue={snapshot.firstName} name="firstName" type="text" />
              </label>

              <label className="auth-field">
                <span>Last name</span>
                <input defaultValue={snapshot.lastName} name="lastName" type="text" />
              </label>

              <label className="auth-field">
                <span>Email</span>
                <input disabled value={snapshot.email} />
              </label>

              <label className="auth-field">
                <span>Password</span>
                <input autoComplete="new-password" name="password" type="password" />
              </label>

              <label className="auth-field">
                <span>Confirm password</span>
                <input autoComplete="new-password" name="confirmPassword" type="password" />
              </label>

              {formErrorCallout ? (
                <SignatureStatusCallout
                  action={formErrorCallout.action}
                  description={formErrorCallout.description}
                  icon={formErrorCallout.icon}
                  title={formErrorCallout.title}
                  tone={formErrorCallout.tone}
                />
              ) : null}

              <div className="auth-actions">
                <Button className="auth-submit" type="submit">
                  {isInvite ? "Accept invitation" : "Save password"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="auth-status-area">
              <SignatureStatusCallout
                action={unavailableCallout.action}
                description={unavailableCallout.description}
                icon={unavailableCallout.icon}
                title={unavailableCallout.title}
                tone={unavailableCallout.tone}
              />
              {snapshot.status !== "accepted" ? (
                <div className="auth-actions">
                  <Link className="office-button-secondary office-button-sm" href="/login">
                    Go to login
                  </Link>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
