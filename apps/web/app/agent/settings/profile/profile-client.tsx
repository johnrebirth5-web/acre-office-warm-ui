"use client";
/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Button,
  FormField,
  SectionCard,
  SelectInput,
  TextInput,
  TextareaInput,
} from "@acre/ui";
import type { OfficeAccountSnapshot } from "@acre/db";
import { useI18n } from "../../../../lib/i18n/client";

type AgentSettingsProfileClientProps = {
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

type EmailRequestState = {
  preferredEmailPrefix: string;
  notes: string;
};

const commonTimezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Pacific/Honolulu",
];

const commonLocales = ["en-US", "zh-CN"];

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

function getEmailPrefix(email: string) {
  return email.split("@")[0] ?? "";
}

function getEmailDomain(email: string) {
  return email.split("@")[1] ?? "acreny.us";
}

async function readErrorResponse(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? fallback;
}

export function AgentSettingsProfileClient({
  snapshot,
}: AgentSettingsProfileClientProps) {
  const router = useRouter();
  const { locale, messages } = useI18n();
  const isZh = locale === "zh-CN";
  const [profileState, setProfileState] = useState<ProfileState>(
    buildProfileState(snapshot),
  );
  const [emailRequestState, setEmailRequestState] =
    useState<EmailRequestState>({
      preferredEmailPrefix: getEmailPrefix(snapshot.profile.email),
      notes: "",
    });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [emailRequestMessage, setEmailRequestMessage] = useState("");
  const [emailRequestError, setEmailRequestError] = useState("");
  const avatarInitials = buildInitials(
    profileState.displayName || snapshot.profile.fullName,
  );
  const timezoneOptions = buildUniqueOptions(
    profileState.timezone,
    commonTimezones,
  );
  const localeOptions = buildUniqueOptions(profileState.locale, commonLocales);
  const emailDomain = getEmailDomain(snapshot.profile.email);

  useEffect(() => {
    setProfileState(buildProfileState(snapshot));
    setEmailRequestState({
      preferredEmailPrefix: getEmailPrefix(snapshot.profile.email),
      notes: "",
    });
  }, [snapshot]);

  function setProfileField(field: keyof ProfileState, value: string) {
    setProfileState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function setEmailRequestField(field: keyof EmailRequestState, value: string) {
    setEmailRequestState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("profile");
    setProfileError("");
    setProfileMessage("");

    try {
      const response = await fetch("/api/office/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileState),
      });

      if (!response.ok) {
        throw new Error(
          await readErrorResponse(
            response,
            isZh ? "保存个人资料失败。" : "Failed to save profile.",
          ),
        );
      }

      setProfileMessage(isZh ? "个人资料已保存。" : "Profile saved.");
      router.refresh();
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : isZh
            ? "保存个人资料失败。"
            : "Failed to save profile.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;

    if (!file) {
      return;
    }

    setPendingAction("avatar");
    setProfileError("");
    setProfileMessage("");

    try {
      const formData = new FormData();
      formData.set("avatar", file);

      const response = await fetch("/api/office/account/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await readErrorResponse(
            response,
            isZh ? "上传头像失败。" : "Failed to upload avatar.",
          ),
        );
      }

      const body = (await response.json()) as { avatarUrl?: string };
      const nextAvatarUrl = body.avatarUrl ?? "";
      setProfileField("avatarUrl", nextAvatarUrl);
      setProfileMessage(isZh ? "头像已上传。" : "Avatar uploaded.");
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : isZh
            ? "上传头像失败。"
            : "Failed to upload avatar.",
      );
    } finally {
      event.currentTarget.value = "";
      setPendingAction(null);
    }
  }

  async function handleEmailRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("email-request");
    setEmailRequestError("");
    setEmailRequestMessage("");

    try {
      const response = await fetch("/api/office/account/email-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailRequestState),
      });

      if (!response.ok) {
        throw new Error(
          await readErrorResponse(
            response,
            isZh ? "提交邮箱申请失败。" : "Failed to submit email request.",
          ),
        );
      }

      setEmailRequestMessage(
        isZh
          ? "邮箱更改申请已提交给 Admin Office。"
          : "Email change request sent to Admin Office.",
      );
      setEmailRequestState((current) => ({ ...current, notes: "" }));
    } catch (error) {
      setEmailRequestError(
        error instanceof Error
          ? error.message
          : isZh
            ? "提交邮箱申请失败。"
            : "Failed to submit email request.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="office-account-layout agent-settings-profile-layout">
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
                  ? messages.common.saving
                  : isZh
                    ? "保存资料"
                    : "Save profile"}
              </Button>
            }
            subtitle={
              isZh
                ? "这些字段会用于你的 Front Office 资料、Listing Studio 联系卡和模板页。"
                : "These fields power your Front Office profile, Listing Studio contact cards, and template pages."
            }
            title={isZh ? "公开资料" : "Public profile"}
          >
            <div className="office-account-profile-shell">
              <div className="office-account-avatar-panel agent-settings-avatar-panel">
                {profileState.avatarUrl ? (
                  <img
                    alt={`${profileState.displayName || snapshot.profile.fullName} avatar`}
                    className="office-account-avatar-image"
                    src={profileState.avatarUrl}
                  />
                ) : (
                  <div className="office-account-avatar-fallback" aria-hidden="true">
                    {avatarInitials}
                  </div>
                )}
                <div className="office-account-avatar-copy">
                  <strong>
                    {profileState.displayName || snapshot.profile.fullName}
                  </strong>
                  <span>{snapshot.officeTeam.title}</span>
                  <span>{snapshot.officeTeam.officeName}</span>
                </div>
                <label className="agent-settings-avatar-upload">
                  <input
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={pendingAction === "avatar"}
                    onChange={handleAvatarUpload}
                    type="file"
                  />
                  <span>
                    {pendingAction === "avatar"
                      ? isZh
                        ? "上传中..."
                        : "Uploading..."
                      : isZh
                        ? "上传头像"
                        : "Upload avatar"}
                  </span>
                </label>
              </div>

              <div className="office-form-grid office-form-grid-3">
                <FormField label={isZh ? "名" : "First name"}>
                  <TextInput
                    autoComplete="given-name"
                    onChange={(event) =>
                      setProfileField("firstName", event.target.value)
                    }
                    required
                    value={profileState.firstName}
                  />
                </FormField>

                <FormField label={isZh ? "姓" : "Last name"}>
                  <TextInput
                    autoComplete="family-name"
                    onChange={(event) =>
                      setProfileField("lastName", event.target.value)
                    }
                    required
                    value={profileState.lastName}
                  />
                </FormField>

                <FormField
                  helper={
                    isZh
                      ? "公开资料和模板页优先显示这个名称。"
                      : "Shown first on public profile and template surfaces."
                  }
                  label={isZh ? "显示名称" : "Display name"}
                >
                  <TextInput
                    autoComplete="name"
                    onChange={(event) =>
                      setProfileField("displayName", event.target.value)
                    }
                    value={profileState.displayName}
                  />
                </FormField>

                <FormField label={isZh ? "电话" : "Phone"}>
                  <TextInput
                    autoComplete="tel"
                    onChange={(event) =>
                      setProfileField("phone", event.target.value)
                    }
                    placeholder="+1 (555) 555-5555"
                    value={profileState.phone}
                  />
                </FormField>

                <FormField label={isZh ? "内部分机" : "Internal extension"}>
                  <TextInput
                    onChange={(event) =>
                      setProfileField("internalExtension", event.target.value)
                    }
                    placeholder="204"
                    value={profileState.internalExtension}
                  />
                </FormField>

                <FormField label={isZh ? "执照编号" : "License number"}>
                  <TextInput
                    onChange={(event) =>
                      setProfileField("licenseNumber", event.target.value)
                    }
                    value={profileState.licenseNumber}
                  />
                </FormField>

                <FormField label={isZh ? "执照州" : "License state"}>
                  <TextInput
                    onChange={(event) =>
                      setProfileField("licenseState", event.target.value)
                    }
                    placeholder="NY"
                    value={profileState.licenseState}
                  />
                </FormField>

                <FormField label={isZh ? "时区" : "Timezone"}>
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

                <FormField label={isZh ? "语言" : "Language"}>
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
                  helper={
                    isZh
                      ? "邮箱是当前登录标识。需要变更时请提交下面的管理员申请。"
                      : "Email is your current sign-in identifier. Use the admin request below for changes."
                  }
                  label={isZh ? "当前邮箱" : "Current email"}
                >
                  <TextInput disabled value={snapshot.profile.email} />
                </FormField>

                <FormField
                  className="office-form-grid-span-3"
                  label={isZh ? "简介" : "Bio"}
                >
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
            {profileMessage ? (
              <p className="office-form-success">{profileMessage}</p>
            ) : null}
          </SectionCard>
        </form>

        <SectionCard
          subtitle={
            isZh
              ? "头像保存后会自动用于 Listing Studio 公开清单底部和模板海报联系区域。"
              : "Once saved, your avatar appears in Listing Studio public contact cards and poster contact areas."
          }
          title={isZh ? "Listing Studio 预览" : "Listing Studio preview"}
        >
          <div className="agent-settings-listing-preview">
            {profileState.avatarUrl ? (
              <img
                alt=""
                className="agent-settings-listing-preview-avatar"
                src={profileState.avatarUrl}
              />
            ) : (
              <div className="agent-settings-listing-preview-avatar" aria-hidden="true">
                {avatarInitials}
              </div>
            )}
            <div>
              <strong>
                {isZh ? "想进一步了解这套房源？" : "Interested in this property?"}
              </strong>
              <span>
                {isZh
                  ? `联系 ${profileState.displayName || snapshot.profile.fullName} 获取更多信息。`
                  : `Contact ${profileState.displayName || snapshot.profile.fullName} for more information.`}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="office-account-side-column">
        <form onSubmit={handleEmailRequest}>
          <SectionCard
            actions={
              <Button
                disabled={pendingAction === "email-request"}
                size="sm"
                type="submit"
                variant="secondary"
              >
                {pendingAction === "email-request"
                  ? messages.common.saving
                  : isZh
                    ? "提交申请"
                    : "Send request"}
              </Button>
            }
            subtitle={
              isZh
                ? "不会直接修改登录邮箱；Admin Office 审核后再处理。"
                : "This does not change your sign-in email directly; Admin Office reviews it first."
            }
            title={isZh ? "请求更改邮箱" : "Request email change"}
          >
            <div className="office-form-grid">
              <FormField label={isZh ? "当前邮箱" : "Current email"}>
                <TextInput disabled value={snapshot.profile.email} />
              </FormField>
              <FormField
                helper={`${emailRequestState.preferredEmailPrefix || "name"}@${emailDomain}`}
                label={isZh ? "希望使用的邮箱前缀" : "Preferred email prefix"}
              >
                <TextInput
                  autoComplete="off"
                  onChange={(event) =>
                    setEmailRequestField(
                      "preferredEmailPrefix",
                      event.target.value,
                    )
                  }
                  required
                  value={emailRequestState.preferredEmailPrefix}
                />
              </FormField>
              <FormField label={isZh ? "备注" : "Note"}>
                <TextareaInput
                  onChange={(event) =>
                    setEmailRequestField("notes", event.target.value)
                  }
                  rows={4}
                  value={emailRequestState.notes}
                />
              </FormField>
            </div>
            {emailRequestError ? (
              <p className="office-form-error">{emailRequestError}</p>
            ) : null}
            {emailRequestMessage ? (
              <p className="office-form-success">{emailRequestMessage}</p>
            ) : null}
          </SectionCard>
        </form>

        <SectionCard
          subtitle={
            isZh
              ? "这些上下文仍由 Back Office 管理。"
              : "This context is still managed from Back Office."
          }
          title={isZh ? "账户上下文" : "Account context"}
        >
          <dl className="agent-settings-profile-context">
            <div>
              <dt>{isZh ? "办公室" : "Office"}</dt>
              <dd>{snapshot.officeTeam.officeName}</dd>
            </div>
            <div>
              <dt>{isZh ? "职位" : "Title"}</dt>
              <dd>{snapshot.officeTeam.title}</dd>
            </div>
            <div>
              <dt>{isZh ? "成员状态" : "Membership"}</dt>
              <dd>{snapshot.officeTeam.membershipStatusLabel}</dd>
            </div>
            <div>
              <dt>{isZh ? "团队" : "Teams"}</dt>
              <dd>
                {snapshot.officeTeam.teams.length
                  ? snapshot.officeTeam.teams.map((team) => team.name).join(", ")
                  : isZh
                    ? "未分配"
                    : "Not assigned"}
              </dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </section>
  );
}
