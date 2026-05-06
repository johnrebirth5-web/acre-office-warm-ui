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
      return "两次输入的密码不一致。";
    case "password_length":
      return "密码太短。";
    case "missing_password":
      return "请输入密码后继续。";
    case "rate_limited":
      return "邀请尝试次数过多，请稍后再试。";
    default:
      return error ? "暂时无法完成这个邀请。" : "";
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
      title: "这个邀请已被接受。",
      description: "请使用邮箱和密码登录后继续。",
      action: {
        label: "登录",
        href: "/login",
      },
    };
  }

  if (status === "expired") {
    return {
      tone: "warning",
      icon: "clock",
      title: "这个邀请已过期。",
      description: "请联系邀请人重新发送链接。",
      action: {
        label: "请求新链接",
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
          ? "这个邀请已被取消。"
          : "该组织目前无法继续接受这个邀请。",
      description:
        status === "revoked"
          ? "管理员已在接受前撤销这个邀请。"
          : "请联系发送人或管理员团队获取新的访问方式。",
    };
  }

  return {
    tone: "info",
    icon: "question",
    title: "这个邀请链接无效。",
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
      title: "邀请尝试次数过多，请稍后再试。",
    };
  }

  return {
    tone: "error",
    icon: "x",
    title: "暂时无法完成这个邀请。",
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
            <span className="auth-eyebrow">内部账户</span>
            <h2>{isInvite ? "接受邀请" : "设置密码"}</h2>
            <p>
              {isReady
                ? `完成 ${snapshot.email} 的账户设置，然后开始使用 Acre 内部工作区。`
                : "这个邀请链接当前已不可用。"}
            </p>
          </div>

          {isReady ? (
            <form action="/api/auth/invitations/accept" className="auth-form" method="post">
              <input name="token" type="hidden" value={token} />

              <label className="auth-field">
                <span>名</span>
                <input defaultValue={snapshot.firstName} name="firstName" type="text" />
              </label>

              <label className="auth-field">
                <span>姓</span>
                <input defaultValue={snapshot.lastName} name="lastName" type="text" />
              </label>

              <label className="auth-field">
                <span>邮箱</span>
                <input disabled value={snapshot.email} />
              </label>

              <label className="auth-field">
                <span>密码</span>
                <input autoComplete="new-password" name="password" type="password" />
              </label>

              <label className="auth-field">
                <span>确认密码</span>
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
                  {isInvite ? "接受邀请" : "保存密码"}
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
                    前往登录
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
