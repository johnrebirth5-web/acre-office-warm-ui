"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@acre/ui";
import { useI18n } from "../../../../../lib/i18n/client";

const RETURN_TO_LISTINGS_DELAY_MS = 1200;

export function ListingStudioExtensionApprovalClient(props: {
  challengeToken: string;
}) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const [status, setStatus] = useState<"idle" | "submitting" | "approved" | "error">("idle");
  const [message, setMessage] = useState("");
  const hasAttemptedRef = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);
  const router = useRouter();

  function clearRedirectTimeout() {
    if (redirectTimeoutRef.current !== null) {
      window.clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
  }

  function scheduleListingsReturn() {
    clearRedirectTimeout();
    redirectTimeoutRef.current = window.setTimeout(() => {
      router.replace("/listing-studio/listings?extensionConnection=approved");
    }, RETURN_TO_LISTINGS_DELAY_MS);
  }

  function approve() {
    clearRedirectTimeout();
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
          throw new Error(isZh ? "授权失败。" : body?.error || "Approval failed.");
        }

        setStatus("approved");
        setMessage(
          isZh
            ? "扩展已授权，正在返回房源工作室..."
            : "Extension approved. Returning to Listing Studio...",
        );
        try {
          window.localStorage.setItem(
            "acre-listing-studio-extension-approved-at",
            Date.now().toString(),
          );
        } catch {}
        scheduleListingsReturn();
      } catch (error) {
        setStatus("error");
        setMessage(
          isZh
            ? "授权失败。"
            : error instanceof Error
              ? error.message
              : "Approval failed.",
        );
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

  useEffect(() => {
    return () => {
      clearRedirectTimeout();
    };
  }, []);

  return (
    <div className="listing-studio-approval-actions">
      <Button onClick={approve} variant="primary">
        {status === "submitting"
          ? isZh
            ? "正在授权..."
            : "Approving..."
          : status === "approved"
            ? isZh
              ? "已授权"
              : "Approved"
            : isZh
              ? "授权扩展"
              : "Approve extension"}
      </Button>
      {message ? <p className="listing-studio-status-message">{message}</p> : null}
    </div>
  );
}
