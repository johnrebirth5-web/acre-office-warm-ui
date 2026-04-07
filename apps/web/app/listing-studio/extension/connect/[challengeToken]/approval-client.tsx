"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { Button } from "@acre/ui";

export function ListingStudioExtensionApprovalClient(props: {
  challengeToken: string;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "approved" | "error">("idle");
  const [message, setMessage] = useState("");
  const hasAttemptedRef = useRef(false);

  function approve() {
    setStatus("submitting");
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/listing-studio/extension/connect/approve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            challengeToken: props.challengeToken,
          }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Approval failed.");
        }

        setStatus("approved");
        setMessage("Extension connected. You can return to Acre.");
        try {
          window.localStorage.setItem(
            "acre-listing-studio-extension-approved-at",
            Date.now().toString(),
          );
        } catch {}
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Approval failed.");
      }
    });
  }

  useEffect(() => {
    if (hasAttemptedRef.current) {
      return;
    }

    hasAttemptedRef.current = true;
    approve();
  }, []);

  return (
    <div className="listing-studio-approval-actions">
      <Button onClick={approve} variant="primary">
        {status === "submitting" ? "Approving..." : status === "approved" ? "Approved" : "Approve extension"}
      </Button>
      {message ? <p className="listing-studio-status-message">{message}</p> : null}
    </div>
  );
}
