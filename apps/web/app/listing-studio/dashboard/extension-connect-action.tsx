"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@acre/ui";

const PAGE_SOURCE = "acre-listing-studio-dashboard";
const EXTENSION_SOURCE = "acre-listing-studio-extension";
const REQUEST_TYPE = "ACRE_LISTING_STUDIO_EXTENSION_REQUEST";
const RESPONSE_TYPE = "ACRE_LISTING_STUDIO_EXTENSION_RESPONSE";
const READY_TYPE = "ACRE_LISTING_STUDIO_BRIDGE_READY";
const BRIDGE_READY_TIMEOUT_MS = 1200;

type ExtensionConnectActionProps = {
  serverHasActiveToken: boolean;
  serverActiveTokenCount: number;
  serverLatestConnectedAtLabel: string;
};

type BrowserConnectionState =
  | "checking"
  | "not_installed"
  | "disconnected"
  | "pending"
  | "connected";

type ExtensionMessageAction =
  | "GET_CONFIG"
  | "START_CONNECT"
  | "CHECK_CONNECTION_STATUS";

function createRequestId() {
  return `ls-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pluralizeConnections(count: number) {
  return `${count} active connection${count === 1 ? "" : "s"}`;
}

export function ListingStudioExtensionConnectAction(
  props: ExtensionConnectActionProps,
) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [bridgeReady, setBridgeReady] = useState(false);
  const [browserConnectionState, setBrowserConnectionState] =
    useState<BrowserConnectionState>("checking");
  const bridgeReadyRef = useRef(false);
  const currentRequestIdRef = useRef<string | null>(null);
  const currentRequestActionRef = useRef<ExtensionMessageAction | null>(null);
  const responseTimeoutRef = useRef<number | null>(null);
  const bridgeReadyTimeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  function clearResponseTimeout() {
    if (responseTimeoutRef.current !== null) {
      window.clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  }

  function clearBridgeTimeout() {
    if (bridgeReadyTimeoutRef.current !== null) {
      window.clearTimeout(bridgeReadyTimeoutRef.current);
      bridgeReadyTimeoutRef.current = null;
    }
  }

  function stopPolling() {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }

  function sendExtensionRequest(action: ExtensionMessageAction) {
    const requestId = createRequestId();
    currentRequestIdRef.current = requestId;
    currentRequestActionRef.current = action;

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
        setBridgeReady(false);
        bridgeReadyRef.current = false;
        setBrowserConnectionState("not_installed");
        setStatusMessage(
          "Chrome extension not detected on this browser. Install or reload it, then refresh this page.",
        );
      }
    }, 1500);
  }

  useEffect(() => {
    bridgeReadyTimeoutRef.current = window.setTimeout(() => {
      if (bridgeReadyRef.current) {
        return;
      }

      setBridgeReady(false);
      setBrowserConnectionState("not_installed");
    }, BRIDGE_READY_TIMEOUT_MS);

    function handleMessage(event: MessageEvent) {
      if (event.source !== window) {
        return;
      }

      const data = event.data;
      if (!data || data.source !== EXTENSION_SOURCE) {
        return;
      }

      if (data.type === READY_TYPE) {
        clearBridgeTimeout();
        bridgeReadyRef.current = true;
        setBridgeReady(true);
        setStatusMessage("");
        sendExtensionRequest("GET_CONFIG");
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
        setBrowserConnectionState(
          bridgeReadyRef.current ? "disconnected" : "not_installed",
        );
        setStatusMessage(data.error || "Unable to reach the Acre extension.");
        return;
      }

      const payload = data.payload || {};

      if (payload.connectionState === "connected" && payload.extensionToken) {
        setIsConnecting(false);
        stopPolling();
        setBrowserConnectionState("connected");
        setStatusMessage("Chrome extension connected in this browser.");
        return;
      }

      if (payload.connectionState === "pending") {
        setBrowserConnectionState("pending");
        setStatusMessage("Approving extension in a new tab...");

        if (pollIntervalRef.current === null) {
          pollIntervalRef.current = window.setInterval(() => {
            sendExtensionRequest("CHECK_CONNECTION_STATUS");
          }, 2000);
        }
        return;
      }

      setIsConnecting(false);
      stopPolling();
      setBrowserConnectionState(
        bridgeReadyRef.current ? "disconnected" : "not_installed",
      );

      if (payload.connectionError) {
        setStatusMessage(payload.connectionError);
        return;
      }

      if (currentRequestActionRef.current === "GET_CONFIG") {
        setStatusMessage("");
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearResponseTimeout();
      clearBridgeTimeout();
      stopPolling();
    };
  }, []);

  function handleClick() {
    if (browserConnectionState === "not_installed") {
      window.location.reload();
      return;
    }

    if (!bridgeReady) {
      setBrowserConnectionState("not_installed");
      setStatusMessage(
        "Chrome extension not detected on this browser. Install or reload it, then refresh this page.",
      );
      return;
    }

    setIsConnecting(true);
    setStatusMessage("");
    sendExtensionRequest("START_CONNECT");
  }

  let heading = "Checking this browser";
  let description =
    "Acre is checking whether the Chrome extension is available in this browser.";
  let badgeClassName = "office-status-badge office-status-badge-neutral";
  let badgeLabel = "Checking";
  let panelMessage =
    "Connect this browser to save listings directly from supported pages.";

  if (browserConnectionState === "connected") {
    heading = "Connected in this browser";
    description =
      props.serverHasActiveToken && props.serverActiveTokenCount > 0
        ? `This browser is ready to save listings. Your account currently has ${pluralizeConnections(props.serverActiveTokenCount)}. Latest link: ${props.serverLatestConnectedAtLabel}.`
        : "This browser is ready to save listings into Acre.";
    badgeClassName = "office-status-badge office-status-badge-success";
    badgeLabel = "Connected";
    panelMessage = "This browser can now save listings directly from StreetEasy and Zillow.";
  } else if (browserConnectionState === "pending") {
    heading = "Approving this browser";
    description =
      "Finish the Acre approval tab that just opened. This page will update automatically once the extension is linked.";
    badgeClassName = "office-status-badge office-status-badge-warning";
    badgeLabel = "Awaiting connection";
    panelMessage = "The approval tab is open. Finish approval there and this page will update automatically.";
  } else if (browserConnectionState === "disconnected") {
    heading = "Ready to connect in this browser";
    description =
      props.serverHasActiveToken && props.serverActiveTokenCount > 0
        ? `This account already has ${pluralizeConnections(props.serverActiveTokenCount)} on another browser. Click Connect Chrome extension to link this browser too.`
        : "Click Connect Chrome extension and Acre will open the approval page automatically.";
    badgeClassName = "office-status-badge office-status-badge-warning";
    badgeLabel = "Ready to connect";
    panelMessage = "Connect this browser to save listings directly from supported pages.";
  } else if (browserConnectionState === "not_installed") {
    heading = "Extension not detected on this page";
    description =
      props.serverHasActiveToken && props.serverActiveTokenCount > 0
        ? `Your account already has ${pluralizeConnections(props.serverActiveTokenCount)} somewhere else, but this browser still needs the Acre Chrome extension installed or reloaded.`
        : "Install or reload the Acre Chrome extension in this browser, then refresh this dashboard to continue.";
    badgeClassName = "office-status-badge office-status-badge-neutral";
    badgeLabel = "Extension missing";
    panelMessage =
      "If you just installed or reloaded the extension, refresh this dashboard first. Then you can connect this browser.";
  }

  let actionLabel = "Connect Chrome extension";
  if (browserConnectionState === "connected") {
    actionLabel = "Connected in this browser";
  } else if (browserConnectionState === "pending" || isConnecting) {
    actionLabel = "Connecting...";
  } else if (browserConnectionState === "not_installed") {
    actionLabel = "Refresh after install";
  }

  return (
    <div className="listing-studio-banner-grid">
      <div className="listing-studio-banner-copy">
        <span className="listing-studio-banner-kicker">Current browser</span>
        <strong>{heading}</strong>
        <p>{description}</p>
        {statusMessage ? (
          <p className="listing-studio-status-message">{statusMessage}</p>
        ) : null}
      </div>
      <div className="listing-studio-banner-panel">
        <div className="listing-studio-banner-status">
          <span className={badgeClassName}>{badgeLabel}</span>
          <span className="listing-studio-banner-source-pill">
            StreetEasy + Zillow
          </span>
        </div>
        <p className="listing-studio-banner-meta">{panelMessage}</p>
        <div className="listing-studio-connect-action">
          <Button
            disabled={browserConnectionState === "connected" || isConnecting}
            onClick={handleClick}
            variant="primary"
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
