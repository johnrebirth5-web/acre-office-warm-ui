"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@acre/ui";

const PAGE_SOURCE = "acre-listing-studio-dashboard";
const EXTENSION_SOURCE = "acre-listing-studio-extension";
const REQUEST_TYPE = "ACRE_LISTING_STUDIO_EXTENSION_REQUEST";
const RESPONSE_TYPE = "ACRE_LISTING_STUDIO_EXTENSION_RESPONSE";
const READY_TYPE = "ACRE_LISTING_STUDIO_BRIDGE_READY";

type ExtensionConnectActionProps = {
  initialConnected: boolean;
};

function createRequestId() {
  return `ls-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ListingStudioExtensionConnectAction(
  props: ExtensionConnectActionProps,
) {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [bridgeReady, setBridgeReady] = useState(false);
  const currentRequestIdRef = useRef<string | null>(null);
  const responseTimeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  function clearResponseTimeout() {
    if (responseTimeoutRef.current !== null) {
      window.clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  }

  function stopPolling() {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  function sendExtensionRequest(action: "START_CONNECT" | "CHECK_CONNECTION_STATUS") {
    const requestId = createRequestId();
    currentRequestIdRef.current = requestId;

    window.postMessage(
      {
        source: PAGE_SOURCE,
        type: REQUEST_TYPE,
        action,
        requestId,
        baseUrl: window.location.origin,
      },
      window.location.origin,
    );

    clearResponseTimeout();
    responseTimeoutRef.current = window.setTimeout(() => {
      if (currentRequestIdRef.current === requestId) {
        setIsConnecting(false);
        setStatusMessage(
          "Acre Chrome extension not detected. Reload the extension and refresh this page.",
        );
      }
    }, 1500);
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) {
        return;
      }

      const data = event.data;
      if (!data || data.source !== EXTENSION_SOURCE) {
        return;
      }

      if (data.type === READY_TYPE) {
        setBridgeReady(true);
        return;
      }

      if (
        data.type !== RESPONSE_TYPE ||
        typeof data.requestId !== "string" ||
        data.requestId !== currentRequestIdRef.current
      ) {
        return;
      }

      clearResponseTimeout();

      if (!data.ok) {
        setIsConnecting(false);
        stopPolling();
        setStatusMessage(data.error || "Unable to reach the Acre extension.");
        return;
      }

      const payload = data.payload || {};
      if (payload.connectionState === "connected" && payload.extensionToken) {
        setIsConnecting(false);
        stopPolling();
        setStatusMessage("Chrome extension connected.");
        router.refresh();
        return;
      }

      if (payload.connectionState === "pending") {
        setStatusMessage("Approving extension in a new tab...");
        if (pollIntervalRef.current === null) {
          pollIntervalRef.current = window.setInterval(() => {
            sendExtensionRequest("CHECK_CONNECTION_STATUS");
          }, 2000);
        }
        return;
      }

      if (payload.connectionError) {
        setIsConnecting(false);
        stopPolling();
        setStatusMessage(payload.connectionError);
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearResponseTimeout();
      stopPolling();
    };
  }, [router]);

  function handleClick() {
    if (props.initialConnected && !isConnecting) {
      router.push("/listing-studio/listings");
      return;
    }

    setIsConnecting(true);
    setStatusMessage(
      bridgeReady ? "" : "Waiting for the Acre extension on this page...",
    );
    sendExtensionRequest("START_CONNECT");
  }

  return (
    <div className="listing-studio-connect-action">
      <Button onClick={handleClick} variant="primary">
        {props.initialConnected
          ? "View listings"
          : isConnecting
            ? "Connecting..."
            : "Connect Chrome extension"}
      </Button>
      {statusMessage ? (
        <p className="listing-studio-status-message">{statusMessage}</p>
      ) : null}
    </div>
  );
}
