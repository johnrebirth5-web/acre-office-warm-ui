"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
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
  TextareaInput
} from "@acre/ui";
import type { OfficeAccountNotificationPreferenceState, OfficeAccountSnapshot } from "@acre/db";

type OfficeAccountClientProps = {
  snapshot: OfficeAccountSnapshot;
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
  "Pacific/Honolulu"
];

const commonLocales = ["en-US", "es-US", "zh-CN"];

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
    locale: snapshot.profile.locale
  };
}

function buildInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AC";
}

function buildUniqueOptions(currentValue: string, values: string[]) {
  return Array.from(new Set([currentValue, ...values].filter((value) => value.trim().length > 0)));
}

function getTeamTone(isActive: boolean) {
  return isActive ? "success" as const : "neutral" as const;
}

function getSecurityTone(value: string) {
  if (value === "Temporarily locked") {
    return "danger" as const;
  }

  if (value === "Unavailable") {
    return "warning" as const;
  }

  if (value === "Setup required" || value === "Password setup required" || value === "Password change required") {
    return "accent" as const;
  }

  return "success" as const;
}

export function OfficeAccountClient({ snapshot }: OfficeAccountClientProps) {
  const router = useRouter();
  const [profileState, setProfileState] = useState<ProfileState>(buildProfileState(snapshot));
  const [notificationState, setNotificationState] = useState<OfficeAccountNotificationPreferenceState>(snapshot.notifications.preferences);
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
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profileState)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save account profile.");
      }

      router.refresh();
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to save account profile.");
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
          "Content-Type": "application/json"
        },
        body: JSON.stringify(notificationState)
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to save notification preferences.");
      }

      router.refresh();
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Failed to save notification preferences.");
    } finally {
      setPendingAction(null);
    }
  }

  function setProfileField(field: keyof ProfileState, value: string) {
    setProfileState((current) => ({
      ...current,
      [field]: value
    }));
  }

  function setNotificationField(field: keyof OfficeAccountNotificationPreferenceState, value: boolean) {
    setNotificationState((current) => ({
      ...current,
      [field]: value
    }));
  }

  const timezoneOptions = buildUniqueOptions(profileState.timezone, commonTimezones);
  const localeOptions = buildUniqueOptions(profileState.locale, commonLocales);
  const avatarInitials = buildInitials(profileState.displayName || snapshot.profile.fullName);

  return (
    <>
      <section className="office-account-summary-grid">
        <StatCard
          hint={`${snapshot.summary.openTransactionTaskCount} transaction tasks · ${snapshot.summary.openFollowUpTaskCount} follow-ups`}
          label="My open tasks"
          value={snapshot.summary.openTaskCount}
        />
        <StatCard
          hint="Current actionable count from Approve Docs."
          label="My review queue"
          value={snapshot.summary.reviewQueueCount}
        />
        <StatCard
          hint={`${snapshot.summary.recentTransactionCount} updated in the last 30 days`}
          label="My open transactions"
          value={snapshot.summary.openTransactionCount}
        />
        <StatCard
          hint={`${snapshot.summary.unreadNotificationsCount} unread in the inbox`}
          label="Recent notifications"
          value={snapshot.summary.recentNotificationsCount}
        />
      </section>

      <section className="office-account-layout">
        <div className="office-account-main-column">
          <form onSubmit={handleProfileSave}>
            <SectionCard
              actions={
                <Button disabled={pendingAction === "profile"} size="sm" type="submit" variant="secondary">
                  {pendingAction === "profile" ? "Saving..." : "Save profile"}
                </Button>
              }
              subtitle="Safe self-service fields only. Email, role, office access, and team assignment stay read-only here."
              title="Profile"
            >
              <div className="office-account-profile-shell">
                <div className="office-account-avatar-panel">
                  {profileState.avatarUrl ? (
                    <img alt={`${snapshot.profile.fullName} avatar`} className="office-account-avatar-image" src={profileState.avatarUrl} />
                  ) : (
                    <div className="office-account-avatar-fallback" aria-hidden="true">
                      {avatarInitials}
                    </div>
                  )}
                  <div className="office-account-avatar-copy">
                    <strong>{profileState.displayName || snapshot.profile.fullName}</strong>
                    <span>{snapshot.officeTeam.roleLabel}</span>
                    <span>{snapshot.officeTeam.officeName}</span>
                  </div>
                </div>

                <div className="office-form-grid office-form-grid-3">
                  <FormField label="First name">
                    <TextInput onChange={(event) => setProfileField("firstName", event.target.value)} required value={profileState.firstName} />
                  </FormField>

                  <FormField label="Last name">
                    <TextInput onChange={(event) => setProfileField("lastName", event.target.value)} required value={profileState.lastName} />
                  </FormField>

                  <FormField label="Display name" helper="Shown anywhere a profile name can be shortened.">
                    <TextInput onChange={(event) => setProfileField("displayName", event.target.value)} value={profileState.displayName} />
                  </FormField>

                  <FormField label="Phone">
                    <TextInput onChange={(event) => setProfileField("phone", event.target.value)} placeholder="(555) 555-5555" value={profileState.phone} />
                  </FormField>

                  <FormField label="Internal extension">
                    <TextInput onChange={(event) => setProfileField("internalExtension", event.target.value)} placeholder="Ext. 204" value={profileState.internalExtension} />
                  </FormField>

                  <FormField label="Avatar URL">
                    <TextInput onChange={(event) => setProfileField("avatarUrl", event.target.value)} placeholder="https://..." value={profileState.avatarUrl} />
                  </FormField>

                  <FormField label="License number">
                    <TextInput onChange={(event) => setProfileField("licenseNumber", event.target.value)} value={profileState.licenseNumber} />
                  </FormField>

                  <FormField label="License state">
                    <TextInput onChange={(event) => setProfileField("licenseState", event.target.value)} placeholder="NY" value={profileState.licenseState} />
                  </FormField>

                  <FormField label="Timezone">
                    <SelectInput onChange={(event) => setProfileField("timezone", event.target.value)} value={profileState.timezone}>
                      {timezoneOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>

                  <FormField label="Locale">
                    <SelectInput onChange={(event) => setProfileField("locale", event.target.value)} value={profileState.locale}>
                      {localeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>

                  <FormField className="office-form-grid-span-3" helper="Email stays read-only because it is the internal sign-in identifier for this account." label="Email">
                    <TextInput disabled value={snapshot.profile.email} />
                  </FormField>

                  <FormField className="office-form-grid-span-3" label="Bio">
                    <TextareaInput onChange={(event) => setProfileField("bio", event.target.value)} rows={4} value={profileState.bio} />
                  </FormField>
                </div>
              </div>

              {profileError ? <p className="office-form-error">{profileError}</p> : null}
            </SectionCard>
          </form>

          <SectionCard
            subtitle="Assignment and access context stay visible here, but manager-controlled access lives in Office Admin."
            title="Office / Team"
          >
            <SecondaryMetaList
              items={[
                { label: "Office", value: snapshot.officeTeam.officeName },
                { label: "Market", value: snapshot.officeTeam.officeMarket },
                { label: "Role", value: snapshot.officeTeam.roleLabel },
                { label: "Title", value: snapshot.officeTeam.title },
                { label: "Membership", value: snapshot.officeTeam.membershipStatusLabel },
                { label: "Start date", value: snapshot.officeTeam.startDateLabel },
                { label: "Onboarding", value: snapshot.officeTeam.onboardingStatusLabel }
              ]}
            />

            <div className="office-account-team-section">
              <div className="office-account-subhead">
                <strong>Teams</strong>
                <span>{snapshot.officeTeam.teams.length ? `${snapshot.officeTeam.teams.length} current assignments` : "No team assignments"}</span>
              </div>

              {snapshot.officeTeam.teams.length ? (
                <div className="office-account-team-list">
                  {snapshot.officeTeam.teams.map((team) => (
                    <article className="office-account-team-row" key={team.id}>
                      <div>
                        <strong>{team.name}</strong>
                        <p>{team.roleLabel}</p>
                      </div>
                      <Badge tone={getTeamTone(team.isActive)}>{team.isActive ? "Active" : "Inactive"}</Badge>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="office-account-empty-note">This membership is not assigned to a team right now.</p>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="office-account-side-column">
          <form onSubmit={handleNotificationSave}>
            <SectionCard
              actions={
                <Button disabled={pendingAction === "notifications"} size="sm" type="submit" variant="secondary">
                  {pendingAction === "notifications" ? "Saving..." : "Save preferences"}
                </Button>
              }
              subtitle="Only the in-app inbox is implemented today. Email, SMS, and push remain unavailable."
              title="Notifications"
            >
              <SecondaryMetaList
                items={[
                  { label: "Unread inbox items", value: snapshot.notifications.unreadCount },
                  { label: "Recent inbox items", value: snapshot.notifications.recentCount },
                  { label: "Last updated", value: snapshot.notifications.lastUpdatedLabel }
                ]}
              />

              <div className="office-account-preference-list">
                <label className="office-account-toggle">
                  <input
                    checked={notificationState.inAppEnabled}
                    onChange={(event) => setNotificationField("inAppEnabled", event.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <strong>In-app notifications</strong>
                    <p>Master switch for the Office notifications inbox.</p>
                  </div>
                </label>

                <label className={`office-account-toggle${notificationState.inAppEnabled ? "" : " is-disabled"}`}>
                  <input
                    checked={notificationState.approvalAlertsEnabled}
                    disabled={!notificationState.inAppEnabled}
                    onChange={(event) => setNotificationField("approvalAlertsEnabled", event.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <strong>Activity / approval alerts</strong>
                    <p>Task review, rejected task, signature, and incoming update alerts.</p>
                  </div>
                </label>

                <label className={`office-account-toggle${notificationState.inAppEnabled ? "" : " is-disabled"}`}>
                  <input
                    checked={notificationState.taskRemindersEnabled}
                    disabled={!notificationState.inAppEnabled}
                    onChange={(event) => setNotificationField("taskRemindersEnabled", event.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <strong>Task reminders</strong>
                    <p>Follow-up assignments, overdue reminders, and onboarding reminder alerts.</p>
                  </div>
                </label>

                <label className={`office-account-toggle${notificationState.inAppEnabled ? "" : " is-disabled"}`}>
                  <input
                    checked={notificationState.offerAlertsEnabled}
                    disabled={!notificationState.inAppEnabled}
                    onChange={(event) => setNotificationField("offerAlertsEnabled", event.target.checked)}
                    type="checkbox"
                  />
                  <div>
                    <strong>Offer notifications</strong>
                    <p>Offer created, received, and expiring-soon alerts when the offer workflow applies.</p>
                  </div>
                </label>
              </div>

              <div className="office-account-channel-list">
                <div className="office-account-channel-row">
                  <div>
                    <strong>In-app inbox</strong>
                    <p>Implemented and controlled by the toggles above.</p>
                  </div>
                  <StatusBadge tone={notificationState.inAppEnabled ? "success" : "neutral"}>
                    {notificationState.inAppEnabled ? "Enabled" : "Disabled"}
                  </StatusBadge>
                </div>

                <div className="office-account-channel-row">
                  <div>
                    <strong>Email</strong>
                    <p>Not implemented in the current Back Office platform.</p>
                  </div>
                  <StatusBadge tone="warning">Unavailable</StatusBadge>
                </div>

                <div className="office-account-channel-row">
                  <div>
                    <strong>SMS / push</strong>
                    <p>No mobile or push delivery infrastructure exists yet.</p>
                  </div>
                  <StatusBadge tone="warning">Unavailable</StatusBadge>
                </div>
              </div>

              {notificationError ? <p className="office-form-error">{notificationError}</p> : null}
            </SectionCard>
          </form>

          <SectionCard
            actions={
              <Link className="office-button-secondary office-button-sm" href="/office/activity?objectType=auth">
                Open auth activity
              </Link>
            }
            subtitle="Truthful account security context for the current internal Office account flow."
            title="Security"
          >
            <div className="office-account-security-list">
              <article className="office-account-security-row">
                <div>
                  <strong>{snapshot.security.authMethodLabel}</strong>
                  <p>{snapshot.security.authMethodDescription}</p>
                </div>
                <StatusBadge tone="neutral">Current</StatusBadge>
              </article>

              <article className="office-account-security-row">
                <div>
                  <strong>{snapshot.security.passwordStatusLabel}</strong>
                  <p>{snapshot.security.passwordStatusDescription}</p>
                </div>
                <StatusBadge tone={getSecurityTone(snapshot.security.passwordStatusLabel)}>{snapshot.security.passwordStatusLabel}</StatusBadge>
              </article>

              <article className="office-account-security-row">
                <div>
                  <strong>{snapshot.security.twoStepStatusLabel}</strong>
                  <p>{snapshot.security.twoStepStatusDescription}</p>
                </div>
                <StatusBadge tone={getSecurityTone(snapshot.security.twoStepStatusLabel)}>{snapshot.security.twoStepStatusLabel}</StatusBadge>
              </article>

              <article className="office-account-security-row">
                <div>
                  <strong>{snapshot.security.sessionStatusLabel}</strong>
                  <p>{snapshot.security.sessionStatusDescription}</p>
                </div>
                <StatusBadge tone="neutral">Active model</StatusBadge>
              </article>
            </div>

            <div className="office-account-security-actions">
              <Link className="office-button-secondary office-button-sm" href="/change-password">
                Change password
              </Link>
              <form action="/api/auth/logout" method="post">
                <button className="office-button-secondary office-button-sm" type="submit">
                  Sign out and switch user
                </button>
              </form>
            </div>

            <p className="office-account-security-note">
              Forgot password, email delivery, and 2-step setup are not available in-app yet. Admins currently issue setup links from the Users page.
            </p>
          </SectionCard>
        </div>
      </section>
    </>
  );
}
