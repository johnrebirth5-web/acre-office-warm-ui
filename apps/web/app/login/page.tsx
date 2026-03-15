import { getDefaultAppPath } from "@acre/auth";
import { getCurrentSessionContext } from "../../lib/auth-session";
import { Button } from "@acre/ui";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const context = await getCurrentSessionContext();

  if (context) {
    redirect(getDefaultAppPath(context.currentMembership.role));
  }

  const params = searchParams ? await searchParams : undefined;

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <section className="auth-card">
          <div className="auth-card-copy">
            <span className="auth-eyebrow">Local Access</span>
            <h2>Acre local login</h2>
            <p>Use an active office membership email to open the current Back Office workspace.</p>
          </div>

          <form action="/api/auth/login" className="auth-form" method="post">
            <label className="auth-field">
              <span>Email</span>
              <input autoComplete="email" defaultValue="simon@acre.com" name="email" placeholder="jane@acre.com" type="email" />
            </label>

            {params?.error ? <p className="auth-error">No active seeded user matched that email.</p> : null}

            <div className="auth-actions">
              <Button className="auth-submit" type="submit">
                Log in
              </Button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
