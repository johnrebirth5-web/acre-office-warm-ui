"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import {
  Badge,
  Button,
  FormField,
  SectionCard,
  SecondaryMetaList,
  SelectInput,
  StatCard,
  StatusBadge,
  TextInput,
  TextareaInput,
} from "@acre/ui";
import type {
  OfficeAccountNotificationPreferenceState,
  OfficeAccountSnapshot,
} from "@acre/db";
import { useI18n } from "../../../lib/i18n/client";

type OfficeAccountClientProps = {
  snapshot: OfficeAccountSnapshot;
  currentMembershipId: string;
};

type ProfileState = {
  firstName: string;
  lastName: string;
  displayName: string;
  phone: string;
  internalExtension: string;
  avatarUrl: string;
  bio: string;
  licenseNumber: string;
  licenseState: string;
  timezone: string;
  locale: string;
};

const commonTimezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Pacific/Honolulu",
];

const commonLocales = ["en-US", "zh-CN"];
const accountRowActionStackStyle = {
  display: "grid",
  gap: "8px",
  justifyItems: "end",
  flexShrink: 0,
} satisfies CSSProperties;
const accountRowActionListStyle = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
} satisfies CSSProperties;

function buildProfileState(snapshot: OfficeAccountSnapshot): ProfileState {
  return {
    firstName: snapshot.profile.firstName,
    lastName: snapshot.profile.lastName,
    displayName: snapshot.profile.displayName,
    phone: snapshot.profile.phone,
    internalExtension: snapshot.profile.internalExtension,
    avatarUrl: snapshot.profile.avatarUrl,
    bio: snapshot.profile.bio,
    licenseNumber: snapshot.profile.licenseNumber,
    licenseState: snapshot.profile.licenseState,
    timezone: snapshot.profile.timezone,
    locale: snapshot.profile.locale,
  };
}

function buildInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "AC"
  );
}

function buildUniqueOptions(currentValue: string, values: string[]) {
  return Array.from(
    new Set(
      [currentValue, ...values].filter((value) => value.trim().length > 0),
    ),
  );
}

function getTeamTone(isActive: boolean) {
  return isActive ? ("success" as const) : ("neutral" as const);
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getPasswordStatusTone(security: OfficeAccountSnapshot["security"]) {
  if (security.isLocked) {
    return "danger" as const;
  }

  if (!security.hasCredential || security.mustChangePassword) {
    return "accent" as const;
  }

  return "success" as const;
}

function getLockStatusTone(security: OfficeAccountSnapshot["security"]) {
  if (security.isLocked) {
    return "danger" as const;
  }

  if (!security.hasCredential || security.failedLoginCount > 0) {
    return "warning" as const;
  }

  return "success" as const;
}

function getActionClassName(variant: "primary" | "secondary" = "secondary") {
  return variant === "primary"
    ? "office-button office-button-sm"
    : "office-button-secondary office-button-sm";
}

function buildSummaryDrilldowns(
  summary: OfficeAccountSnapshot["summary"],
  currentMembershipId: string,
) {
  const openTaskParts = [
    summary.openTransactionTaskCount > 0
      ? `${formatCountLabel(summary.openTransactionTaskCount, "transaction task", "transaction tasks")} live on the Office task list`
      : "",
    summary.openFollowUpTaskCount > 0
      ? `${formatCountLabel(summary.openFollowUpTaskCount, "follow-up task", "follow-up tasks")} live on contact records`
      : "",
  ].filter(Boolean);
  const openTransactionParts = [
    summary.openTransactionOpportunityCount > 0
      ? formatCountLabel(
          summary.openTransactionOpportunityCount,
          "opportunity",
          "opportunities",
        )
      : "",
    summary.openTransactionActiveCount > 0
      ? formatCountLabel(
          summary.openTransactionActiveCount,
          "active deal",
          "active deals",
        )
      : "",
    summary.openTransactionPendingCount > 0
      ? formatCountLabel(
          summary.openTransactionPendingCount,
          "pending deal",
          "pending deals",
        )
      : "",
  ].filter(Boolean);

  return [
    {
      key: "open_tasks",
      label: "Open tasks",
      badgeLabel: `${summary.openTaskCount} open`,
      badgeTone:
        summary.openTaskCount > 0 ? ("accent" as const) : ("neutral" as const),
      description: summary.openTaskCount
        ? `${openTaskParts.join(" and ")}. Tasks are still split across the pages below, so use the matching link to continue.`
        : "No open transaction or follow-up work is currently assigned to you.",
      actions: [
        {
          label:
            summary.openTransactionTaskCount > 0
              ? "Open task list"
              : "Open tasks",
          href: "/office/tasks?view=requires-attention",
          variant: "primary" as const,
        },
        ...(summary.openFollowUpTaskCount > 0
          ? [
              {
                label: "Open contacts",
                href: "/office/contacts",
                variant: "secondary" as const,
              },
            ]
          : []),
      ],
    },
    {
      key: "review_queue",
      label: "Review queue",
      badgeLabel: `${summary.reviewQueueCount} waiting`,
      badgeTone:
        summary.reviewQueueCount > 0
          ? ("accent" as const)
          : ("neutral" as const),
      description: summary.reviewQueueCount
        ? `${formatCountLabel(summary.reviewQueueCount, "Approve Docs item is", "Approve Docs items are")} currently awaiting your review.`
        : "Nothing is currently waiting on you in the Approve Docs review queue.",
      actions: [
        {
          label: "Open Approve Docs",
          href: "/office/approve-docs?queue=awaiting_my_review",
          variant: "primary" as const,
        },
      ],
    },
    {
      key: "open_transactions",
      label: "Open transactions",
      badgeLabel: `${summary.openTransactionCount} open`,
      badgeTone:
        summary.openTransactionCount > 0
          ? ("accent" as const)
          : ("neutral" as const),
      description: summary.openTransactionCount
        ? `Currently owned open records: ${openTransactionParts.join(" · ")}. ${formatCountLabel(summary.recentTransactionCount, "record was", "records were")} updated in ${summary.recentTransactionsWindowLabel.toLowerCase()}. Use the exact status links below because the transactions list does not have a bundled open-only filter yet.`
        : "You do not currently own any open opportunities, active transactions, or pending transactions.",
      actions:
        summary.openTransactionCount > 0
          ? [
              ...(summary.openTransactionOpportunityCount > 0
                ? [
                    {
                      label: "Opportunities",
                      href: `/office/transactions?ownerMembershipId=${currentMembershipId}&status=Opportunity`,
                      variant: "secondary" as const,
                    },
                  ]
                : []),
              ...(summary.openTransactionActiveCount > 0
                ? [
                    {
                      label: "Active",
                      href: `/office/transactions?ownerMembershipId=${currentMembershipId}&status=Active`,
                      variant: "primary" as const,
                    },
                  ]
                : []),
              ...(summary.openTransactionPendingCount > 0
                ? [
                    {
                      label: "Pending",
                      href: `/office/transactions?ownerMembershipId=${currentMembershipId}&status=Pending`,
                      variant: "secondary" as const,
                    },
                  ]
                : []),
            ]
          : [
              {
                label: "Open my transactions",
                href: `/office/transactions?ownerMembershipId=${currentMembershipId}`,
                variant: "secondary" as const,
              },
            ],
    },
    {
      key: "recent_notifications",
      label: "Recent notifications",
      badgeLabel: `${summary.recentNotificationsCount} recent`,
      badgeTone:
        summary.unreadNotificationsCount > 0
          ? ("accent" as const)
          : ("neutral" as const),
      description: summary.recentNotificationsCount
        ? `${formatCountLabel(summary.recentNotificationsCount, "notification was", "notifications were")} created in ${summary.recentNotificationsWindowLabel.toLowerCase()}, with ${formatCountLabel(summary.unreadNotificationsCount, "item", "items")} unread right now. The inbox opens unread-first; a recent-only filter does not exist yet.`
        : summary.unreadNotificationsCount > 0
          ? `No notifications were created in ${summary.recentNotificationsWindowLabel.toLowerCase()}, but ${formatCountLabel(summary.unreadNotificationsCount, "older item is", "older items are")} still unread in your inbox.`
          : `No notifications have been created for this account in ${summary.recentNotificationsWindowLabel.toLowerCase()}.`,
      actions: [
        ...(summary.unreadNotificationsCount > 0
          ? [
              {
                label: "Unread inbox",
                href: "/office/notifications?readState=unread",
                variant: "primary" as const,
              },
            ]
          : []),
        {
          label:
            summary.unreadNotificationsCount > 0
              ? "Open full inbox"
              : "Open inbox",
          href: "/office/notifications",
          variant:
            summary.unreadNotificationsCount > 0
              ? ("secondary" as const)
              : ("primary" as const),
        },
      ],
    },
  ];
}

export function OfficeAccountClient({
  snapshot,
  currentMembershipId,
}: OfficeAccountClientProps) {
  const { messages, t } = useI18n();
  const router = useRouter();
  const [profileState, setProfileState] = useState<ProfileState>(
    buildProfileState(snapshot),
  );
  const [notificationState, setNotificationState] =
    useState<OfficeAccountNotificationPreferenceState>(
      snapshot.notifications.preferences,
    );
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [profileError, setProfileError] = useState("");
  const [notificationError, setNotificationError] = useState("");

  useEffect(() => {
    setProfileState(buildProfileState(snapshot));
    setNotificationState(snapshot.notifications.preferences);
  }, [snapshot]);

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("profile");
    setProfileError("");

    try {
      const response = await fetch("/api/office/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileState),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to save account profile.");
      }

      router.refresh();
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : "Failed to save account profile.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleNotificationSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("notifications");
    setNotificationError("");

    try {
      const response = await fetch("/api/office/account/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(notificationState),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? "Failed to save notification preferences.",
        );
      }

      router.refresh();
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : "Failed to save notification preferences.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function setProfileField(field: keyof ProfileState, value: string) {
    setProfileState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function setNotificationField(
    field: keyof OfficeAccountNotificationPreferenceState,
    value: boolean,
  ) {
    setNotificationState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const timezoneOptions = buildUniqueOptions(
    profileState.timezone,
    commonTimezones,
  );
  const localeOptions = buildUniqueOptions(profileState.locale, commonLocales);
  const avatarInitials = buildInitials(
    profileState.displayName || snapshot.profile.fullName,
  );
  const summaryDrilldowns = buildSummaryDrilldowns(
    snapshot.summary,
    currentMembershipId,
  );
  const securityRows = [
    {
      key: "auth_method",
      label: snapshot.security.authMethodLabel,
      description: snapshot.security.authMethodDescription,
      tone: "neutral" as const,
      badgeLabel: "Current",
    },
    {
      key: "password_status",
      label: snapshot.security.passwordStatusLabel,
      description: snapshot.security.passwordStatusDescription,
      tone: getPasswordStatusTone(snapshot.security),
      badgeLabel: snapshot.security.passwordStatusLabel,
    },
    {
      key: "lock_status",
      label: snapshot.security.lockStatusLabel,
      description: snapshot.security.lockStatusDescription,
      tone: getLockStatusTone(snapshot.security),
      badgeLabel: snapshot.security.lockStatusLabel,
    },
    {
      key: "recovery_status",
      label: snapshot.security.recoveryStatusLabel,
      description: snapshot.security.recoveryStatusDescription,
      tone: "warning" as const,
      badgeLabel: snapshot.security.recoveryStatusLabel,
    },
    {
      key: "two_step",
      label: snapshot.security.twoStepStatusLabel,
      description: snapshot.security.twoStepStatusDescription,
      tone: "warning" as const,
      badgeLabel: snapshot.security.twoStepStatusLabel,
    },
    {
      key: "session_model",
      label: snapshot.security.sessionStatusLabel,
      description: snapshot.security.sessionStatusDescription,
      tone: "neutral" as const,
      badgeLabel: "Current model",
    },
  ];
  const securityDetails = [
    {
      key: "sign_in_email",
      label: t((currentMessages) => currentMessages.auth.signInEmail),
      value: snapshot.security.signInIdentifierLabel,
    },
    {
      key: "password_changed",
      label: t((currentMessages) => currentMessages.auth.passwordLastChanged),
      value: snapshot.security.passwordChangedAtLabel,
    },
    {
      key: "last_login",
      label: t((currentMessages) => currentMessages.auth.lastSuccessfulSignIn),
      value: snapshot.security.lastLoginAtLabel,
    },
    {
      key: "last_failed",
      label: t((currentMessages) => currentMessages.auth.lastFailedSignIn),
      value: snapshot.security.lastFailedLoginAtLabel,
    },
    {
      key: "failed_attempts",
      label: t((currentMessages) => currentMessages.auth.failedAttemptsRecorded),
      value: snapshot.security.failedLoginCountLabel,
    },
    {
      key: "lock_until",
      label: t((currentMessages) => currentMessages.auth.lockUntil),
      value: snapshot.security.lockedUntilLabel,
    },
  ];

  return (
    <>
      <SectionCard
        subtitle={t((currentMessages) => currentMessages.officeAccount.mySummarySubtitle)}
        title={t((currentMessages) => currentMessages.officeAccount.mySummary)}
      >
        <section className="office-account-summary-grid">
          <StatCard
            hint={`${snapshot.summary.openTransactionTaskCount} transaction tasks · ${snapshot.summary.openFollowUpTaskCount} follow-up tasks`}
            label={t((currentMessages) => currentMessages.officeAccount.openTasks)}
            value={snapshot.summary.openTaskCount}
          />
          <StatCard
            hint="Current actionable count from Approve Docs."
            label={t((currentMessages) => currentMessages.officeAccount.myReviewQueue)}
            value={snapshot.summary.reviewQueueCount}
          />
          <StatCard
            hint={`${snapshot.summary.openTransactionOpportunityCount} opportunity · ${snapshot.summary.openTransactionActiveCount} active · ${snapshot.summary.openTransactionPendingCount} pending · ${snapshot.summary.recentTransactionCount} updated in ${snapshot.summary.recentTransactionsWindowLabel.toLowerCase()}`}
            label={t((currentMessages) => currentMessages.officeAccount.myOpenTransactions)}
            value={snapshot.summary.openTransactionCount}
          />
          <StatCard
            hint={`${snapshot.summary.unreadNotificationsCount} unread now · ${snapshot.summary.recentNotificationsWindowLabel}`}
            label={t((currentMessages) => currentMessages.officeAccount.recentNotifications)}
            value={snapshot.summary.recentNotificationsCount}
          />
        </section>

        <div className="office-account-security-list">
          {summaryDrilldowns.map((item) => (
            <article className="office-account-security-row" key={item.key}>
              <div>
                <strong>{item.label}</strong>
                <p>{item.description}</p>
              </div>

              <div style={accountRowActionStackStyle}>
                <StatusBadge tone={item.badgeTone}>
                  {item.badgeLabel}
                </StatusBadge>
                <div style={accountRowActionListStyle}>
                  {item.actions.map((action) => (
                    <Link
                      className={getActionClassName(action.variant)}
                      href={action.href}
                      key={`${item.key}:${action.label}`}
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>

      <section className="office-account-layout">
        <div className="office-account-main-column">
          <form onSubmit={handleProfileSave}>
            <SectionCard
              actions={
                <Button
                  disabled={pendingAction === "profile"}
                  size="sm"
                  type="submit"
                  variant="secondary"
                >
                  {pendingAction === "profile"
                    ? t((currentMessages) => currentMessages.common.saving)
                    : t((currentMessages) => currentMessages.officeAccount.saveProfile)}
                </Button>
              }
              subtitle={t((currentMessages) => currentMessages.officeAccount.profileSubtitle)}
              title={t((currentMessages) => currentMessages.officeAccount.profile)}
            >
              <div className="office-account-profile-shell">
                <div className="office-account-avatar-panel">
                  {profileState.avatarUrl ? (
                    <img
                      alt={`${snapshot.profile.fullName} avatar`}
                      className="office-account-avatar-image"
                      src={profileState.avatarUrl}
                    />
                  ) : (
                    <div
                      className="office-account-avatar-fallback"
                      aria-hidden="true"
                    >
                      {avatarInitials}
                    </div>
                  )}
                  <div className="office-account-avatar-copy">
                    <strong>
                      {profileState.displayName || snapshot.profile.fullName}
                    </strong>
                    <span>{snapshot.officeTeam.roleLabel}</span>
                    <span>{snapshot.officeTeam.officeName}</span>
                  </div>
                </div>

                <div className="office-form-grid office-form-grid-3">
                  <FormField label={t((currentMessages) => currentMessages.officeAccount.firstName)}>
                    <TextInput
                      onChange={(event) =>
                        setProfileField("firstName", event.target.value)
                      }
                      required
                      value={profileState.firstName}
                    />
                  </FormField>

                  <FormField label={t((currentMessages) => currentMessages.officeAccount.lastName)}>
                    <TextInput
                      onChange={(event) =>
                        setProfileField("lastName", event.target.value)
                      }
                      required
                      value={profileState.lastName}
                    />
                  </FormField>

                  <FormField
                    label={t((currentMessages) => currentMessages.officeAccount.displayName)}
                    helper={t((currentMessages) => currentMessages.officeAccount.displayNameHelper)}
                  >
                    <TextInput
                      onChange={(event) =>
                        setProfileField("displayName", event.target.value)
                      }
                      value={profileState.displayName}
                    />
                  </FormField>

                  <FormField label={t((currentMessages) => currentMessages.officeAccount.phone)}>
                    <TextInput
                      onChange={(event) =>
                        setProfileField("phone", event.target.value)
                      }
                      placeholder="+1 (555) 555-5555"
                      value={profileState.phone}
                    />
                  </FormField>

                  <FormField label={t((currentMessages) => currentMessages.officeAccount.internalExtension)}>
                    <TextInput
                      onChange={(event) =>
                        setProfileField("internalExtension", event.target.value)
                      }
                      placeholder="204"
                      value={profileState.internalExtension}
                    />
                  </FormField>

                  <FormField label={t((currentMessages) => currentMessages.officeAccount.avatarUrl)}>
                    <TextInput
                      onChange={(event) =>
                        setProfileField("avatarUrl", event.target.value)
                      }
                      placeholder="https://..."
                      value={profileState.avatarUrl}
                    />
                  </FormField>

                  <FormField label={t((currentMessages) => currentMessages.officeAccount.licenseNumber)}>
                    <TextInput
                      onChange={(event) =>
                        setProfileField("licenseNumber", event.target.value)
                      }
                      value={profileState.licenseNumber}
                    />
                  </FormField>

                  <FormField label={t((currentMessages) => currentMessages.officeAccount.licenseState)}>
                    <TextInput
                      onChange={(event) =>
                        setProfileField("licenseState", event.target.value)
                      }
                      placeholder="NY"
                      value={profileState.licenseState}
                    />
                  </FormField>

                  <FormField label={t((currentMessages) => currentMessages.officeAccount.timezone)}>
                    <SelectInput
                      onChange={(event) =>
                        setProfileField("timezone", event.target.value)
                      }
                      value={profileState.timezone}
                    >
                      {timezoneOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>

                  <FormField label={t((currentMessages) => currentMessages.officeAccount.locale)}>
                    <SelectInput
                      onChange={(event) =>
                        setProfileField("locale", event.target.value)
                      }
                      value={profileState.locale}
                    >
                      {localeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option === "zh-CN"
                            ? messages.common.simplifiedChinese
                            : messages.common.english}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>

                  <FormField
                    className="office-form-grid-span-3"
                    helper={t((currentMessages) => currentMessages.officeAccount.emailHelper)}
                    label={t((currentMessages) => currentMessages.officeAccount.email)}
                  >
                    <TextInput disabled value={snapshot.profile.email} />
                  </FormField>

                  <FormField className="office-form-grid-span-3" label={t((currentMessages) => currentMessages.officeAccount.bio)}>
                    <TextareaInput
                      onChange={(event) =>
                        setProfileField("bio", event.target.value)
                      }
                      rows={4}
                      value={profileState.bio}
                    />
                  </FormField>
                </div>
              </div>

              {profileError ? (
                <p className="office-form-error">{profileError}</p>
              ) : null}
            </SectionCard>
          </form>

          <SectionCard
            subtitle={t((currentMessages) => currentMessages.officeAccount.officeTeamSubtitle)}
            title={t((currentMessages) => currentMessages.officeAccount.officeTeam)}
          >
            <SecondaryMetaList
              items={[
                { label: t((currentMessages) => currentMessages.officeAccount.office), value: snapshot.officeTeam.officeName },
                { label: t((currentMessages) => currentMessages.officeAccount.market), value: snapshot.officeTeam.officeMarket },
                { label: t((currentMessages) => currentMessages.common.role), value: snapshot.officeTeam.roleLabel },
                { label: t((currentMessages) => currentMessages.officeAccount.titleField), value: snapshot.officeTeam.title },
                {
                  label: t((currentMessages) => currentMessages.officeAccount.membership),
                  value: snapshot.officeTeam.membershipStatusLabel,
                },
                {
                  label: t((currentMessages) => currentMessages.officeAccount.startDate),
                  value: snapshot.officeTeam.startDateLabel,
                },
                {
                  label: t((currentMessages) => currentMessages.officeAccount.onboarding),
                  value: snapshot.officeTeam.onboardingStatusLabel,
                },
              ]}
            />

            <div className="office-account-team-section">
              <div className="office-account-subhead">
                <strong>{t((currentMessages) => currentMessages.officeAccount.teams)}</strong>
                <span>
                  {snapshot.officeTeam.teams.length
                    ? t((currentMessages) => currentMessages.officeAccount.currentAssignments, {
                        count: snapshot.officeTeam.teams.length,
                      })
                    : t((currentMessages) => currentMessages.officeAccount.noTeamAssignments)}
                </span>
              </div>

              {snapshot.officeTeam.teams.length ? (
                <div className="office-account-team-list">
                  {snapshot.officeTeam.teams.map((team) => (
                    <article className="office-account-team-row" key={team.id}>
                      <div>
                        <strong>{team.name}</strong>
                        <p>{team.roleLabel}</p>
                      </div>
                      <Badge tone={getTeamTone(team.isActive)}>
                        {team.isActive
                          ? t((currentMessages) => currentMessages.common.active)
                          : t((currentMessages) => currentMessages.common.inactive)}
                      </Badge>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="office-account-empty-note">
                  {t((currentMessages) => currentMessages.officeAccount.noTeamAssignmentsBody)}
                </p>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="office-account-side-column">
          <form onSubmit={handleNotificationSave}>
            <SectionCard
              actions={
                <Button
                  disabled={pendingAction === "notifications"}
                  size="sm"
                  type="submit"
                  variant="secondary"
                >
                  {pendingAction === "notifications"
                    ? t((currentMessages) => currentMessages.common.saving)
                    : t((currentMessages) => currentMessages.officeAccount.savePreferences)}
                </Button>
              }
              subtitle={t((currentMessages) => currentMessages.officeAccount.notificationsSubtitle)}
              title={t((currentMessages) => currentMessages.officeAccount.notifications)}
            >
              <SecondaryMetaList
                items={[
                  {
                    label: t((currentMessages) => currentMessages.officeAccount.unreadInboxItems),
                    value: snapshot.notifications.unreadCount,
                  },
                  {
                    label: t((currentMessages) => currentMessages.officeAccount.recentInboxItems),
                    value: snapshot.notifications.recentCount,
                  },
                  {
                    label: t((currentMessages) => currentMessages.officeAccount.lastUpdated),
                    value: snapshot.notifications.lastUpdatedLabel,
                  },
                ]}
              />

              <div className="office-account-preference-list">
                <label className="office-account-toggle">
                  <input
                    checked={notificationState.inAppEnabled}
                    onChange={(event) =>
                      setNotificationField("inAppEnabled", event.target.checked)
                    }
                    type="checkbox"
                  />
                  <div>
                    <strong>{t((currentMessages) => currentMessages.officeAccount.inAppNotifications)}</strong>
                    <p>{t((currentMessages) => currentMessages.officeAccount.inAppNotificationsBody)}</p>
                  </div>
                </label>

                <label
                  className={`office-account-toggle${notificationState.inAppEnabled ? "" : " is-disabled"}`}
                >
                  <input
                    checked={notificationState.approvalAlertsEnabled}
                    disabled={!notificationState.inAppEnabled}
                    onChange={(event) =>
                      setNotificationField(
                        "approvalAlertsEnabled",
                        event.target.checked,
                      )
                    }
                    type="checkbox"
                  />
                  <div>
                    <strong>{t((currentMessages) => currentMessages.officeAccount.approvalAlerts)}</strong>
                    <p>{t((currentMessages) => currentMessages.officeAccount.approvalAlertsBody)}</p>
                  </div>
                </label>

                <label
                  className={`office-account-toggle${notificationState.inAppEnabled ? "" : " is-disabled"}`}
                >
                  <input
                    checked={notificationState.taskRemindersEnabled}
                    disabled={!notificationState.inAppEnabled}
                    onChange={(event) =>
                      setNotificationField(
                        "taskRemindersEnabled",
                        event.target.checked,
                      )
                    }
                    type="checkbox"
                  />
                  <div>
                    <strong>{t((currentMessages) => currentMessages.officeAccount.taskReminders)}</strong>
                    <p>{t((currentMessages) => currentMessages.officeAccount.taskRemindersBody)}</p>
                  </div>
                </label>

                <label
                  className={`office-account-toggle${notificationState.inAppEnabled ? "" : " is-disabled"}`}
                >
                  <input
                    checked={notificationState.messageAlertsEnabled}
                    disabled={!notificationState.inAppEnabled}
                    onChange={(event) =>
                      setNotificationField(
                        "messageAlertsEnabled",
                        event.target.checked,
                      )
                    }
                    type="checkbox"
                  />
                  <div>
                    <strong>{t((currentMessages) => currentMessages.officeAccount.messageAlerts)}</strong>
                    <p>{t((currentMessages) => currentMessages.officeAccount.messageAlertsBody)}</p>
                  </div>
                </label>

                <label
                  className={`office-account-toggle${notificationState.inAppEnabled ? "" : " is-disabled"}`}
                >
                  <input
                    checked={notificationState.offerAlertsEnabled}
                    disabled={!notificationState.inAppEnabled}
                    onChange={(event) =>
                      setNotificationField(
                        "offerAlertsEnabled",
                        event.target.checked,
                      )
                    }
                    type="checkbox"
                  />
                  <div>
                    <strong>{t((currentMessages) => currentMessages.officeAccount.offerAlerts)}</strong>
                    <p>{t((currentMessages) => currentMessages.officeAccount.offerAlertsBody)}</p>
                  </div>
                </label>
              </div>

              <div className="office-account-channel-list">
                <div className="office-account-channel-row">
                  <div>
                    <strong>{t((currentMessages) => currentMessages.officeAccount.inAppNotifications)}</strong>
                    <p>{t((currentMessages) => currentMessages.officeAccount.inAppNotificationsBody)}</p>
                  </div>
                  <StatusBadge
                    tone={
                      notificationState.inAppEnabled ? "success" : "neutral"
                    }
                  >
                    {notificationState.inAppEnabled
                      ? t((currentMessages) => currentMessages.common.active)
                      : t((currentMessages) => currentMessages.common.inactive)}
                  </StatusBadge>
                </div>

                <div className="office-account-channel-row">
                  <div>
                    <strong>{t((currentMessages) => currentMessages.officeAccount.emailChannel)}</strong>
                    <p>{t((currentMessages) => currentMessages.officeAccount.unavailableChannelBody)}</p>
                  </div>
                  <StatusBadge tone="warning">
                    {t((currentMessages) => currentMessages.common.unavailable)}
                  </StatusBadge>
                </div>

                <div className="office-account-channel-row">
                  <div>
                    <strong>{t((currentMessages) => currentMessages.officeAccount.smsPushChannel)}</strong>
                    <p>{t((currentMessages) => currentMessages.officeAccount.unavailableChannelBody)}</p>
                  </div>
                  <StatusBadge tone="warning">
                    {t((currentMessages) => currentMessages.common.unavailable)}
                  </StatusBadge>
                </div>
              </div>

              {notificationError ? (
                <p className="office-form-error">{notificationError}</p>
              ) : null}
            </SectionCard>
          </form>

          <SectionCard
            subtitle={t((currentMessages) => currentMessages.officeAccount.securitySubtitle)}
            title={t((currentMessages) => currentMessages.officeAccount.security)}
          >
            <div className="office-account-security-list">
              {securityRows.map((item) => (
                <article className="office-account-security-row" key={item.key}>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.description}</p>
                  </div>
                  <StatusBadge tone={item.tone}>{item.badgeLabel}</StatusBadge>
                </article>
              ))}
            </div>

            <div className="office-detail-grid">
              {securityDetails.map((item) => (
                <div className="office-detail-field" key={item.key}>
                  <span className="office-form-helper">{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="office-account-security-actions">
              {snapshot.security.canChangePassword ? (
                <Link
                  className="office-button office-button-sm"
                  href="/change-password"
                >
                  {t((currentMessages) => currentMessages.officeAccount.changePassword)}
                </Link>
              ) : null}
                <Link
                  className="office-button-secondary office-button-sm"
                  href="/office/activity?objectType=auth"
                >
                  {t((currentMessages) => currentMessages.officeNav.items.activity)}
                </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  className="office-button-secondary office-button-sm"
                  type="submit"
                >
                  {t((currentMessages) => currentMessages.officeAccount.signOutAndSwitchUser)}
                </button>
              </form>
            </div>

            <p className="office-account-security-note">
              {snapshot.security.signInIdentifierDescription}{" "}
              {snapshot.security.passwordActionDescription}
            </p>
          </SectionCard>
        </div>
      </section>
    </>
  );
}
