"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@acre/ui";
import { LISTING_STUDIO_EXTENSION_STORE_URL } from "../extension-store-url";

const PAGE_SOURCE = "acre-listing-studio-dashboard";
const EXTENSION_SOURCE = "acre-listing-studio-extension";
const REQUEST_TYPE = "ACRE_LISTING_STUDIO_EXTENSION_REQUEST";
const RESPONSE_TYPE = "ACRE_LISTING_STUDIO_EXTENSION_RESPONSE";
const READY_TYPE = "ACRE_LISTING_STUDIO_BRIDGE_READY";
const INSTALL_ROUTE = "/listing-studio/extension/install";
const STORE_INSTALL_URL = LISTING_STUDIO_EXTENSION_STORE_URL;
const APPROVAL_RETURN_STORAGE_KEY =
  "acre-listing-studio-extension-approved-at";
const BRIDGE_REFRESH_STORAGE_KEY =
  "acre-listing-studio-extension-bridge-refresh";
const APPROVAL_RETURN_WINDOW_MS = 5 * 60 * 1000;
const EXTENSION_NOT_REACHABLE_MESSAGE =
  "Acre couldn't reach the Chrome extension on this tab. If it's already installed, reload the extension and refresh this page.";
const EXTENSION_RELOAD_MESSAGE =
  "The Acre extension stopped responding. Reload the extension and refresh this page.";

type ExtensionConnectActionProps = {
  serverHasActiveToken: boolean;
  serverActiveTokenCount: number;
  serverLatestConnectedAtLabel: string;
};

type BrowserConnectionState =
  | "idle"
  | "checking"
  | "not_installed"
  | "disconnected"
  | "pending"
  | "connected";

type ExtensionMessageAction =
  | "GET_CONFIG"
  | "START_CONNECT"
  | "CHECK_CONNECTION_STATUS";

type ExtensionBridgePayload = {
  baseUrl?: string;
  challengeToken?: string | null;
  challengeExpiresAt?: string | null;
  connectionError?: string | null;
  connectionState?: BrowserConnectionState | "disconnected";
  extensionToken?: string | null;
};

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
    useState<BrowserConnectionState>("idle");
  const bridgeReadyRef = useRef(false);
  const bridgeRefreshAttemptedRef = useRef(false);
  const currentRequestIdRef = useRef<string | null>(null);
  const reopenApprovalOnPendingRef = useRef(false);
  const responseTimeoutRef = useRef<number | null>(null);

  function clearStoredApprovalReturn() {
    try {
      window.localStorage.removeItem(APPROVAL_RETURN_STORAGE_KEY);
    } catch {}
  }

  function buildApprovalUrl(payload: ExtensionBridgePayload | null | undefined) {
    const baseUrl =
      typeof payload?.baseUrl === "string" && payload.baseUrl.trim()
        ? payload.baseUrl.trim().replace(/\/+$/, "")
        : "";
    const challengeToken =
      typeof payload?.challengeToken === "string" && payload.challengeToken.trim()
        ? payload.challengeToken.trim()
        : "";

    if (!baseUrl || !challengeToken) {
      return null;
    }

    return `${baseUrl}/listing-studio/extension/connect/${encodeURIComponent(challengeToken)}`;
  }

  function reopenApprovalTab(payload: ExtensionBridgePayload | null | undefined) {
    const approvalUrl = buildApprovalUrl(payload);
    if (!approvalUrl) {
      return false;
    }

    window.open(approvalUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  function clearResponseTimeout() {
    if (responseTimeoutRef.current !== null) {
      window.clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
  }

  function sendExtensionRequest(action: ExtensionMessageAction) {
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
        if (bridgeReadyRef.current) {
          setBrowserConnectionState("disconnected");
          setStatusMessage(EXTENSION_RELOAD_MESSAGE);
          return;
        }

        setBrowserConnectionState("not_installed");
        setStatusMessage(EXTENSION_NOT_REACHABLE_MESSAGE);
        reopenApprovalOnPendingRef.current = false;
      }
    }, 1500);
  }

  useEffect(() => {
    try {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get("extensionConnection") === "approved") {
        setStatusMessage("Approval complete. Checking this browser now.");
        currentUrl.searchParams.delete("extensionConnection");
        window.history.replaceState({}, "", currentUrl.toString());
      }
    } catch {}

    try {
      const approvalReturnAt = Number(
        window.localStorage.getItem(APPROVAL_RETURN_STORAGE_KEY),
      );
      if (
        Number.isFinite(approvalReturnAt) &&
        Date.now() - approvalReturnAt > APPROVAL_RETURN_WINDOW_MS
      ) {
        window.localStorage.removeItem(APPROVAL_RETURN_STORAGE_KEY);
      }
    } catch {}

    try {
      bridgeRefreshAttemptedRef.current =
        window.sessionStorage.getItem(BRIDGE_REFRESH_STORAGE_KEY) === "1";
      window.sessionStorage.removeItem(BRIDGE_REFRESH_STORAGE_KEY);
    } catch {}

    function handleMessage(event: MessageEvent) {
      if (event.source !== window) {
        return;
      }

      const data = event.data;
      if (!data || data.source !== EXTENSION_SOURCE) {
        return;
      }

      if (data.type === READY_TYPE) {
        bridgeReadyRef.current = true;
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
      const shouldReopenApproval = reopenApprovalOnPendingRef.current;
      reopenApprovalOnPendingRef.current = false;

      if (!bridgeReadyRef.current) {
        bridgeReadyRef.current = true;
        setBridgeReady(true);
      }

      if (!data.ok) {
        setIsConnecting(false);
        setBrowserConnectionState(
          bridgeReadyRef.current ? "disconnected" : "not_installed",
        );
        setStatusMessage(data.error || "Unable to reach the Acre extension.");
        return;
      }

      const payload = (data.payload || {}) as ExtensionBridgePayload;

      if (payload.connectionState === "connected" && payload.extensionToken) {
        setIsConnecting(false);
        setBrowserConnectionState("connected");
        setStatusMessage("Chrome extension connected in this browser.");
        clearStoredApprovalReturn();
        return;
      }

      if (payload.connectionState === "pending") {
        setIsConnecting(false);
        setBrowserConnectionState("pending");
        setStatusMessage(
          shouldReopenApproval && reopenApprovalTab(payload)
            ? "Approval is still pending. Acre reopened the approval tab for this browser."
            : "Finish the Acre approval for this browser. If you closed the tab, click Finish approval and Acre will reopen it.",
        );
        return;
      }

      setIsConnecting(false);
      setBrowserConnectionState(
        bridgeReadyRef.current ? "disconnected" : "not_installed",
      );

      if (payload.connectionError) {
        setStatusMessage(payload.connectionError);
        clearStoredApprovalReturn();
        return;
      }

      setStatusMessage("");
      clearStoredApprovalReturn();
    }

    window.addEventListener("message", handleMessage);
    setBrowserConnectionState("checking");
    sendExtensionRequest("CHECK_CONNECTION_STATUS");

    return () => {
      window.removeEventListener("message", handleMessage);
      clearResponseTimeout();
    };
  }, []);

  function handleClick() {
    if (browserConnectionState === "idle" || browserConnectionState === "checking") {
      setBrowserConnectionState("checking");
      setStatusMessage("");
      sendExtensionRequest("CHECK_CONNECTION_STATUS");
      return;
    }

    if (browserConnectionState === "not_installed") {
      if (!bridgeRefreshAttemptedRef.current) {
        bridgeRefreshAttemptedRef.current = true;
        setStatusMessage("Refreshing this tab so Acre can look for the installed extension again.");
        try {
          window.sessionStorage.setItem(BRIDGE_REFRESH_STORAGE_KEY, "1");
        } catch {}
        window.location.reload();
        return;
      }

      if (STORE_INSTALL_URL) {
        setStatusMessage(
          "Install Acre Listing Studio from the Chrome Web Store, then come back here and click Check extension.",
        );
        window.open(STORE_INSTALL_URL, "_blank", "noopener,noreferrer");
        return;
      }

      window.location.href = INSTALL_ROUTE;
      return;
    }

    if (browserConnectionState === "pending") {
      reopenApprovalOnPendingRef.current = true;
      setBrowserConnectionState("checking");
      setStatusMessage("");
      sendExtensionRequest("CHECK_CONNECTION_STATUS");
      return;
    }

    if (!bridgeReady) {
      setBrowserConnectionState("not_installed");
      setStatusMessage(EXTENSION_NOT_REACHABLE_MESSAGE);
      return;
    }

    setIsConnecting(true);
    setStatusMessage("");
    sendExtensionRequest("START_CONNECT");
  }

  let heading = "Check this browser";
  let description =
    "Click Check extension when you want Acre to verify whether the Chrome extension is available in this browser.";
  let badgeClassName = "office-status-badge office-status-badge-neutral";
  let badgeLabel = "Manual check";
  let panelMessage =
    "Acre will only check this browser when you click the button below.";

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
    heading = "Finish approval for this browser";
    description =
      "Acre is waiting for browser approval. Click Finish approval and Acre will reopen the approval tab if needed.";
    badgeClassName = "office-status-badge office-status-badge-warning";
    badgeLabel = "Awaiting approval";
    panelMessage = "Finish the Acre approval flow for this browser. If the tab was closed, Acre can reopen it.";
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
    heading = "Extension isn't active in this tab yet";
    description = bridgeRefreshAttemptedRef.current
      ? STORE_INSTALL_URL
        ? props.serverHasActiveToken && props.serverActiveTokenCount > 0
          ? `Your account already has ${pluralizeConnections(props.serverActiveTokenCount)} somewhere else. If Acre Listing Studio is installed here, make sure it can run on acresystem.us. Otherwise, open the Chrome Web Store and finish setup for this browser.`
          : "Acre still could not reach the extension from this tab after a refresh. If Acre Listing Studio is installed, make sure it can run on acresystem.us. Otherwise, open the Chrome Web Store and finish setup for this browser."
        : "Acre still could not reach the extension from this tab after a refresh. Reload the extension in Chrome, then refresh this page again."
      : "If Acre Listing Studio was already installed, this tab usually just needs one refresh so Acre can talk to it.";
    badgeClassName = "office-status-badge office-status-badge-neutral";
    badgeLabel = bridgeRefreshAttemptedRef.current
      ? STORE_INSTALL_URL
        ? "Needs setup"
        : "Needs reload"
      : "Refresh needed";
    panelMessage = bridgeRefreshAttemptedRef.current
      ? STORE_INSTALL_URL
        ? "If Acre Listing Studio is already installed, check that Chrome allows it on acresystem.us. Otherwise, open the Chrome Web Store and finish setup."
        : "Reload the installed extension in Chrome, then refresh this page again."
      : "Refresh this page once. If Acre Listing Studio was already installed, Chrome will attach it to this tab on reload.";
  } else if (browserConnectionState === "checking") {
    heading = "Checking this browser";
    description =
      "Acre is checking whether the Chrome extension is available in this browser.";
    badgeLabel = "Checking";
    panelMessage = "Checking extension status for this browser now.";
  }

  let actionLabel = "Check extension";
  if (browserConnectionState === "checking") {
    actionLabel = "Checking...";
  } else if (browserConnectionState === "connected") {
    actionLabel = "Connected in this browser";
  } else if (browserConnectionState === "pending" || isConnecting) {
    actionLabel = isConnecting ? "Connecting..." : "Finish approval";
  } else if (browserConnectionState === "disconnected") {
    actionLabel = "Connect Chrome extension";
  } else if (browserConnectionState === "not_installed") {
    actionLabel = bridgeRefreshAttemptedRef.current
      ? STORE_INSTALL_URL
        ? "Open extension setup"
        : "Reload extension"
      : "Refresh this tab";
  }

  const isActionDisabled =
    browserConnectionState === "checking" ||
    browserConnectionState === "connected" ||
    isConnecting;
  const isConnected = browserConnectionState === "connected";

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
      <div
        className={
          isConnected
            ? "listing-studio-banner-panel listing-studio-banner-panel-connected"
            : "listing-studio-banner-panel"
        }
      >
        <div className="listing-studio-banner-status">
          <span className={badgeClassName}>{badgeLabel}</span>
          <span className="listing-studio-banner-source-pill">
            StreetEasy + Zillow
          </span>
        </div>
        <p className="listing-studio-banner-meta">{panelMessage}</p>
        <div className="listing-studio-connect-action">
          {isConnected ? (
            <div
              aria-live="polite"
              className="listing-studio-connect-status"
              role="status"
            >
              {actionLabel}
            </div>
          ) : (
            <Button
              disabled={isActionDisabled}
              onClick={handleClick}
              variant="primary"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
