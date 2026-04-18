import { Button } from "@acre/ui";
import { getInvitationSnapshot } from "@acre/db";
import Link from "next/link";

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

export default async function InvitePage({ params, searchParams }: InvitePageProps) {
  const { token } = await params;
  const snapshot = await getInvitationSnapshot(token);
  const query = (await searchParams) ?? {};
  const errorMessage = getErrorMessage(query.error);
  const isReady = snapshot.status === "ready";
  const isInvite = snapshot.requiresActivation;

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

              {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

              <div className="auth-actions">
                <Button className="auth-submit" type="submit">
                  {isInvite ? "Accept invitation" : "Save password"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="auth-form">
              <p className="auth-error">
                {snapshot.status === "accepted"
                  ? "This invitation has already been used."
                  : snapshot.status === "revoked"
                    ? "This invitation has been revoked by an administrator."
                    : snapshot.status === "expired"
                      ? "This invitation has expired. Ask an administrator to issue a new link."
                      : "This invitation link is invalid."}
              </p>
              <div className="auth-actions">
                <Link className="office-button-secondary office-button-sm" href="/login">
                  Go to login
                </Link>
              </div>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
