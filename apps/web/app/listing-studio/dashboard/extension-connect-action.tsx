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
  const currentRequestIdRef = useRef<string | null>(null);
  const currentRequestActionRef = useRef<ExtensionMessageAction | null>(null);
  const responseTimeoutRef = useRef<number | null>(null);

  function clearResponseTimeout() {
    if (responseTimeoutRef.current !== null) {
      window.clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
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
        if (bridgeReadyRef.current) {
          setBrowserConnectionState("disconnected");
          setStatusMessage(EXTENSION_RELOAD_MESSAGE);
          return;
        }

        setBrowserConnectionState("not_installed");
        setStatusMessage(EXTENSION_NOT_REACHABLE_MESSAGE);
      }
    }, 1500);
  }

  useEffect(() => {
    try {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get("extensionConnection") === "approved") {
        setStatusMessage("Approval complete. Click Check status to verify this browser.");
        currentUrl.searchParams.delete("extensionConnection");
        window.history.replaceState({}, "", currentUrl.toString());
      }
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

      const payload = data.payload || {};

      if (payload.connectionState === "connected" && payload.extensionToken) {
        setIsConnecting(false);
        setBrowserConnectionState("connected");
        setStatusMessage("Chrome extension connected in this browser.");
        return;
      }

      if (payload.connectionState === "pending") {
        setIsConnecting(false);
        setBrowserConnectionState("pending");
        setStatusMessage(
          "Approval tab is open. Finish approval there, then come back here and click Check status.",
        );
        return;
      }

      setIsConnecting(false);
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
    };
  }, []);

  function handleClick() {
    if (browserConnectionState === "idle" || browserConnectionState === "checking") {
      setBrowserConnectionState("checking");
      setStatusMessage("");
      sendExtensionRequest("GET_CONFIG");
      return;
    }

    if (browserConnectionState === "not_installed") {
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
    heading = "Approving this browser";
    description =
      "Finish the Acre approval tab that just opened, then come back here and click Check status.";
    badgeClassName = "office-status-badge office-status-badge-warning";
    badgeLabel = "Awaiting connection";
    panelMessage = "The approval tab is open. When you're done there, click Check status here.";
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
    heading = "Extension not available on this tab";
    description = STORE_INSTALL_URL
      ? props.serverHasActiveToken && props.serverActiveTokenCount > 0
        ? `Your account already has ${pluralizeConnections(props.serverActiveTokenCount)} somewhere else. If Acre Listing Studio is already installed here, reload the extension, then click Check extension again. Otherwise, open the Chrome Web Store and finish setup for this browser.`
        : "Acre could not confirm the extension from this tab yet. If Acre Listing Studio is already installed, reload it and then click Check extension again. Otherwise, open the Chrome Web Store and finish setup for this browser."
      : props.serverHasActiveToken && props.serverActiveTokenCount > 0
        ? `Your account already has ${pluralizeConnections(props.serverActiveTokenCount)} somewhere else, but this tab still needs the Acre Chrome extension installed or reloaded before you check again.`
        : "Install or reload the Acre Chrome extension in this browser, then click Check extension again.";
    badgeClassName = "office-status-badge office-status-badge-neutral";
    badgeLabel = STORE_INSTALL_URL ? "Needs setup" : "Extension missing";
    panelMessage = STORE_INSTALL_URL
      ? "Open the Chrome Web Store if you still need to install Acre Listing Studio, or reload the installed extension, then come back here and click Check extension."
      : "Install the Acre extension on this browser first. After Chrome adds it, come back here and click Check extension.";
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
    actionLabel = isConnecting ? "Connecting..." : "Check status";
  } else if (browserConnectionState === "disconnected") {
    actionLabel = "Connect Chrome extension";
  } else if (browserConnectionState === "not_installed") {
    actionLabel = STORE_INSTALL_URL
      ? "Open extension setup"
      : "Install or reload extension";
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
