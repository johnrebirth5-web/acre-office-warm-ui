import {
  can,
  canAccessListingStudio,
  hasAnyPermission,
  type PermissionSubject,
} from "@acre/auth";
import { QueueItem, SectionCard, StatusBadge } from "@acre/ui";
import Link from "next/link";
import { getServerI18n } from "../../../lib/i18n/server";
import { FrontOfficePageTemplate } from "./front-office-page-template";

type FrontOfficeFeatureKey =
  | "dashboard"
  | "clients"
  | "calendar"
  | "listings"
  | "studio"
  | "activity"
  | "resources";

type FrontOfficeAccessNoticeProps = {
  featureKey: FrontOfficeFeatureKey;
  currentMembership: PermissionSubject;
  userLocale?: string | null;
};

type FrontOfficeAlternativeEntry = {
  key: FrontOfficeFeatureKey;
  href: string;
  label: string;
  description: string;
};

function getFeatureLabel(
  featureKey: FrontOfficeFeatureKey,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  switch (featureKey) {
    case "dashboard":
      return t((messages) => messages.agentNav.items.dashboard);
    case "clients":
      return t((messages) => messages.agentNav.items.clients);
    case "calendar":
      return t((messages) => messages.agentNav.items.calendar);
    case "listings":
      return t((messages) => messages.agentNav.items.listings);
    case "studio":
      return t((messages) => messages.agentNav.items.studio);
    case "activity":
      return t((messages) => messages.agentNav.items.activity);
    case "resources":
      return t((messages) => messages.agentNav.items.resources);
  }
}

function buildAlternativeEntries(input: {
  currentMembership: PermissionSubject;
  isZh: boolean;
  t: Awaited<ReturnType<typeof getServerI18n>>["t"];
}) {
  const { currentMembership, isZh, t } = input;
  const entries: FrontOfficeAlternativeEntry[] = [];

  if (can(currentMembership, "dashboard:view")) {
    entries.push({
      key: "dashboard",
      href: "/agent/dashboard",
      label: t((messages) => messages.agentNav.items.dashboard),
      description: isZh
        ? "先回到 Front Office 主控台，继续今天的下一步动作。"
        : "Return to the Front Office launchpad and keep moving through today's next actions.",
    });
  }

  if (can(currentMembership, "clients:view")) {
    entries.push({
      key: "clients",
      href: "/agent/clients",
      label: t((messages) => messages.agentNav.items.clients),
      description: isZh
        ? "继续客户跟进、提醒和轻量备注，不会离开 Front Office。"
        : "Continue follow-up, reminders, and lightweight notes without leaving Front Office.",
    });
  }

  if (can(currentMembership, "dashboard:view")) {
    entries.push({
      key: "calendar",
      href: "/agent/calendar",
      label: t((messages) => messages.agentNav.items.calendar),
      description: isZh
        ? "继续查看预约、写回状态和下一次外部联系压力。"
        : "Keep working through appointments, writeback status, and the next external follow-up.",
    });
  }

  if (can(currentMembership, "listings:view")) {
    entries.push({
      key: "listings",
      href: "/agent/listings",
      label: t((messages) => messages.agentNav.items.listings),
      description: isZh
        ? "继续房源跟进、草稿辅助和已追踪发送。"
        : "Keep working through listing follow-up, draft assist, and tracked sends.",
    });
  }

  if (canAccessListingStudio(currentMembership)) {
    entries.push({
      key: "studio",
      href: "/listing-studio/listings",
      label: t((messages) => messages.agentNav.items.studio),
      description: isZh
        ? "继续打开 Studio 的房源包、海报和分享准备工作。"
        : "Open Studio to keep working on packets, posters, and share prep.",
    });
  }

  if (
    hasAnyPermission(currentMembership, [
      "notifications:view",
      "events:view",
      "clients:view",
      "dashboard:view",
    ])
  ) {
    entries.push({
      key: "activity",
      href: "/agent/notifications",
      label: t((messages) => messages.agentNav.items.activity),
      description: isZh
        ? "继续查看清理压力、提醒和动态，不会被带去 Back Office。"
        : "Review cleanup pressure, reminders, and activity without being bounced into Back Office.",
    });
  }

  if (can(currentMembership, "resources:view")) {
    entries.push({
      key: "resources",
      href: "/agent/resources",
      label: t((messages) => messages.agentNav.items.resources),
      description: isZh
        ? "继续打开资料、供应商联系人和培训内容。"
        : "Open resources, vendor contacts, and training materials from the same workspace.",
    });
  }

  return entries;
}

export async function FrontOfficeAccessNotice(
  props: FrontOfficeAccessNoticeProps,
) {
  const { t, locale } = await getServerI18n({
    userLocale: props.userLocale,
  });
  const isZh = locale === "zh-CN";
  const featureLabel = getFeatureLabel(props.featureKey, t);
  const alternativeEntries = buildAlternativeEntries({
    currentMembership: props.currentMembership,
    isZh,
    t,
  }).filter((entry) => entry.key !== props.featureKey);

  return (
    <FrontOfficePageTemplate
      description={t(
        (messages) => messages.workspaceNav.restrictedNavDescription,
        {
          feature: featureLabel,
        },
      )}
      eyebrow={t((messages) => messages.agentNav.workspaceName)}
      main={
        <SectionCard
          className="office-list-card"
          subtitle={
            isZh
              ? "Acre 会把你留在 Front Office 里，并直接说明这个模块当前没有开通。"
              : "Acre keeps you inside Front Office and explains that this module is not enabled for this account."
          }
          title={isZh ? "访问受限" : "Access restricted"}
        >
          <div className="office-queue-list">
            <QueueItem
              badge={
                <StatusBadge tone="warning">
                  {t((messages) => messages.workspaceNav.restrictedNavBadge)}
                </StatusBadge>
              }
              description={t(
                (messages) => messages.workspaceNav.restrictedNavDescription,
                {
                  feature: featureLabel,
                },
              )}
              meta={
                <span>
                  {isZh
                    ? "如果这个模块需要给当前账号开放，请联系管理员调整权限。"
                    : "If this module should be available for this account, ask an admin to adjust its permissions."}
                </span>
              }
              title={t((messages) => messages.workspaceNav.restrictedNavTitle, {
                feature: featureLabel,
              })}
            />
          </div>
        </SectionCard>
      }
      rail={
        alternativeEntries.length ? (
          <SectionCard
            className="office-list-card"
            subtitle={
              isZh
                ? "这些 Front Office 页面当前仍然可用，可以继续当前工作流。"
                : "These Front Office pages are still available, so you can keep the current workflow moving."
            }
            title={isZh ? "继续其他模块" : "Keep moving elsewhere"}
          >
            <div className="office-queue-list">
              {alternativeEntries.map((entry) => (
                <QueueItem
                  action={
                    <Link
                      className="office-inline-link front-office-inline-link"
                      href={entry.href}
                    >
                      {isZh ? `打开 ${entry.label}` : `Open ${entry.label}`}
                    </Link>
                  }
                  badge={
                    <StatusBadge tone="accent">
                      {isZh ? "可继续" : "Available"}
                    </StatusBadge>
                  }
                  description={entry.description}
                  key={entry.key}
                  title={entry.label}
                />
              ))}
            </div>
          </SectionCard>
        ) : null
      }
      title={t((messages) => messages.workspaceNav.restrictedNavTitle, {
        feature: featureLabel,
      })}
    />
  );
}
