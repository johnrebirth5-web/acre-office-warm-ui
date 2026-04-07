"use client";

import { startTransition, useState } from "react";
import { Button } from "@acre/ui";

export function ListingStudioExtensionApprovalClient(props: {
  challengeToken: string;
}) {
  const [status, setStatus] = useState<"idle" | "submitting" | "approved" | "error">("idle");
  const [message, setMessage] = useState("");

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
        setMessage("Extension approved. You can return to Chrome and the popup will complete the connection automatically.");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Approval failed.");
      }
    });
  }

  return (
    <div className="listing-studio-approval-actions">
      <Button onClick={approve} variant="primary">
        {status === "submitting" ? "Approving..." : "Approve extension"}
      </Button>
      {message ? <p className="listing-studio-status-message">{message}</p> : null}
    </div>
  );
}
