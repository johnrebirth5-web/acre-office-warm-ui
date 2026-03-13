import { getDefaultAppPath } from "@acre/auth";
import { getSeededWorkspaceSnapshot } from "@acre/db";
import { getCurrentSessionContext, shouldShowSeededUsers } from "../../lib/auth-session";
import { Button, StatusBadge } from "@acre/ui";
import { redirect } from "next/navigation";
import { SiteReleaseBadge } from "../site-release-badge";

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
  const seededWorkspace = shouldShowSeededUsers() ? await getSeededWorkspaceSnapshot().catch(() => null) : null;

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <aside className="auth-hero">
          <div className="auth-hero-copy">
            <span className="auth-eyebrow">Acre Agent OS</span>
            <h1>Modern brokerage operations in one calm, unified workspace.</h1>
            <p>
              This local access screen opens the same Back Office system used for transactions, accounting, documents,
              approvals, and agent operations.
            </p>
          </div>

          <div className="auth-hero-grid">
            <article className="auth-hero-panel">
              <strong>Unified operations</strong>
              <p>Transactions, approvals, billing, activity, and internal admin now share one visual system.</p>
            </article>
            <article className="auth-hero-panel">
              <strong>Apple-inspired clarity</strong>
              <p>Higher polish, cleaner hierarchy, and quieter chrome without sacrificing back-office density.</p>
            </article>
          </div>

          <SiteReleaseBadge className="site-release-badge-auth" />
        </aside>

        <section className="auth-card">
          <div className="auth-card-copy">
            <span className="auth-eyebrow">Local Access</span>
            <h2>Acre local login</h2>
            <p>Use an active office membership email to create a local Acre session for the current Back Office workspace.</p>
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

          {seededWorkspace ? (
            <section className="auth-demo-card">
              <div className="auth-demo-card-head">
                <strong>Available local users</strong>
                <StatusBadge tone="accent">{seededWorkspace.memberships.length} profiles</StatusBadge>
              </div>
              <ul>
                {seededWorkspace.memberships.map((membership) => (
                  <li key={membership.membershipId}>
                    <span>
                      {membership.fullName} · {membership.role}
                    </span>
                    <code>{membership.email}</code>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
