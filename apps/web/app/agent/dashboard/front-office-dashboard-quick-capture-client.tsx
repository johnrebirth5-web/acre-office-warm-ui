"use client";

import { Button } from "@acre/ui";
import { useEffect, useState } from "react";
import { FrontOfficeLeadIntakeCard } from "../_components/front-office-lead-intake-card";
import type { FrontOfficeLeadDuplicatePreviewCandidate } from "../_components/front-office-lead-intake-review";
import { useI18n } from "../../../lib/i18n/client";

type FrontOfficeDashboardQuickCaptureClientProps = {
  duplicatePreviewCandidates: FrontOfficeLeadDuplicatePreviewCandidate[];
};

async function trackQuickCaptureOpened() {
  await fetch("/api/agent/dashboard/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actionKind: "quick_capture",
      eventType: "quick_capture_opened",
      sourceSurface: "agent_dashboard",
    }),
  }).catch(() => undefined);
}

export function FrontOfficeDashboardQuickCaptureClient(
  props: FrontOfficeDashboardQuickCaptureClientProps,
) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function openCapture() {
    setIsOpen(true);
    void trackQuickCaptureOpened();
  }

  return (
    <>
      <div className="front-office-dashboard-quick-capture">
        <Button onClick={openCapture} type="button">
          {isZh ? "新线索" : "New lead"}
        </Button>
        <Button onClick={openCapture} type="button" variant="secondary">
          {isZh ? "粘贴聊天" : "Paste chat"}
        </Button>
        <Button onClick={openCapture} type="button" variant="secondary">
          {isZh ? "上传截图" : "Upload screenshot"}
        </Button>
      </div>

      {isOpen ? (
        <div
          className="office-modal-overlay front-office-dashboard-capture-overlay"
          onClick={() => setIsOpen(false)}
        >
          <section
            aria-label={isZh ? "工作台快速录入" : "Dashboard quick capture"}
            aria-modal="true"
            className="office-modal front-office-dashboard-capture-drawer"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="office-modal-header">
              <div className="office-modal-title-block">
                <span className="office-create-modal-kicker">{isZh ? "快速录入" : "Quick Capture"}</span>
                <h3>{isZh ? "新线索" : "New lead"}</h3>
                <p>
                  {isZh
                    ? "结构化字段只保留姓名、预算、目标区域和跟进状态；其他信息放到备注里。"
                    : "Keep only Name, Budget, Target Area, and Follow-up Status as structured fields. Everything else stays in Note."}
                </p>
              </div>
              <Button
                onClick={() => setIsOpen(false)}
                type="button"
                variant="secondary"
              >
                {isZh ? "关闭" : "Close"}
              </Button>
            </header>

            <div className="office-modal-body">
              <FrontOfficeLeadIntakeCard
                dashboardCompact
                density="compact"
                hydrateDuplicatePreviewCandidates
                initialDuplicatePreviewCandidates={
                  props.duplicatePreviewCandidates
                }
                sourceSurface="dashboard"
                subtitle={
                  isZh
                    ? "快速记录线索；只有 Acre 找到真实匹配时才处理重复提醒，然后保存。"
                    : "Capture fast, review duplicate warnings only when Acre finds a real match, then save the lead."
                }
                title={isZh ? "线索详情" : "Lead details"}
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
