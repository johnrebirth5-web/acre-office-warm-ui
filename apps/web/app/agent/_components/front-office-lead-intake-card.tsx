"use client";

import { ClientFollowUpStatus } from "@prisma/client";
import {
  Button,
  EmptyState,
  FormField,
  QueueItem,
  SectionCard,
  SelectInput,
  StatusBadge,
  TextInput,
  TextareaInput,
} from "@acre/ui";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  extractFrontOfficeLeadIntakeAssist,
  type FrontOfficeLeadIntakeAssistField,
  type FrontOfficeLeadIntakeAssistResult,
} from "./front-office-lead-intake-assist";
import {
  buildFrontOfficeLeadDuplicatePreview,
  type FrontOfficeLeadDuplicatePreviewCandidate,
} from "./front-office-lead-intake-review";
import { FrontOfficeLink } from "./front-office-link";
import type { FrontOfficeLeadIntakeAiExtraction } from "../../../lib/front-office-intake-ai";
import { useI18n } from "../../../lib/i18n/client";
import { translateFrontOfficeLabel } from "../_lib/front-office-language";

type FrontOfficeLeadIntakeCardProps = {
  title?: string;
  subtitle?: string;
  density?: "default" | "compact";
  dashboardCompact?: boolean;
  sourceSurface: "dashboard" | "clients";
  initialDuplicatePreviewCandidates?: FrontOfficeLeadDuplicatePreviewCandidate[];
  hydrateDuplicatePreviewCandidates?: boolean;
};

type LeadFormState = {
  fullName: string;
  wechatDisplayName: string;
  budgetMax: string;
  preferredAreas: string;
  followUpStatus: ClientFollowUpStatus;
  notes: string;
};

type LeadFieldKey = keyof LeadFormState;
type LeadFieldErrors = Partial<Record<LeadFieldKey, string>>;

type DuplicateMatch = {
  id: string;
  fullName: string;
  stage: string;
  sourceLabel: string;
  nextTouchLabel: string;
  confidenceLabel: string;
  matchStrength: number;
  href: string;
  matchReasons: string[];
  recommendedActionLabel: string;
};

type CreateLeadApiErrorCode =
  | "authentication_required"
  | "front_office_create_forbidden"
  | "invalid_request_body"
  | "validation_error"
  | "duplicate_lead"
  | "duplicate_check_failed"
  | "create_failed";

type CreateLeadApiPayload = {
  error?: string;
  errorCode?: CreateLeadApiErrorCode;
  fieldErrors?: LeadFieldErrors;
  duplicateMatches?: DuplicateMatch[];
  contact?: {
    id: string;
    fullName: string;
  };
};

type FrontOfficeLeadIntakeAssistServerResponse = {
  rawText: string;
  sourceMode: "text" | "image" | "hybrid";
  aiExtraction?: FrontOfficeLeadIntakeAiExtraction | null;
};

async function trackDashboardLeadCreated() {
  await fetch("/api/agent/dashboard/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actionKind: "quick_capture",
      eventType: "lead_created",
      sourceSurface: "agent_dashboard",
    }),
  }).catch(() => undefined);
}

const followUpStatusOptions = [
  {
    value: ClientFollowUpStatus.new_lead,
    label: "New lead",
  },
  {
    value: ClientFollowUpStatus.active_follow_up,
    label: "Active follow-up",
  },
  {
    value: ClientFollowUpStatus.waiting_reply,
    label: "Waiting reply",
  },
  {
    value: ClientFollowUpStatus.appointment_booked,
    label: "Appointment booked",
  },
  {
    value: ClientFollowUpStatus.paused,
    label: "Paused",
  },
] as const;

const supportedAssistFields = new Set([
  "fullName",
  "budgetMax",
  "preferredAreas",
  "notes",
  "stage",
  "intent",
  "source",
  "phone",
  "email",
  "nextFollowUpAt",
]);

const assistFieldLabelZh: Record<string, string> = {
  budgetMax: "预算上限",
  email: "邮箱",
  fullName: "姓名",
  intent: "意向",
  nextFollowUpAt: "下次跟进",
  notes: "备注",
  phone: "电话",
  preferredAreas: "目标区域",
  source: "来源",
  stage: "阶段",
};

const assistBadgeZh: Record<string, string> = {
  "High confidence": "高置信度",
  "Low confidence": "低置信度",
  "Medium confidence": "中等置信度",
};

const assistSourceModeZh: Record<FrontOfficeLeadIntakeAssistServerResponse["sourceMode"], string> = {
  hybrid: "文本 + 图片",
  image: "图片",
  text: "文本",
};

function translateAssistFieldLabel(field: FrontOfficeLeadIntakeAssistField, isZh: boolean) {
  if (!isZh) {
    return field.label;
  }

  return assistFieldLabelZh[field.field] ?? field.label;
}

function buildEmptyFormState(): LeadFormState {
  return {
    fullName: "",
    wechatDisplayName: "",
    budgetMax: "",
    preferredAreas: "",
    followUpStatus: ClientFollowUpStatus.new_lead,
    notes: "",
  };
}

function normalizeCompactValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function inferFollowUpStatusFromStage(
  value: string | undefined,
): ClientFollowUpStatus {
  const normalized = value?.trim().toLowerCase() || "";

  if (
    normalized.includes("viewing") ||
    normalized.includes("showing") ||
    normalized.includes("tour") ||
    normalized.includes("appointment")
  ) {
    return ClientFollowUpStatus.appointment_booked;
  }

  if (normalized.includes("pending") || normalized.includes("reply")) {
    return ClientFollowUpStatus.waiting_reply;
  }

  if (normalized.includes("won") || normalized.includes("lost")) {
    return ClientFollowUpStatus.paused;
  }

  if (
    normalized.includes("contacted") ||
    normalized.includes("follow-up") ||
    normalized.includes("warm")
  ) {
    return ClientFollowUpStatus.active_follow_up;
  }

  return ClientFollowUpStatus.new_lead;
}

function buildNoteDraft(input: {
  assistResult: FrontOfficeLeadIntakeAssistResult;
  rawText: string;
}) {
  const draft = input.assistResult.draft;
  const labels = [
    draft.source ? `Source: ${draft.source}` : null,
    draft.intent ? `Intent: ${draft.intent}` : null,
    draft.stage ? `Stage signal: ${draft.stage}` : null,
    draft.phone ? `Phone: ${draft.phone}` : null,
    draft.email ? `Email: ${draft.email}` : null,
    draft.nextFollowUpAt
      ? `Suggested next reminder: ${draft.nextFollowUpAt}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const baseNote = draft.notes?.trim() || "";
  const captureSummary = labels.join("\n");

  if (baseNote && captureSummary) {
    return `${baseNote}\n\n${captureSummary}`.trim();
  }

  if (baseNote) {
    return baseNote;
  }

  if (captureSummary) {
    return captureSummary;
  }

  return input.rawText.trim();
}

function getAssistFieldTone(field: FrontOfficeLeadIntakeAssistField) {
  if (field.suggestedAction === "preview_only") {
    return "warning" as const;
  }

  return field.confidence === "high"
    ? ("success" as const)
    : field.confidence === "medium"
      ? ("accent" as const)
      : ("warning" as const);
}

export function FrontOfficeLeadIntakeCard(
  props: FrontOfficeLeadIntakeCardProps,
) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const density = props.density ?? "default";
  const dashboardCompact = props.dashboardCompact ?? false;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<LeadFormState>(buildEmptyFormState);
  const [fieldErrors, setFieldErrors] = useState<LeadFieldErrors>({});
  const [feedback, setFeedback] = useState("");
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [assistTranscript, setAssistTranscript] = useState("");
  const [assistImage, setAssistImage] = useState<File | null>(null);
  const [assistResult, setAssistResult] =
    useState<FrontOfficeLeadIntakeAssistResult | null>(null);
  const [assistRawText, setAssistRawText] = useState("");
  const [assistServerMeta, setAssistServerMeta] =
    useState<FrontOfficeLeadIntakeAssistServerResponse | null>(null);
  const [assistContactSignals, setAssistContactSignals] = useState({
    email: "",
    phone: "",
    source: "",
  });

  const duplicatePreviewMatches = useMemo(
    () =>
      buildFrontOfficeLeadDuplicatePreview({
        candidates: props.initialDuplicatePreviewCandidates ?? [],
        needles: [
          {
            fullName:
              formState.wechatDisplayName.trim() || formState.fullName.trim(),
            sourceLabel: isZh ? "当前录入" : "Current intake",
            preferredAreas: formState.preferredAreas,
            source: assistContactSignals.source,
            email: assistContactSignals.email,
            phone: assistContactSignals.phone,
          },
        ],
      }),
    [
      assistContactSignals.email,
      assistContactSignals.phone,
      assistContactSignals.source,
      formState.fullName,
      formState.preferredAreas,
      formState.wechatDisplayName,
      isZh,
      props.initialDuplicatePreviewCandidates,
    ],
  );

  function updateField<TKey extends LeadFieldKey>(
    key: TKey,
    value: LeadFormState[TKey],
  ) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
    setFieldErrors((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  function resetForm() {
    setFormState(buildEmptyFormState());
    setFieldErrors({});
    setDuplicateMatches([]);
    setFeedback("");
  }

  function resetAssist() {
    setAssistTranscript("");
    setAssistImage(null);
    setAssistResult(null);
    setAssistRawText("");
    setAssistServerMeta(null);
    setAssistContactSignals({
      email: "",
      phone: "",
      source: "",
    });
  }

  async function handleAssistSubmit() {
    if (!assistTranscript.trim() && !assistImage) {
      setFeedback(isZh ? "请先添加聊天文本或一张截图。" : "Add a transcript or one screenshot first.");
      return;
    }

    setFeedback("");

    const formData = new FormData();
    formData.set("transcript", assistTranscript);
    formData.set("sourceSurface", props.sourceSurface);

    if (assistImage) {
      formData.set("image", assistImage);
    }

    startTransition(async () => {
      const response = await fetch("/api/agent/clients/intake-assist", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setFeedback(
          payload?.error ||
            (isZh
              ? "无法从当前录入内容中提取线索信息。"
              : "Could not extract lead details from the current intake source."),
        );
        return;
      }

      const payload =
        (await response.json()) as FrontOfficeLeadIntakeAssistServerResponse;
      const nextAssistResult = extractFrontOfficeLeadIntakeAssist({
        rawText: payload.rawText,
        sourceMode: payload.sourceMode,
        prefilledFields: payload.aiExtraction?.fields,
      });

      setAssistResult(nextAssistResult);
      setAssistRawText(payload.rawText);
      setAssistServerMeta(payload);
      setAssistContactSignals({
        email: nextAssistResult.draft.email?.trim() || "",
        phone: nextAssistResult.draft.phone?.trim() || "",
        source: nextAssistResult.draft.source?.trim() || "",
      });
      setFeedback(
        isZh
          ? "AI 录入已准备好。请先检查，再应用草稿。"
          : "AI capture is ready. Review it, then apply the draft.",
      );
    });
  }

  function applyAssistDraft() {
    if (!assistResult) {
      return;
    }

    const nextName = assistResult.draft.fullName?.trim() || "";
    const nextSource = assistResult.draft.source?.trim() || "";
    const nextWechatDisplayName =
      !dashboardCompact && nextSource.toLowerCase().includes("wechat") && nextName
        ? nextName
        : "";

    setFormState((current) => ({
      ...current,
      fullName: nextName || current.fullName,
      wechatDisplayName: nextWechatDisplayName || current.wechatDisplayName,
      budgetMax: assistResult.draft.budgetMax?.trim() || current.budgetMax,
      preferredAreas:
        assistResult.draft.preferredAreas?.trim() || current.preferredAreas,
      followUpStatus: inferFollowUpStatusFromStage(assistResult.draft.stage),
      notes: buildNoteDraft({
        assistResult,
        rawText: assistRawText,
      }),
    }));
    setFeedback(
      isZh
        ? "AI 草稿已应用。保存前每个字段都可以继续编辑。"
        : "AI draft applied. You can edit every field before saving.",
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback("");
    setDuplicateMatches([]);

    startTransition(async () => {
      const response = await fetch("/api/agent/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: formState.fullName,
          ...(dashboardCompact
            ? {}
            : { wechatDisplayName: formState.wechatDisplayName }),
          budgetMax: formState.budgetMax,
          preferredAreas: formState.preferredAreas,
          followUpStatus: formState.followUpStatus,
          notes: formState.notes,
        }),
      });

      const payload =
        (await response.json().catch(() => null)) as CreateLeadApiPayload | null;

      if (!response.ok) {
        setFieldErrors(payload?.fieldErrors ?? {});
        setDuplicateMatches(payload?.duplicateMatches ?? []);
        setFeedback(payload?.error || (isZh ? "无法创建客户。" : "Could not create the client."));
        return;
      }

      if (props.sourceSurface === "dashboard") {
        await trackDashboardLeadCreated();
      }

      resetForm();
      resetAssist();
      router.refresh();
      setFeedback(
        payload?.contact
          ? `${isZh ? "客户已创建：" : "Client created: "}${payload.contact.fullName}`
          : isZh
            ? "客户已创建。"
            : "Client created.",
      );
    });
  }

  return (
    <SectionCard
      className={`office-list-card front-office-lead-intake-card ${
        density === "compact" ? "is-compact" : ""
      } ${dashboardCompact ? "is-dashboard-compact" : ""}`}
      subtitle={
        props.subtitle ??
        (isZh
          ? "不用打开更重的后台表单，也能快速记录新线索。"
          : "Capture the next live lead without opening a heavier backend form.")
      }
      title={props.title ?? (isZh ? "快速录入" : "Quick intake")}
    >
      <form className="front-office-calendar-form" onSubmit={handleSubmit}>
        <SectionCard
          className="office-list-card"
          subtitle={
            dashboardCompact
              ? isZh
                ? "粘贴聊天文本或上传一张截图。Acre 只把姓名、预算、目标区域和跟进状态保留为结构化字段；其他信息进入备注。"
                : "Paste chat text or upload one screenshot. Acre keeps only Name, Budget, Target Area, and Follow-up Status as structured fields; everything else goes into Note."
              : isZh
                ? "粘贴一小段聊天或上传一张截图。AI 只保留四个结构化字段，其余信息移入备注。"
                : "Paste a short transcript or upload one screenshot. AI will only keep the four structured fields and move everything else into Note."
          }
          title={dashboardCompact ? (isZh ? "粘贴聊天或截图" : "Paste chat or screenshot") : isZh ? "AI 录入" : "AI capture"}
        >
          <div className="office-form-grid">
            <FormField
              className="office-form-grid-span-2"
              helper={assistImage ? `${isZh ? "已选择截图：" : "Selected screenshot: "}${assistImage.name}` : undefined}
              label={isZh ? "截图" : "Screenshot"}
            >
              <input
                accept="image/*"
                className="front-office-lead-intake-file-input"
                disabled={isPending}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setAssistImage(event.target.files?.[0] ?? null);
                }}
                type="file"
              />
            </FormField>

            <FormField
              className="office-form-grid-span-3"
              label={isZh ? "聊天文本" : "Transcript / chat text"}
            >
              <TextareaInput
                disabled={isPending}
                onChange={(event) => {
                  setAssistTranscript(event.target.value);
                }}
                placeholder={
                  isZh
                    ? "微信买家。姓名 Annie Chen。想看 LIC 或 Astoria。预算最高 6500..."
                    : "Buyer from WeChat. Name Annie Chen. Wants LIC or Astoria. Budget up to 6500..."
                }
                rows={4}
                value={assistTranscript}
              />
            </FormField>
          </div>

          <div className="office-queue-meta">
            <Button
              disabled={isPending || (!assistTranscript.trim() && !assistImage)}
              onClick={() => {
                void handleAssistSubmit();
              }}
              type="button"
            >
              {isPending ? (isZh ? "分析中..." : "Analyzing...") : isZh ? "运行 AI 录入" : "Run AI capture"}
            </Button>
            <Button
              disabled={isPending}
              onClick={resetAssist}
              type="button"
              variant="secondary"
            >
              {isZh ? "清空来源" : "Clear source"}
            </Button>
          </div>

          {assistResult ? (
            <div className="office-queue-list">
              {assistResult.fields
                .filter((field) => supportedAssistFields.has(field.field))
                .slice(0, 6)
                .map((field) => (
                  <QueueAssistField field={field} isZh={isZh} key={field.field} />
                ))}

              <div className="office-queue-meta">
                <Button
                  disabled={isPending}
                  onClick={applyAssistDraft}
                  type="button"
                  variant="secondary"
                >
                  {isZh ? "应用草稿到表单" : "Apply draft to form"}
                </Button>
                {assistServerMeta?.rawText ? (
                  <StatusBadge tone="accent">
                    {isZh ? "来源模式：" : "Source mode: "}
                    {isZh ? assistSourceModeZh[assistServerMeta.sourceMode] : assistServerMeta.sourceMode}
                  </StatusBadge>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyState
              description={
                isZh
                  ? "AI 录入是可选的。如果直接填写更快，也可以手动输入。"
                  : "AI capture stays optional. You can still type the form directly if that is faster."
              }
              title={isZh ? "还没有 AI 草稿" : "No AI draft yet"}
            />
          )}
        </SectionCard>

        {(duplicatePreviewMatches.length || duplicateMatches.length) && (
          <SectionCard
            className="office-list-card"
            subtitle={isZh ? "保存第二个客户前，先检查这些记录。" : "Review these records before saving a second client."}
            title={isZh ? "可能重复" : "Possible duplicate"}
          >
            <div className="office-queue-list">
              {[...duplicateMatches, ...duplicatePreviewMatches]
                .slice(0, 4)
                .map((match) => (
                  <QueueItem
                    badge={
                      <StatusBadge
                        tone={match.matchStrength >= 4 ? "warning" : "accent"}
                      >
                        {match.confidenceLabel}
                      </StatusBadge>
                    }
                    description={`${match.stage} · ${match.sourceLabel}`}
                    key={match.id}
                    meta={
                      <>
                        <span>{match.matchReasons.join(" · ")}</span>
                        <span>{match.nextTouchLabel}</span>
                      </>
                    }
                    action={
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={match.href}
                      >
                        {isZh ? "检查记录" : "Review record"}
                      </FrontOfficeLink>
                    }
                    title={match.fullName}
                  />
                ))}
            </div>
          </SectionCard>
        )}

        <div className="office-form-grid">
          <FormField
            className="office-form-grid-span-2"
            helper={fieldErrors.fullName}
            label={isZh ? "姓名" : "Name"}
          >
            <TextInput
              aria-invalid={Boolean(fieldErrors.fullName)}
              onChange={(event) => {
                updateField("fullName", event.target.value);
              }}
              placeholder="Annie Chen"
              required
              value={formState.fullName}
            />
          </FormField>

          {!dashboardCompact ? (
            <FormField helper={fieldErrors.wechatDisplayName} label={isZh ? "微信名" : "WeChat name"}>
              <TextInput
                aria-invalid={Boolean(fieldErrors.wechatDisplayName)}
                onChange={(event) => {
                  updateField("wechatDisplayName", event.target.value);
                }}
                placeholder={isZh ? "选填" : "Optional"}
                value={formState.wechatDisplayName}
              />
            </FormField>
          ) : null}

          <FormField helper={fieldErrors.budgetMax} label={isZh ? "预算" : "Budget"}>
            <TextInput
              aria-invalid={Boolean(fieldErrors.budgetMax)}
              onChange={(event) => {
                updateField("budgetMax", event.target.value);
              }}
              placeholder="6500"
              value={formState.budgetMax}
            />
          </FormField>

          <FormField
            className="office-form-grid-span-2"
            helper={fieldErrors.preferredAreas}
            label={isZh ? "目标区域" : "Target area"}
          >
            <TextInput
              aria-invalid={Boolean(fieldErrors.preferredAreas)}
              onChange={(event) => {
                updateField("preferredAreas", event.target.value);
              }}
              placeholder="LIC, Astoria"
              value={formState.preferredAreas}
            />
          </FormField>

          <FormField helper={fieldErrors.followUpStatus} label={isZh ? "跟进状态" : "Follow-up status"}>
            <SelectInput
              aria-invalid={Boolean(fieldErrors.followUpStatus)}
              onChange={(event) => {
                updateField(
                  "followUpStatus",
                  event.target.value as ClientFollowUpStatus,
                );
              }}
              value={formState.followUpStatus}
            >
              {followUpStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {translateFrontOfficeLabel(option.label, isZh)}
                </option>
              ))}
            </SelectInput>
          </FormField>

          <FormField
            className="office-form-grid-span-4"
            helper={fieldErrors.notes}
            label={isZh ? "备注" : "Note"}
          >
            <TextareaInput
              aria-invalid={Boolean(fieldErrors.notes)}
              onChange={(event) => {
                updateField("notes", event.target.value);
              }}
              rows={8}
              value={formState.notes}
            />
          </FormField>
        </div>

        <div className="office-queue-meta">
          <Button disabled={isPending} type="submit">
            {isPending ? (isZh ? "保存中..." : "Saving...") : isZh ? "创建客户" : "Create client"}
          </Button>
          <Button
            disabled={isPending}
            onClick={resetForm}
            type="button"
            variant="secondary"
          >
            {isZh ? "重置" : "Reset"}
          </Button>
        </div>

        {feedback ? <p>{feedback}</p> : null}
      </form>
    </SectionCard>
  );
}

function QueueAssistField(props: {
  field: FrontOfficeLeadIntakeAssistField;
  isZh: boolean;
}) {
  return (
    <QueueItem
      badge={
        <StatusBadge tone={getAssistFieldTone(props.field)}>
          {props.isZh ? assistBadgeZh[props.field.confidenceLabel] ?? props.field.confidenceLabel : props.field.confidenceLabel}
        </StatusBadge>
      }
      description={props.field.reasonLabel}
      meta={
        <>
          <span>{props.field.value}</span>
          <span>{props.field.evidenceLabel}</span>
        </>
      }
      title={translateAssistFieldLabel(props.field, props.isZh)}
    />
  );
}
