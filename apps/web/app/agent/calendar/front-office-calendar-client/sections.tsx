import type { ReactNode } from "react";
import type {
  FrontOfficeAppointmentBridgeAction,
  FrontOfficeAppointmentExternalWorkflowStatus,
} from "@acre/db";
import {
  Badge,
  Button,
  EmptyState,
  QueueItem,
  SectionCard,
  SelectInput,
  StatusBadge,
  TextInput,
  TextareaInput,
} from "@acre/ui";
import { FrontOfficeLink } from "../../_components/front-office-link";
import type {
  AgendaSection,
  AppointmentCue,
  AppointmentWritebackDraft,
  BridgeOutcomeState,
  FeedbackState,
  FocusState,
  FrontOfficeCalendarClientProps,
} from "./types";

type AppointmentRecord =
  FrontOfficeCalendarClientProps["snapshot"]["appointments"][number];
type TouchPreset = AppointmentRecord["touchPresets"][number];
type BridgeState = {
  appointmentId: string;
  action: FrontOfficeAppointmentBridgeAction;
} | null;

type FocusAppointmentCardProps = {
  isZh: boolean;
  isBusy: boolean;
  hasQueueFilters: boolean;
  selectedClientLabel: string;
  returnToLabel: string;
  filterReturnTo: string;
  focusMode: FocusState["mode"];
  focusedAppointment: AppointmentRecord | null;
  focusedCueList: AppointmentCue[];
  focusedWritebackDraft: AppointmentWritebackDraft | null;
  latestBridgeHistory: AppointmentRecord["bridgeHistory"][number] | null;
  latestWritebackHistory: AppointmentRecord["writebackHistory"][number] | null;
  bridgeState: BridgeState;
  bridgeOutcome: BridgeOutcomeState | null;
  feedback: FeedbackState;
  canSaveFocusedWriteback: boolean;
  externalStatusOptions: Array<{
    value: FrontOfficeAppointmentExternalWorkflowStatus;
    label: string;
  }>;
  buildContextAwareHref: (href: string, appointmentId: string) => string;
  clearFocusLock: () => void;
  clearQueueFilters: () => void;
  scrollToScheduleForm: () => void;
  scrollToWritebackSection: () => void;
  loadSuggestedBridgeWriteback: (
    appointment: AppointmentRecord,
    suggestion: NonNullable<BridgeOutcomeState["suggestedWriteback"]>,
  ) => void;
  handleBridgeAction: (
    appointment: AppointmentRecord,
    action: FrontOfficeAppointmentBridgeAction,
  ) => void;
  handleQuickWritebackAction: (
    appointment: AppointmentRecord,
    status: FrontOfficeAppointmentExternalWorkflowStatus,
  ) => void;
  handleTouchPresetSave: (
    appointment: AppointmentRecord,
    preset: TouchPreset,
  ) => void;
  applyTouchPresetDraft: (
    appointment: AppointmentRecord,
    preset: TouchPreset,
  ) => void;
  handleWritebackDraftChange: (
    appointment: AppointmentRecord,
    field: "status" | "nextActionAt" | "note",
    value: string,
  ) => void;
  handleExternalStatusUpdate: (appointment: AppointmentRecord) => void;
  handleStatusUpdate: (
    appointmentId: string,
    status: "completed" | "no_show" | "canceled",
  ) => void;
};

export function FocusAppointmentCard(props: FocusAppointmentCardProps) {
  const {
    isZh,
    isBusy,
    hasQueueFilters,
    selectedClientLabel,
    returnToLabel,
    filterReturnTo,
    focusMode,
    focusedAppointment,
    focusedCueList,
    focusedWritebackDraft,
    latestBridgeHistory,
    latestWritebackHistory,
    bridgeState,
    bridgeOutcome,
    canSaveFocusedWriteback,
    externalStatusOptions,
    buildContextAwareHref,
    clearFocusLock,
    clearQueueFilters,
    scrollToScheduleForm,
    scrollToWritebackSection,
    loadSuggestedBridgeWriteback,
    handleBridgeAction,
    handleQuickWritebackAction,
    handleTouchPresetSave,
    applyTouchPresetDraft,
    handleWritebackDraftChange,
    handleExternalStatusUpdate,
    handleStatusUpdate,
  } = props;

  return (
    <SectionCard
      className="office-list-card"
      subtitle={
        isZh
          ? "在这个焦点面板里查看外部草稿、更新下一步状态，并让承诺中的下一次触达保持清晰可见。"
          : "Use the focused panel to review external drafts, update the next step, and keep the promised follow-up clearly visible."
      }
      title={isZh ? "焦点预约" : "Focus appointment"}
    >
      {focusedAppointment ? (
        <>
          <article className="list-row front-office-record tone-accent">
            <div className="list-row-top front-office-record-head">
              <div>
                <strong>{focusedAppointment.title}</strong>
                <p>{focusedAppointment.startsAtLabel}</p>
              </div>
              <div className="front-office-calendar-badges">
                <Badge tone={focusedAppointment.typeTone}>
                  {focusedAppointment.typeLabel}
                </Badge>
                <StatusBadge tone={focusedAppointment.statusTone}>
                  {focusedAppointment.statusLabel}
                </StatusBadge>
                <Badge tone={focusedAppointment.reminderTone}>
                  {focusedAppointment.reminderLabel}
                </Badge>
                <StatusBadge tone={focusedAppointment.externalStatusTone}>
                  {focusedAppointment.externalStatusLabel}
                </StatusBadge>
                <StatusBadge tone={focusedAppointment.coordinationTone}>
                  {focusedAppointment.coordinationLabel}
                </StatusBadge>
                <Badge tone={focusedAppointment.calendarLaneTone}>
                  {focusedAppointment.calendarLaneLabel}
                </Badge>
                <Badge tone={focusedAppointment.nextTouchPressureTone}>
                  {focusedAppointment.nextTouchPressureLabel}
                </Badge>
              </div>
            </div>

            <div className="list-row-meta front-office-record-meta">
              <span>
                {isZh
                  ? `结束 ${focusedAppointment.endsAtLabel}`
                  : `Ends ${focusedAppointment.endsAtLabel}`}
              </span>
              <span>{focusedAppointment.clientLabel}</span>
              <span>{focusedAppointment.clientEmailLabel}</span>
              <span>{focusedAppointment.contactLabel}</span>
              <span>{focusedAppointment.listingLabel}</span>
              <span>{focusedAppointment.locationLabel}</span>
              <span>{focusedAppointment.bridgeLoggedAtLabel}</span>
            </div>

            <p>{focusedAppointment.notesLabel}</p>
            <p className="front-office-record-supporting">
              {focusedAppointment.calendarLaneDetail}
            </p>
            <p className="front-office-record-supporting">
              {isZh ? "下一步：" : "Next move: "}
              {focusedAppointment.coordinationNextStep}
            </p>
            {focusedCueList.length ? (
              <div className="front-office-calendar-badges">
                {focusedCueList.map((cue) => (
                  <Badge
                    key={`${focusedAppointment.id}-${cue.label}`}
                    tone={cue.tone}
                  >
                    {cue.label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </article>

          <div className="office-queue-list">
            <QueueItem
              badgeLabel={focusedAppointment.calendarLaneLabel}
              badgeTone={focusedAppointment.calendarLaneTone}
              description={focusedAppointment.calendarLaneDetail}
              meta={
                <>
                  <span>{focusedAppointment.bridgeStatusLabel}</span>
                  <span>{focusedAppointment.latestCoordinationDetail}</span>
                </>
              }
              title={isZh ? "协调状态" : "Coordination status"}
            />
            <QueueItem
              badgeLabel={focusedAppointment.nextTouchPressureLabel}
              badgeTone={focusedAppointment.nextTouchPressureTone}
              description={focusedAppointment.nextTouchPressureDetail}
              meta={
                <>
                  <span>{focusedAppointment.externalNextActionAtLabel}</span>
                  <span>
                    {isZh ? "下一步：" : "Next move: "}
                    {focusedAppointment.coordinationNextStep}
                  </span>
                </>
              }
              title={isZh ? "下一步状态" : "Next step status"}
            />
          </div>

          <div className="front-office-calendar-actions">
            {focusedAppointment.clientHref ? (
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href={buildContextAwareHref(
                  focusedAppointment.clientHref,
                  focusedAppointment.id,
                )}
              >
                {isZh ? "打开客户页" : "Open client page"}
              </FrontOfficeLink>
            ) : null}
            {focusedAppointment.listingOutputHref ? (
              <FrontOfficeLink
                className="office-inline-link front-office-inline-link"
                href={buildContextAwareHref(
                  focusedAppointment.listingOutputHref,
                  focusedAppointment.id,
                )}
              >
                {isZh ? "打开房源输出" : "Open listing output"}
              </FrontOfficeLink>
            ) : null}
            {focusedAppointment.statusValue === "scheduled" ? (
              <>
                <button
                  className="office-button-secondary office-inline-action-sm"
                  disabled={bridgeState?.appointmentId === focusedAppointment.id}
                  onClick={() =>
                    handleBridgeAction(focusedAppointment, "google_calendar")
                  }
                  type="button"
                >
                  {bridgeState?.appointmentId === focusedAppointment.id &&
                  bridgeState.action === "google_calendar"
                    ? "Opening..."
                    : isZh
                      ? "打开 Google 草稿"
                      : "Open Google draft"}
                </button>
                <button
                  className="office-button-secondary office-inline-action-sm"
                  disabled={bridgeState?.appointmentId === focusedAppointment.id}
                  onClick={() =>
                    handleBridgeAction(focusedAppointment, "outlook_calendar")
                  }
                  type="button"
                >
                  {bridgeState?.appointmentId === focusedAppointment.id &&
                  bridgeState.action === "outlook_calendar"
                    ? "Opening..."
                    : isZh
                      ? "打开 Outlook 草稿"
                      : "Open Outlook draft"}
                </button>
                <button
                  className="office-button-secondary office-inline-action-sm"
                  disabled={bridgeState?.appointmentId === focusedAppointment.id}
                  onClick={() =>
                    handleBridgeAction(focusedAppointment, "ics_download")
                  }
                  type="button"
                >
                  {bridgeState?.appointmentId === focusedAppointment.id &&
                  bridgeState.action === "ics_download"
                    ? "Preparing..."
                    : isZh
                      ? "下载 ICS"
                      : "Download ICS"}
                </button>
                {focusedAppointment.emailBriefHref ? (
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={
                      bridgeState?.appointmentId === focusedAppointment.id
                    }
                    onClick={() =>
                      handleBridgeAction(focusedAppointment, "email_brief")
                    }
                    type="button"
                  >
                    {bridgeState?.appointmentId === focusedAppointment.id &&
                    bridgeState.action === "email_brief"
                      ? "Opening..."
                      : isZh
                        ? "打开 Acre 邮件草稿"
                        : "Open Acre email draft"}
                  </button>
                ) : (
                  <p className="front-office-record-supporting">
                    {isZh
                      ? "这条预约还没有保存邮件目标，因此 Acre 邮件草稿暂时不可用。"
                      : "No email target is saved on this appointment yet, so the Acre email draft is not available."}
                  </p>
                )}
              </>
            ) : null}
            {filterReturnTo ? (
              <FrontOfficeLink
                className="office-button-secondary office-inline-action-sm"
                href={filterReturnTo}
              >
                {returnToLabel}
              </FrontOfficeLink>
            ) : null}
            {focusMode === "locked_in_queue" ? (
              <Button
                disabled={isBusy}
                onClick={clearFocusLock}
                size="sm"
                variant="secondary"
              >
                {isZh ? "取消固定预约" : "Clear pinned appointment"}
              </Button>
            ) : null}
          </div>

          {bridgeOutcome &&
          bridgeOutcome.appointmentId === focusedAppointment.id ? (
            <QueueItem
              action={
                <div className="front-office-calendar-actions">
                  <Button
                    disabled={isBusy}
                    onClick={scrollToWritebackSection}
                    size="sm"
                    variant="secondary"
                  >
                    {isZh ? "跳到更新表单" : "Jump to update form"}
                  </Button>
                  {bridgeOutcome.suggestedWriteback ? (
                    <Button
                      disabled={isBusy}
                      onClick={() => {
                        const suggestedWriteback =
                          bridgeOutcome.suggestedWriteback;
                        if (!suggestedWriteback) {
                          return;
                        }
                        loadSuggestedBridgeWriteback(
                          focusedAppointment,
                          suggestedWriteback,
                        );
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      {isZh ? "载入建议下一步" : "Load suggested next step"}
                    </Button>
                  ) : null}
                </div>
              }
              badgeLabel={
                bridgeOutcome.continuity?.label ??
                bridgeOutcome.checkpoint.label ??
                bridgeOutcome.followUpCadenceLabel ??
                bridgeOutcome.suggestedWriteback?.label ??
                bridgeOutcome.actionLabel
              }
              badgeTone={
                bridgeOutcome.resultKind === "calendar_export"
                  ? "accent"
                  : "warning"
              }
              description={
                bridgeOutcome.continuity?.detail ??
                bridgeOutcome.checkpoint.detail
              }
              meta={
                <>
                  <span>
                    {bridgeOutcome.continuity?.sourceNote ??
                      bridgeOutcome.checkpoint.sourceNote}
                  </span>
                  <span>
                    {isZh ? "下一步：" : "Next move: "}
                    {bridgeOutcome.continuity?.nextStep ??
                      bridgeOutcome.checkpoint.nextStep}
                  </span>
                </>
              }
              title={isZh ? "最新草稿动作" : "Latest draft action"}
            />
          ) : null}

          {focusedAppointment.statusValue === "scheduled" ? (
            <>
              <div
                className="front-office-calendar-writeback"
                id="calendar-writeback-section"
              >
                <div className="front-office-calendar-writeback-head">
                  <span className="front-office-calendar-writeback-label">
                    {isZh ? "下一步状态" : "Next step status"}
                  </span>
                  <div className="front-office-calendar-badges">
                    <StatusBadge tone={focusedAppointment.coordinationTone}>
                      {focusedAppointment.coordinationLabel}
                    </StatusBadge>
                    <Badge tone={focusedAppointment.bridgeStatusTone}>
                      {focusedAppointment.bridgeStatusLabel}
                    </Badge>
                  </div>
                </div>
                <div className="front-office-calendar-writeback-fields">
                  <SelectInput
                    className="front-office-calendar-writeback-select"
                    onChange={(event) =>
                      handleWritebackDraftChange(
                        focusedAppointment,
                        "status",
                        event.target.value,
                      )
                    }
                    value={focusedWritebackDraft?.status ?? "idle"}
                  >
                    {externalStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                  <TextInput
                    className="front-office-calendar-writeback-next-touch"
                    disabled={focusedWritebackDraft?.status === "idle"}
                    onChange={(event) =>
                      handleWritebackDraftChange(
                        focusedAppointment,
                        "nextActionAt",
                        event.target.value,
                      )
                    }
                    placeholder={
                      isZh ? "下一次外部联系" : "Next external touch"
                    }
                    type="datetime-local"
                    value={focusedWritebackDraft?.nextActionAt ?? ""}
                  />
                  <TextareaInput
                    className="front-office-calendar-writeback-note"
                    disabled={focusedWritebackDraft?.status === "idle"}
                    onChange={(event) =>
                      handleWritebackDraftChange(
                        focusedAppointment,
                        "note",
                        event.target.value,
                      )
                    }
                    placeholder={
                      isZh
                        ? "Acre 外部刚发生了什么，接下来你还在等什么？"
                        : "What happened outside Acre, and what are you waiting on next?"
                    }
                    rows={2}
                    value={focusedWritebackDraft?.note ?? ""}
                  />
                  <div className="front-office-calendar-actions">
                    {focusedAppointment.touchPresets.map((preset) => (
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={isBusy}
                        key={`${focusedAppointment.id}-draft-${preset.id}`}
                        onClick={() =>
                          applyTouchPresetDraft(focusedAppointment, preset)
                        }
                        title={`${preset.detail} Loaded for ${preset.nextActionAtLabel}.`}
                        type="button"
                      >
                        {isZh ? "载入" : "Load"} {preset.label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={isBusy || !canSaveFocusedWriteback}
                    onClick={() =>
                      handleExternalStatusUpdate(focusedAppointment)
                    }
                    type="button"
                  >
                    {isZh ? "保存更新" : "Save update"}
                  </button>
                </div>
              </div>

              <div className="front-office-calendar-actions">
                {focusedAppointment.statusValue === "scheduled" &&
                focusedAppointment.externalStatusValue !== "confirmed" ? (
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={isBusy}
                    onClick={() =>
                      handleQuickWritebackAction(focusedAppointment, "confirmed")
                    }
                    type="button"
                  >
                    {isZh ? "在 Acre 中确认" : "Confirm in Acre"}
                  </button>
                ) : null}
                {focusedAppointment.statusValue === "scheduled" &&
                focusedAppointment.touchPresets[0] ? (
                  <button
                    className="office-button-secondary office-inline-action-sm"
                    disabled={isBusy}
                    onClick={() =>
                      handleTouchPresetSave(
                        focusedAppointment,
                        focusedAppointment.touchPresets[0],
                      )
                    }
                    title={`${focusedAppointment.touchPresets[0].detail} Saved for ${focusedAppointment.touchPresets[0].nextActionAtLabel}.`}
                    type="button"
                  >
                    {focusedAppointment.touchPresets[0].label}
                  </button>
                ) : null}
                <button
                  className="office-button-secondary office-inline-action-sm"
                  disabled={isBusy}
                  onClick={() =>
                    handleStatusUpdate(focusedAppointment.id, "completed")
                  }
                  type="button"
                >
                  {isZh ? "标记完成" : "Mark complete"}
                </button>
                <button
                  className="office-button-secondary office-inline-action-sm"
                  disabled={isBusy}
                  onClick={() =>
                    handleStatusUpdate(focusedAppointment.id, "no_show")
                  }
                  type="button"
                >
                  {isZh ? "未到场" : "No-show"}
                </button>
                <button
                  className="office-button-secondary office-inline-action-sm"
                  disabled={isBusy}
                  onClick={() =>
                    handleStatusUpdate(focusedAppointment.id, "canceled")
                  }
                  type="button"
                >
                  {isZh ? "取消预约" : "Cancel"}
                </button>
              </div>
            </>
          ) : (
            <p className="front-office-record-supporting">
              {isZh
                ? "这条预约在 Acre 中已经不再处于已安排状态，因此除非你重新创建预约或在别处重新打开计划，否则这里的外部协调控件会保持只读。"
                : "This appointment is no longer scheduled in Acre, so the external coordination controls stay read-only here unless you create a new appointment or reopen the plan elsewhere."}
            </p>
          )}

          <div className="office-queue-list">
            <QueueItem
              badgeLabel={`${focusedAppointment.bridgeHistory.length}`}
              badgeTone={
                focusedAppointment.hasBridgeActivity ? "accent" : "neutral"
              }
              description={
                latestBridgeHistory
                  ? `${latestBridgeHistory.label} · ${latestBridgeHistory.detail}`
                  : isZh
                    ? "从 Acre 打开 Google、Outlook、ICS 或邮件简报来开始外部草稿；如果你有邮件权限，Acre 会先尝试准备邮件草稿，再回退到外部草稿。"
                    : "Open Google, Outlook, ICS, or the email brief from Acre to start an external draft; if you have mail access, Acre will try to prepare the email draft first and then fall back to the outside draft."
              }
              meta={
                latestBridgeHistory ? (
                  <>
                    <span>{latestBridgeHistory.actorLabel}</span>
                    <span>{latestBridgeHistory.createdAtLabel}</span>
                  </>
                ) : (
                  <span>{isZh ? "还没有草稿历史" : "No draft history yet"}</span>
                )
              }
              title={isZh ? "草稿历史" : "Draft history"}
            />
            <QueueItem
              badgeLabel={`${focusedAppointment.writebackHistory.length}`}
              badgeTone={
                focusedAppointment.hasWritebackHistory ? "success" : "neutral"
              }
              description={
                latestWritebackHistory
                  ? `${latestWritebackHistory.label} · ${latestWritebackHistory.detail}`
                  : isZh
                    ? "使用快捷动作或保存更新表单，来创建第一条协调历史记录。"
                    : "Use a quick action or save the update form to create the first coordination history entry."
              }
              meta={
                latestWritebackHistory ? (
                  <>
                    <span>{latestWritebackHistory.actorLabel}</span>
                    <span>{latestWritebackHistory.createdAtLabel}</span>
                  </>
                ) : (
                  <span>{isZh ? "还没有更新历史" : "No update history yet"}</span>
                )
              }
              title={isZh ? "更新历史" : "Update history"}
            />
          </div>

          <div>
            <div className="front-office-calendar-writeback-head">
              <span className="front-office-calendar-writeback-label">
                {isZh ? "协调时间线" : "Coordination timeline"}
              </span>
            </div>
            <div className="list-column front-office-record-list">
              {focusedAppointment.coordinationHistory.length ? (
                focusedAppointment.coordinationHistory.map((item) => (
                  <article
                    className="list-row front-office-record"
                    key={item.id}
                  >
                    <div className="list-row-top front-office-record-head">
                      <div>
                        <strong>{item.label}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <StatusBadge tone={item.tone}>
                        {item.kind === "bridge"
                          ? isZh
                            ? "草稿"
                            : "Draft"
                          : isZh
                            ? "更新"
                            : "Update"}
                      </StatusBadge>
                    </div>
                    <div className="list-row-meta front-office-record-meta">
                      <span>{item.actorLabel}</span>
                      <span>{item.createdAtLabel}</span>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  description={
                    isZh
                      ? "打开一次草稿，或保存一次更新，来为这条预约启动协调时间线。"
                      : "Open a draft or save an update to start the coordination timeline for this appointment."
                  }
                  title={isZh ? "还没有协调历史" : "No coordination history yet"}
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          action={
            <div className="front-office-calendar-actions">
              {focusMode === "missing" ? (
                <Button
                  disabled={isBusy}
                  onClick={clearFocusLock}
                  size="sm"
                  variant="secondary"
                >
                  {isZh ? "取消固定预约" : "Clear pinned appointment"}
                </Button>
              ) : null}
              {hasQueueFilters ? (
                <Button
                  disabled={isBusy}
                  onClick={clearQueueFilters}
                  size="sm"
                  variant="secondary"
                >
                  {isZh ? "清除队列筛选" : "Clear queue filters"}
                </Button>
              ) : null}
              <Button
                onClick={scrollToScheduleForm}
                size="sm"
                variant="secondary"
              >
                {isZh ? "跳到预约表单" : "Jump to schedule form"}
              </Button>
              {filterReturnTo ? (
                <FrontOfficeLink
                  className="office-button-secondary office-inline-action-sm"
                  href={filterReturnTo}
                >
                  {returnToLabel}
                </FrontOfficeLink>
              ) : null}
            </div>
          }
          description={
            focusMode === "missing"
              ? isZh
                ? "这个保存的链接仍然指向一条预约记录，但 Acre 已经无法在你当前可见的 Front Office 范围里解析它。取消固定预约，或退回来源页面。"
                : "This saved link still points to an appointment, but Acre can no longer resolve it in your visible Front Office scope. Clear the pinned appointment or step back to the source page."
              : selectedClientLabel
                ? isZh
                  ? `${selectedClientLabel} 当前没有焦点预约。可以使用上方表单在这个客户上下文里创建第一次带看、咨询或会面。`
                  : `No appointment is currently in focus for ${selectedClientLabel}. Use the schedule form above to create the first showing, consultation, or meeting in this client context.`
                : isZh
                  ? "从下面的队列里挑一条预约，或者如果这个切片还是空的，就用上方表单创建。"
                  : "Pick an appointment from the queue below, or use the schedule form above if this slice is still empty."
          }
          title={
            focusMode === "missing"
              ? isZh
                ? "无法解析当前焦点预约"
                : "Focused appointment could not be resolved"
              : selectedClientLabel
                ? isZh
                  ? `${selectedClientLabel} 当前没有焦点预约`
                  : `No focused appointment for ${selectedClientLabel}`
                : isZh
                  ? "当前没有焦点预约"
                  : "No focused appointment"
          }
        />
      )}
    </SectionCard>
  );
}

type AppointmentsQueueCardProps = {
  isZh: boolean;
  isBusy: boolean;
  hasQueueFilters: boolean;
  selectedClientLabel: string;
  returnToLabel: string;
  filterAppointmentId: string;
  filterReturnTo: string;
  focusMode: FocusState["mode"];
  agendaViewMode: "day" | "week" | null;
  appointmentCount: number;
  appointments: FrontOfficeCalendarClientProps["snapshot"]["appointments"];
  agendaSections: AgendaSection[];
  focusedAppointmentId: string | null;
  bridgeState: BridgeState;
  renderAgendaAppointmentRow: (
    appointment: AppointmentRecord,
    sectionLabel: string,
  ) => ReactNode;
  buildAppointmentCueList: (appointment: AppointmentRecord) => AppointmentCue[];
  buildAppointmentFocusHref: (
    appointmentId: string,
    calendarView?: "all" | "day" | "week" | "bridge_logged" | "writeback_pending",
  ) => string;
  buildContextAwareHref: (href: string, appointmentId: string) => string;
  clearQueueFilters: () => void;
  clearFocusLock: () => void;
  scrollToScheduleForm: () => void;
  handleBridgeAction: (
    appointment: AppointmentRecord,
    action: FrontOfficeAppointmentBridgeAction,
  ) => void;
  handleQuickWritebackAction: (
    appointment: AppointmentRecord,
    status: FrontOfficeAppointmentExternalWorkflowStatus,
  ) => void;
  handleTouchPresetSave: (
    appointment: AppointmentRecord,
    preset: TouchPreset,
  ) => void;
};

export function AppointmentsQueueCard(props: AppointmentsQueueCardProps) {
  const {
    isZh,
    isBusy,
    hasQueueFilters,
    selectedClientLabel,
    returnToLabel,
    filterAppointmentId,
    filterReturnTo,
    focusMode,
    agendaViewMode,
    appointmentCount,
    appointments,
    agendaSections,
    focusedAppointmentId,
    bridgeState,
    renderAgendaAppointmentRow,
    buildAppointmentCueList,
    buildAppointmentFocusHref,
    buildContextAwareHref,
    clearQueueFilters,
    clearFocusLock,
    scrollToScheduleForm,
    handleBridgeAction,
    handleQuickWritebackAction,
    handleTouchPresetSave,
  } = props;

  return (
    <SectionCard
      className="office-list-card"
      subtitle={
        agendaViewMode
          ? isZh
            ? `显示 ${appointmentCount} 条预约。`
            : `Showing ${appointmentCount} appointments.`
          : isZh
            ? `当前筛选下显示 ${appointmentCount} 条预约。`
            : `Showing ${appointmentCount} appointments in the current filtered view.`
      }
      title={
        agendaViewMode
          ? agendaViewMode === "day"
            ? isZh
              ? "日程"
              : "Day agenda"
            : isZh
              ? "周程"
              : "Week agenda"
          : isZh
            ? "即将到来的预约"
            : "Upcoming appointments"
      }
    >
      {agendaViewMode ? (
        <div className="front-office-calendar-agenda">
          <div className="front-office-calendar-agenda-sections">
            {agendaSections.map((section) => (
              <section
                className="front-office-calendar-agenda-section"
                key={section.dateKey}
              >
                <div className="front-office-calendar-writeback-head">
                  <span className="front-office-calendar-writeback-label">
                    {section.label}
                  </span>
                  <p className="front-office-record-supporting">
                    {section.appointments.length
                      ? isZh
                        ? `这一段有 ${section.appointments.length} 条预约按时间排列。`
                        : `${section.appointments.length} appointments are ordered by time in this section.`
                      : isZh
                        ? "这一段目前没有预约。"
                        : "No appointments fall into this section yet."}
                  </p>
                </div>
                {section.appointments.length ? (
                  <div className="list-column front-office-record-list">
                    {section.appointments.map((appointment) =>
                      renderAgendaAppointmentRow(appointment, section.label),
                    )}
                  </div>
                ) : (
                  <EmptyState
                    description={
                      isZh
                        ? "这个时间段里还没有预约。"
                        : "There are no appointments in this time slot yet."
                    }
                    title={isZh ? "空时间段" : "Empty time slot"}
                  />
                )}
              </section>
            ))}
          </div>
        </div>
      ) : (
        <div className="list-column front-office-record-list">
          {appointments.length ? (
            appointments.map((appointment) => {
              const isFocused = focusedAppointmentId === appointment.id;
              const appointmentCueList = buildAppointmentCueList(appointment);

              return (
                <article
                  className={`list-row front-office-record${isFocused ? " tone-accent" : ""}`}
                  key={appointment.id}
                >
                  <div className="list-row-top front-office-record-head">
                    <div>
                      <strong>{appointment.title}</strong>
                      <p>{appointment.startsAtLabel}</p>
                    </div>
                    <div className="front-office-calendar-badges">
                      <Badge tone={appointment.typeTone}>
                        {appointment.typeLabel}
                      </Badge>
                      <StatusBadge tone={appointment.statusTone}>
                        {appointment.statusLabel}
                      </StatusBadge>
                      <Badge tone={appointment.reminderTone}>
                        {appointment.reminderLabel}
                      </Badge>
                      <StatusBadge tone={appointment.externalStatusTone}>
                        {appointment.externalStatusLabel}
                      </StatusBadge>
                      <StatusBadge tone={appointment.calendarLaneTone}>
                        {appointment.calendarLaneLabel}
                      </StatusBadge>
                    </div>
                  </div>

                  <div className="list-row-meta front-office-record-meta">
                    <span>{appointment.clientLabel}</span>
                    <span>{appointment.listingLabel}</span>
                    <span>{appointment.locationLabel}</span>
                    <span>{appointment.externalNextActionAtLabel}</span>
                    <span>{appointment.nextTouchPressureLabel}</span>
                    <span>{appointment.bridgeLoggedAtLabel}</span>
                    <span>{appointment.latestCoordinationLabel}</span>
                    <span>{appointment.latestCoordinationDetail}</span>
                  </div>

                  <p>{appointment.notesLabel}</p>
                  <p className="front-office-record-supporting">
                    {appointment.nextTouchPressureDetail}
                  </p>
                  <p className="front-office-record-supporting">
                    {appointment.calendarLaneDetail}
                  </p>
                  <p className="front-office-record-supporting">
                    {isZh ? "下一步：" : "Next move: "}
                    {appointment.coordinationNextStep}
                  </p>
                  {appointmentCueList.length ? (
                    <div className="front-office-calendar-badges">
                      {appointmentCueList.map((cue) => (
                        <Badge
                          key={`${appointment.id}-${cue.label}`}
                          tone={cue.tone}
                        >
                          {cue.label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}

                  <div className="front-office-calendar-actions">
                    <FrontOfficeLink
                      className="office-inline-link front-office-inline-link"
                      href={buildAppointmentFocusHref(appointment.id)}
                    >
                      {isFocused
                        ? isZh
                          ? "下方面板已聚焦"
                          : "Focused below"
                        : isZh
                          ? "在焦点面板中打开"
                          : "Open in focus panel"}
                    </FrontOfficeLink>
                    {appointment.clientHref ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={buildContextAwareHref(
                          appointment.clientHref,
                          appointment.id,
                        )}
                      >
                        {isZh ? "客户页" : "Client page"}
                      </FrontOfficeLink>
                    ) : null}
                    {appointment.listingOutputHref ? (
                      <FrontOfficeLink
                        className="office-inline-link front-office-inline-link"
                        href={buildContextAwareHref(
                          appointment.listingOutputHref,
                          appointment.id,
                        )}
                      >
                        {isZh ? "房源输出" : "Listing output"}
                      </FrontOfficeLink>
                    ) : null}
                    {appointment.statusValue === "scheduled" ? (
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={bridgeState?.appointmentId === appointment.id}
                        onClick={() =>
                          handleBridgeAction(appointment, "google_calendar")
                        }
                        type="button"
                      >
                        {bridgeState?.appointmentId === appointment.id &&
                        bridgeState.action === "google_calendar"
                          ? "Opening..."
                          : isZh
                            ? "Google 草稿"
                            : "Google draft"}
                      </button>
                    ) : null}
                    {appointment.statusValue === "scheduled" &&
                    appointment.externalStatusValue !== "confirmed" ? (
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={isBusy}
                        onClick={() =>
                          handleQuickWritebackAction(appointment, "confirmed")
                        }
                        type="button"
                      >
                        {isZh ? "在 Acre 中确认" : "Confirm in Acre"}
                      </button>
                    ) : null}
                    {appointment.statusValue === "scheduled" &&
                    appointment.touchPresets[0] ? (
                      <button
                        className="office-button-secondary office-inline-action-sm"
                        disabled={isBusy}
                        onClick={() =>
                          handleTouchPresetSave(
                            appointment,
                            appointment.touchPresets[0],
                          )
                        }
                        title={`${appointment.touchPresets[0].detail} Saved for ${appointment.touchPresets[0].nextActionAtLabel}.`}
                        type="button"
                      >
                        {appointment.touchPresets[0].label}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <EmptyState
              action={
                <div className="front-office-calendar-actions">
                  {hasQueueFilters ? (
                    <Button
                      disabled={isBusy}
                      onClick={clearQueueFilters}
                      size="sm"
                      variant="secondary"
                    >
                      {isZh ? "清除队列筛选" : "Clear queue filters"}
                    </Button>
                  ) : null}
                  {filterAppointmentId ? (
                    <Button
                      disabled={isBusy}
                      onClick={clearFocusLock}
                      size="sm"
                      variant="secondary"
                    >
                      {isZh ? "取消固定预约" : "Clear pinned appointment"}
                    </Button>
                  ) : null}
                  <Button
                    onClick={scrollToScheduleForm}
                    size="sm"
                    variant="secondary"
                  >
                    {isZh ? "跳到预约表单" : "Jump to schedule form"}
                  </Button>
                  {filterReturnTo ? (
                    <FrontOfficeLink
                      className="office-button-secondary office-inline-action-sm"
                      href={filterReturnTo}
                    >
                      {returnToLabel}
                    </FrontOfficeLink>
                  ) : null}
                </div>
              }
              description={
                focusMode === "locked_outside_queue"
                  ? isZh
                    ? "上面固定的预约仍然可读，但当前队列筛选让这个列表保持为空。"
                    : "The appointment pinned above is still readable, but the current queue filters leave this list empty."
                  : selectedClientLabel
                    ? isZh
                      ? `${selectedClientLabel} 在这个路由切片里暂时还没有可见预约。`
                      : `There are no visible appointments for ${selectedClientLabel} in this route slice yet.`
                    : hasQueueFilters
                      ? isZh
                        ? "当前路由筛选暂时匹配不到任何可见预约。"
                        : "The current route filters do not match any visible appointments right now."
                      : isZh
                        ? "用上面的表单安排第一次带看、咨询或客户会面。"
                        : "Schedule the first showing, consultation, or client meeting from the form above."
              }
              title={
                selectedClientLabel && !appointments.length
                  ? isZh
                    ? `${selectedClientLabel} 当前没有排入队列的预约`
                    : `No appointments queued for ${selectedClientLabel}`
                  : isZh
                    ? "这个队列里还没有预约"
                    : "No appointments in this queue"
              }
            />
          )}
        </div>
      )}
    </SectionCard>
  );
}
