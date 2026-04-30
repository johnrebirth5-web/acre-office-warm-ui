"use client";

import { Button } from "@acre/ui";
import { useEffect, useState } from "react";
import { FrontOfficeLeadIntakeCard } from "../_components/front-office-lead-intake-card";
import type { FrontOfficeLeadDuplicatePreviewCandidate } from "../_components/front-office-lead-intake-review";

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
          New lead
        </Button>
        <Button onClick={openCapture} type="button" variant="secondary">
          Paste chat
        </Button>
        <Button onClick={openCapture} type="button" variant="secondary">
          Upload screenshot
        </Button>
      </div>

      {isOpen ? (
        <div
          className="office-modal-overlay front-office-dashboard-capture-overlay"
          onClick={() => setIsOpen(false)}
        >
          <section
            aria-label="Dashboard quick capture"
            aria-modal="true"
            className="office-modal front-office-dashboard-capture-drawer"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="office-modal-header">
              <div className="office-modal-title-block">
                <span className="office-create-modal-kicker">Quick Capture</span>
                <h3>New lead</h3>
                <p>
                  Keep only Name, Budget, Target Area, and Follow-up Status as
                  structured fields. Everything else stays in Note.
                </p>
              </div>
              <Button
                onClick={() => setIsOpen(false)}
                type="button"
                variant="secondary"
              >
                Close
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
                subtitle="Capture fast, review duplicate warnings only when Acre finds a real match, then save the lead."
                title="Lead details"
              />
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
