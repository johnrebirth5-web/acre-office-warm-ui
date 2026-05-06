import { Button } from "@acre/ui";
import { getInvitationSnapshot } from "@acre/db";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  consumePublicTokenRateLimit,
  PUBLIC_INVITATION_READ_RATE_LIMIT_OPTIONS,
} from "../../../lib/public-token-rate-limit";
import { getServerI18n } from "../../../lib/i18n/server";
import { SignatureStatusCallout } from "../../sign/[token]/signature-status-callout";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(error: string | undefined, isZh: boolean) {
  switch (error) {
    case "mismatch":
      return isZh ? "两次输入的密码不一致。" : "The passwords do not match.";
    case "password_length":
      return isZh ? "密码太短。" : "The password is too short.";
    case "missing_password":
      return isZh ? "请输入密码后继续。" : "Enter a password to continue.";
    case "rate_limited":
      return isZh ? "邀请尝试次数过多，请稍后再试。" : "Too many invitation attempts. Please try again later.";
    default:
      return error ? (isZh ? "暂时无法完成这个邀请。" : "This invitation cannot be completed right now.") : "";
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
  isZh: boolean,
): InviteCalloutState {
  if (status === "accepted") {
    return {
      tone: "success",
      icon: "check",
      title: isZh ? "这个邀请已被接受。" : "This invitation has already been accepted.",
      description: isZh ? "请使用邮箱和密码登录后继续。" : "Sign in with your email and password to continue.",
      action: {
        label: isZh ? "登录" : "Sign in",
        href: "/login",
      },
    };
  }

  if (status === "expired") {
    return {
      tone: "warning",
      icon: "clock",
      title: isZh ? "这个邀请已过期。" : "This invitation has expired.",
      description: isZh ? "请联系邀请人重新发送链接。" : "Contact the sender and ask them to send a new link.",
      action: {
        label: isZh ? "请求新链接" : "Request new link",
        href: buildMailtoHref(
          isZh ? "请求新的 Acre 邀请链接" : "Request a new Acre invitation link",
          isZh
            ? `你好，\n\n请为 ${email || "我的账户"} 重新发送一个 Acre 邀请链接。\n\n谢谢。`
            : `Hi,\n\nPlease send me a fresh Acre invitation link for ${email || "my account"}.\n\nThank you.`,
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
          ? isZh
            ? "这个邀请已被取消。"
            : "This invitation has been canceled."
          : isZh
            ? "该组织目前无法继续接受这个邀请。"
            : "This organization cannot accept the invitation right now.",
      description:
        status === "revoked"
          ? isZh
            ? "管理员已在接受前撤销这个邀请。"
            : "An admin revoked this invitation before it was accepted."
          : isZh
            ? "请联系发送人或管理员团队获取新的访问方式。"
            : "Contact the sender or admin team for a new access path.",
    };
  }

  return {
    tone: "info",
    icon: "question",
    title: isZh ? "这个邀请链接无效。" : "This invitation link is invalid.",
  };
}

function getInviteFormErrorCallout(error: string | undefined, isZh: boolean): InviteCalloutState | null {
  const errorMessage = getErrorMessage(error, isZh);

  if (!errorMessage) {
    return null;
  }

  if (error === "rate_limited") {
    return {
      tone: "warning",
      icon: "timer",
      title: isZh ? "邀请尝试次数过多，请稍后再试。" : "Too many invitation attempts. Please try again later.",
    };
  }

  return {
    tone: "error",
    icon: "x",
    title: isZh ? "暂时无法完成这个邀请。" : "This invitation cannot be completed right now.",
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
  const { locale } = await getServerI18n();
  const isZh = locale === "zh-CN";
  const isReady = snapshot.status === "ready";
  const isInvite = snapshot.requiresActivation;
  const unavailableCallout = getInviteUnavailableCallout(query.error || snapshot.status, snapshot.email, isZh);
  const formErrorCallout = getInviteFormErrorCallout(query.error, isZh);

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <section className="auth-card">
          <div className="auth-card-copy">
            <span className="auth-eyebrow">{isZh ? "内部账户" : "Internal account"}</span>
            <h2>{isInvite ? (isZh ? "接受邀请" : "Accept invitation") : isZh ? "设置密码" : "Set password"}</h2>
            <p>
              {isReady
                ? isZh
                  ? `完成 ${snapshot.email} 的账户设置，然后开始使用 Acre 内部工作区。`
                  : `Finish account setup for ${snapshot.email}, then start using the Acre internal workspace.`
                : isZh
                  ? "这个邀请链接当前已不可用。"
                  : "This invitation link is not available right now."}
            </p>
          </div>

          {isReady ? (
            <form action="/api/auth/invitations/accept" className="auth-form" method="post">
              <input name="token" type="hidden" value={token} />

              <label className="auth-field">
                <span>{isZh ? "名" : "First name"}</span>
                <input defaultValue={snapshot.firstName} name="firstName" type="text" />
              </label>

              <label className="auth-field">
                <span>{isZh ? "姓" : "Last name"}</span>
                <input defaultValue={snapshot.lastName} name="lastName" type="text" />
              </label>

              <label className="auth-field">
                <span>{isZh ? "邮箱" : "Email"}</span>
                <input disabled value={snapshot.email} />
              </label>

              <label className="auth-field">
                <span>{isZh ? "密码" : "Password"}</span>
                <input autoComplete="new-password" name="password" type="password" />
              </label>

              <label className="auth-field">
                <span>{isZh ? "确认密码" : "Confirm password"}</span>
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
                  {isInvite ? (isZh ? "接受邀请" : "Accept invitation") : isZh ? "保存密码" : "Save password"}
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
                    {isZh ? "前往登录" : "Go to sign in"}
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
