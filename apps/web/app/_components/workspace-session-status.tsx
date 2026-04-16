import { getRoleSummary } from "@acre/auth";
import type { SessionMembershipContext } from "@acre/db";
import { getServerI18n } from "../../lib/i18n/server";

type WorkspaceSessionStatusProps = {
  context: SessionMembershipContext;
};

export async function WorkspaceSessionStatus({
  context,
}: WorkspaceSessionStatusProps) {
  const { t } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const roleLabel = getRoleSummary(context.currentMembership).label;

  return (
    <div className="workspace-session-shell">
      <section aria-label="Current signed-in session" className="workspace-session-inline">
        <span
          className="workspace-session-email"
          title={context.currentUser.email}
        >
          {context.currentUser.email}
        </span>
        <span aria-hidden="true" className="workspace-session-separator">
          ·
        </span>
        <span className="workspace-session-role">{roleLabel}</span>
        <form
          action="/api/auth/logout"
          className="workspace-session-action"
          method="post"
        >
          <button
            className="workspace-session-signout"
            type="submit"
          >
            {t((messages) => messages.auth.signOut)}
          </button>
        </form>
      </section>
    </div>
  );
}
