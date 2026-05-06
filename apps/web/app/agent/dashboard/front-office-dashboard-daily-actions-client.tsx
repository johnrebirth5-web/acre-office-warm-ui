"use client";

import {
  type FrontOfficeDashboardActionEventType,
  type FrontOfficeDashboardDailyActionCommand,
  type FrontOfficeDashboardDailyActionItem,
} from "@acre/db";
import { Button, EmptyState, StatusBadge, TextInput } from "@acre/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useI18n } from "../../../lib/i18n/client";

type FrontOfficeDashboardDailyActionsClientProps = {
  items: FrontOfficeDashboardDailyActionItem[];
};

type FeedbackState = {
  actionId: string;
  tone: "success" | "danger";
  message: string;
} | null;

function formatDateInput(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);

  return date.toISOString().slice(0, 10);
}

async function trackDashboardAction(input: {
  eventType: FrontOfficeDashboardActionEventType;
  item: FrontOfficeDashboardDailyActionItem;
  command?: FrontOfficeDashboardDailyActionCommand;
}) {
  await fetch("/api/agent/dashboard/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actionKind: input.item.kind,
      eventType: input.eventType,
      sourceSurface: "agent_dashboard",
      clientId: input.command?.clientId ?? input.item.clientId,
      appointmentId: input.command?.appointmentId ?? input.item.appointmentId,
      listingId: input.command?.listingId ?? input.item.listingId,
    }),
  }).catch(() => undefined);
}

function getCompletionEventType(
  command: FrontOfficeDashboardDailyActionCommand,
): FrontOfficeDashboardActionEventType | null {
  if (command.payload.completionEventType) {
    return command.payload.completionEventType;
  }

  switch (command.type) {
    case "mark_followed_up":
      return "mark_followed_up";
    case "snooze":
      return "snooze";
    case "create_follow_up":
      return "create_follow_up";
    case "appointment_writeback":
      return "appointment_writeback";
    case "appointment_bridge":
    case "download_ics":
      return "bridge_opened";
    default:
      return null;
  }
}

function isExternalCommand(command: FrontOfficeDashboardDailyActionCommand) {
  return (
    command.type === "appointment_bridge" ||
    command.type === "download_ics" ||
    (command.type === "open_href" && command.opensInNewTab)
  );
}

function formatActionKindLabel(kind: string, isZh: boolean) {
  if (!isZh) {
    return kind.replace(/_/g, " ");
  }

  const kindMap: Record<string, string> = {
    overdue_follow_up: "逾期跟进",
    follow_up_due: "待跟进",
    listing_warm_signal: "房源热信号",
    listing_send_risk: "分享风险",
    back_office_handoff: "待交接后台",
    appointment_writeback: "预约回写",
    appointment_bridge: "预约桥接",
    duplicate_review: "重复审查",
  };

  return kindMap[kind] ?? kind.replace(/_/g, " ");
}

export function FrontOfficeDashboardDailyActionsClient(
  props: FrontOfficeDashboardDailyActionsClientProps,
) {
  const router = useRouter();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [openMoreId, setOpenMoreId] = useState("");
  const [snoozeActionId, setSnoozeActionId] = useState("");
  const [customSnoozeDate, setCustomSnoozeDate] = useState("");
  const renderedKey = useMemo(
    () => props.items.map((item) => item.id).join("|"),
    [props.items],
  );

  useEffect(() => {
    props.items.forEach((item) => {
      void trackDashboardAction({
        eventType: "action_rendered",
        item,
      });
    });
  }, [renderedKey, props.items]);

  useEffect(() => {
    if (!openMoreId) {
      return undefined;
    }

    function closeMoreMenu() {
      setOpenMoreId("");
    }

    window.addEventListener("click", closeMoreMenu);

    return () => {
      window.removeEventListener("click", closeMoreMenu);
    };
  }, [openMoreId]);

  async function updateClientReminder(input: {
    item: FrontOfficeDashboardDailyActionItem;
    command: FrontOfficeDashboardDailyActionCommand;
    nextFollowUpAt: string;
  }) {
    if (!input.command.clientId) {
      throw new Error(isZh ? "缺少客户上下文。" : "Client context is missing.");
    }

    const response = await fetch(
      `/api/agent/clients/${input.command.clientId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          followUpReminderMode: "manual",
          nextFollowUpAt: input.nextFollowUpAt,
        }),
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(payload?.error || (isZh ? "无法稍后提醒。" : "Could not snooze this reminder."));
    }

    await trackDashboardAction({
      eventType: "snooze",
      item: input.item,
      command: input.command,
    });
  }

  async function executeCommand(input: {
    item: FrontOfficeDashboardDailyActionItem;
    command: FrontOfficeDashboardDailyActionCommand;
    eventType: "primary_clicked" | "secondary_clicked";
  }) {
    const { item, command } = input;
    const pendingId = `${item.id}:${command.id}`;

    if (command.type === "snooze") {
      setSnoozeActionId((current) => (current === item.id ? "" : item.id));
      setOpenMoreId("");
      await trackDashboardAction({
        eventType: input.eventType,
        item,
        command,
      });
      return;
    }

    setPendingKey(pendingId);
    setFeedback(null);
    await trackDashboardAction({
      eventType: input.eventType,
      item,
      command,
    });

    startTransition(async () => {
      try {
        if (command.type === "mark_followed_up") {
          if (!command.clientId) {
            throw new Error(isZh ? "缺少客户上下文。" : "Client context is missing.");
          }

          const response = await fetch(`/api/agent/clients/${command.clientId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              markFollowedUpNow: true,
            }),
          });

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(payload?.error || (isZh ? "无法标记已跟进。" : "Could not mark followed up."));
          }
        } else if (command.type === "create_follow_up") {
          if (!command.clientId) {
            throw new Error(isZh ? "缺少客户上下文。" : "Client context is missing.");
          }

          const response = await fetch(
            `/api/agent/clients/${command.clientId}/follow-up-tasks`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                title: command.payload.followUpTitle || item.title,
                dueAt: command.payload.followUpDueAt || formatDateInput(1),
                ...(command.payload.aiAcceptedAction
                  ? { aiAcceptedAction: command.payload.aiAcceptedAction }
                  : {}),
              }),
            },
          );

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(payload?.error || (isZh ? "无法创建跟进任务。" : "Could not create follow-up."));
          }
        } else if (command.type === "appointment_writeback") {
          if (!command.appointmentId || !command.payload.externalStatus) {
            throw new Error(isZh ? "缺少预约回写上下文。" : "Appointment writeback context is missing.");
          }

          const response = await fetch(
            `/api/agent/appointments/${command.appointmentId}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                externalStatus: command.payload.externalStatus,
              }),
            },
          );

          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: string; hint?: string }
              | null;
            throw new Error(
              payload?.error || payload?.hint || (isZh ? "无法保存回写。" : "Could not save writeback."),
            );
          }
        } else if (command.href) {
          if (isExternalCommand(command)) {
            window.open(command.href, "_blank", "noopener,noreferrer");
          } else {
            router.push(command.href);
          }
        }

        const completionEvent = getCompletionEventType(command);

        if (completionEvent) {
          await trackDashboardAction({
            eventType: completionEvent,
            item,
            command,
          });
        }

        setFeedback({
          actionId: item.id,
          tone: "success",
          message:
            command.type === "open_href" || isExternalCommand(command)
              ? isZh ? "已打开。" : "Opened."
              : isZh ? "已保存。" : "Saved.",
        });
        setOpenMoreId("");
        setSnoozeActionId("");
        router.refresh();
      } catch (error) {
        setFeedback({
          actionId: item.id,
          tone: "danger",
          message:
            error instanceof Error
              ? error.message
              : isZh ? "无法完成这个动作。" : "Could not complete this action.",
        });
      } finally {
        setPendingKey("");
      }
    });
  }

  async function snooze(input: {
    item: FrontOfficeDashboardDailyActionItem;
    command: FrontOfficeDashboardDailyActionCommand;
    nextFollowUpAt: string;
  }) {
    const pendingId = `${input.item.id}:${input.command.id}:${input.nextFollowUpAt}`;
    setPendingKey(pendingId);
    setFeedback(null);

    startTransition(async () => {
      try {
        await updateClientReminder(input);
        setFeedback({
          actionId: input.item.id,
          tone: "success",
          message: isZh ? "已稍后提醒。" : "Reminder snoozed.",
        });
        setSnoozeActionId("");
        router.refresh();
      } catch (error) {
        setFeedback({
          actionId: input.item.id,
          tone: "danger",
          message:
            error instanceof Error
              ? error.message
              : isZh ? "无法稍后提醒。" : "Could not snooze this reminder.",
        });
      } finally {
        setPendingKey("");
      }
    });
  }

  if (!props.items.length) {
    return (
      <EmptyState
        description={isZh ? "当前没有紧急跟进、预约、房源、交接或清理动作。" : "No urgent follow-up, appointment, listing, handoff, or cleanup action is waiting right now."}
        title={isZh ? "暂无下一步动作" : "No next action waiting"}
      />
    );
  }

  return (
    <div className="front-office-dashboard-daily-actions">
      {props.items.map((item) => {
        const visibleSecondary =
          item.secondaryActions.length > 2
            ? item.secondaryActions.slice(0, 1)
            : item.secondaryActions;
        const overflowSecondary =
          item.secondaryActions.length > 2
            ? item.secondaryActions.slice(1)
            : [];
        const snoozeCommand = item.secondaryActions.find(
          (command) => command.type === "snooze",
        );

        return (
          <article className="front-office-dashboard-action-row" key={item.id}>
            <div className="front-office-dashboard-action-copy">
              <StatusBadge tone={item.tone}>{formatActionKindLabel(item.kind, isZh)}</StatusBadge>
              <div>
                <strong>{item.title}</strong>
                <p>{item.whyNowLabel}</p>
              </div>
              <span>{item.contextLabel}</span>
            </div>

            <div className="front-office-dashboard-action-controls">
              <Button
                disabled={isPending}
                onClick={() => {
                  void executeCommand({
                    item,
                    command: item.primaryAction,
                    eventType: "primary_clicked",
                  });
                }}
                size="sm"
                type="button"
              >
                {pendingKey === `${item.id}:${item.primaryAction.id}`
                  ? isZh ? "处理中..." : "Working..."
                  : item.primaryAction.label}
              </Button>

              {visibleSecondary.map((command) => (
                <Button
                  disabled={isPending}
                  key={command.id}
                  onClick={() => {
                    void executeCommand({
                      item,
                      command,
                      eventType: "secondary_clicked",
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {command.label}
                </Button>
              ))}

              {overflowSecondary.length ? (
                <div
                  className="front-office-dashboard-action-more"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    aria-expanded={openMoreId === item.id}
                    disabled={isPending}
                    onClick={() => {
                      setOpenMoreId((current) =>
                        current === item.id ? "" : item.id,
                      );
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {isZh ? "更多" : "More"}
                  </Button>

                  {openMoreId === item.id ? (
                    <div className="front-office-dashboard-action-more-menu">
                      {overflowSecondary.map((command) => (
                        <button
                          disabled={isPending}
                          key={command.id}
                          onClick={() => {
                            void executeCommand({
                              item,
                              command,
                              eventType: "secondary_clicked",
                            });
                          }}
                          type="button"
                        >
                          {command.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {snoozeActionId === item.id && snoozeCommand ? (
              <div className="front-office-dashboard-snooze-panel">
                <Button
                  disabled={isPending}
                  onClick={() =>
                    void snooze({
                      item,
                      command: snoozeCommand,
                      nextFollowUpAt: formatDateInput(1),
                    })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {isZh ? "明天" : "Tomorrow"}
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() =>
                    void snooze({
                      item,
                      command: snoozeCommand,
                      nextFollowUpAt: formatDateInput(2),
                    })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {isZh ? "2 天后" : "2 days"}
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() =>
                    void snooze({
                      item,
                      command: snoozeCommand,
                      nextFollowUpAt: formatDateInput(7),
                    })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {isZh ? "下周" : "Next week"}
                </Button>
                <TextInput
                  aria-label={isZh ? `${item.title} 的自定义稍后提醒日期` : `Custom snooze date for ${item.title}`}
                  disabled={isPending}
                  onChange={(event) => setCustomSnoozeDate(event.target.value)}
                  type="date"
                  value={customSnoozeDate}
                />
                <Button
                  disabled={isPending || !customSnoozeDate}
                  onClick={() =>
                    void snooze({
                      item,
                      command: snoozeCommand,
                      nextFollowUpAt: customSnoozeDate,
                    })
                  }
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {isZh ? "保存自定义日期" : "Save custom"}
                </Button>
              </div>
            ) : null}

            {feedback?.actionId === item.id ? (
              <p
                className={`front-office-dashboard-action-feedback is-${feedback.tone}`}
              >
                {feedback.message}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
