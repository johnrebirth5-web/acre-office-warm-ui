"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@acre/ui";
import { useI18n } from "../../../lib/i18n/client";
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

function pluralizeConnections(count: number, isZh: boolean) {
  if (isZh) {
    return `${count} 个有效连接`;
  }

  return `${count} active connection${count === 1 ? "" : "s"}`;
}

export function ListingStudioExtensionConnectAction(
  props: ExtensionConnectActionProps,
) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const extensionNotReachableMessage = isZh
    ? "Acre 暂时无法连接此标签页中的 Chrome 扩展。如果已经安装，请重载扩展后刷新本页。"
    : "Acre couldn't reach the Chrome extension on this tab. If it's already installed, reload the extension and refresh this page.";
  const extensionReloadMessage = isZh
    ? "Acre 扩展已停止响应。请重载扩展并刷新本页。"
    : "The Acre extension stopped responding. Reload the extension and refresh this page.";
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
          setStatusMessage(extensionReloadMessage);
          return;
        }

        setBrowserConnectionState("not_installed");
        setStatusMessage(extensionNotReachableMessage);
        reopenApprovalOnPendingRef.current = false;
      }
    }, 1500);
  }

  useEffect(() => {
    try {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get("extensionConnection") === "approved") {
        setStatusMessage(
          isZh ? "已完成授权，正在检查此浏览器。" : "Approval complete. Checking this browser now.",
        );
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
        setStatusMessage(
          isZh ? "无法连接 Acre 扩展。" : data.error || "Unable to reach the Acre extension.",
        );
        return;
      }

      const payload = (data.payload || {}) as ExtensionBridgePayload;

      if (payload.connectionState === "connected" && payload.extensionToken) {
        setIsConnecting(false);
        setBrowserConnectionState("connected");
        setStatusMessage(
          isZh
            ? "此浏览器已连接 Chrome 扩展。"
            : "Chrome extension connected in this browser.",
        );
        clearStoredApprovalReturn();
        return;
      }

      if (payload.connectionState === "pending") {
        setIsConnecting(false);
        setBrowserConnectionState("pending");
        setStatusMessage(
          shouldReopenApproval && reopenApprovalTab(payload)
            ? isZh
              ? "授权仍在等待中，Acre 已重新打开此浏览器的授权标签页。"
              : "Approval is still pending. Acre reopened the approval tab for this browser."
            : isZh
              ? "请完成此浏览器的 Acre 授权。如果授权标签页已关闭，点击“完成授权”即可重新打开。"
              : "Finish the Acre approval for this browser. If you closed the tab, click Finish approval and Acre will reopen it.",
        );
        return;
      }

      setIsConnecting(false);
      setBrowserConnectionState(
        bridgeReadyRef.current ? "disconnected" : "not_installed",
      );

      if (payload.connectionError) {
        setStatusMessage(isZh ? "扩展连接失败，请检查扩展状态后重试。" : payload.connectionError);
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
  }, [extensionNotReachableMessage, extensionReloadMessage, isZh]);

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
        setStatusMessage(
          isZh
            ? "正在刷新此标签页，以便 Acre 重新查找已安装的扩展。"
            : "Refreshing this tab so Acre can look for the installed extension again.",
        );
        try {
          window.sessionStorage.setItem(BRIDGE_REFRESH_STORAGE_KEY, "1");
        } catch {}
        window.location.reload();
        return;
      }

      if (STORE_INSTALL_URL) {
        setStatusMessage(
          isZh
            ? "请先从 Chrome Web Store 安装 Acre Listing Studio，然后回到这里点击“检查扩展”。"
            : "Install Acre Listing Studio from the Chrome Web Store, then come back here and click Check extension.",
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
      setStatusMessage(extensionNotReachableMessage);
      return;
    }

    setIsConnecting(true);
    setStatusMessage("");
    sendExtensionRequest("START_CONNECT");
  }

  let heading = isZh ? "检查此浏览器" : "Check this browser";
  let description =
    isZh
      ? "点击“检查扩展”，让 Acre 确认此浏览器是否可以使用 Chrome 扩展。"
      : "Click Check extension when you want Acre to verify whether the Chrome extension is available in this browser.";
  let badgeClassName = "office-status-badge office-status-badge-neutral";
  let badgeLabel = isZh ? "手动检查" : "Manual check";
  let panelMessage =
    isZh
      ? "只有点击下方按钮时，Acre 才会检查此浏览器。"
      : "Acre will only check this browser when you click the button below.";

  if (browserConnectionState === "connected") {
    heading = isZh ? "此浏览器已连接" : "Connected in this browser";
    description =
      props.serverHasActiveToken && props.serverActiveTokenCount > 0
        ? isZh
          ? `此浏览器可以保存房源。你的账号当前有 ${pluralizeConnections(props.serverActiveTokenCount, isZh)}。最近连接：${props.serverLatestConnectedAtLabel}。`
          : `This browser is ready to save listings. Your account currently has ${pluralizeConnections(props.serverActiveTokenCount, isZh)}. Latest link: ${props.serverLatestConnectedAtLabel}.`
        : isZh
          ? "此浏览器已经可以把房源保存到 Acre。"
          : "This browser is ready to save listings into Acre.";
    badgeClassName = "office-status-badge office-status-badge-success";
    badgeLabel = isZh ? "已连接" : "Connected";
    panelMessage = isZh
      ? "此浏览器现在可以直接从 StreetEasy 和 Zillow 保存房源。"
      : "This browser can now save listings directly from StreetEasy and Zillow.";
  } else if (browserConnectionState === "pending") {
    heading = isZh ? "完成此浏览器授权" : "Finish approval for this browser";
    description =
      isZh
        ? "Acre 正在等待浏览器授权。点击“完成授权”，Acre 会在需要时重新打开授权标签页。"
        : "Acre is waiting for browser approval. Click Finish approval and Acre will reopen the approval tab if needed.";
    badgeClassName = "office-status-badge office-status-badge-warning";
    badgeLabel = isZh ? "等待授权" : "Awaiting approval";
    panelMessage = isZh
      ? "完成此浏览器的 Acre 授权流程；如果标签页已关闭，Acre 可以重新打开。"
      : "Finish the Acre approval flow for this browser. If the tab was closed, Acre can reopen it.";
  } else if (browserConnectionState === "disconnected") {
    heading = isZh ? "此浏览器可连接" : "Ready to connect in this browser";
    description =
      props.serverHasActiveToken && props.serverActiveTokenCount > 0
        ? isZh
          ? `此账号已在其他浏览器有 ${pluralizeConnections(props.serverActiveTokenCount, isZh)}。点击“连接 Chrome 扩展”即可连接此浏览器。`
          : `This account already has ${pluralizeConnections(props.serverActiveTokenCount, isZh)} on another browser. Click Connect Chrome extension to link this browser too.`
        : isZh
          ? "点击“连接 Chrome 扩展”，Acre 会自动打开授权页面。"
          : "Click Connect Chrome extension and Acre will open the approval page automatically.";
    badgeClassName = "office-status-badge office-status-badge-warning";
    badgeLabel = isZh ? "可连接" : "Ready to connect";
    panelMessage = isZh
      ? "连接此浏览器后，就可以从支持的页面直接保存房源。"
      : "Connect this browser to save listings directly from supported pages.";
  } else if (browserConnectionState === "not_installed") {
    heading = isZh ? "此标签页还未启用扩展" : "Extension isn't active in this tab yet";
    description = bridgeRefreshAttemptedRef.current
      ? STORE_INSTALL_URL
        ? props.serverHasActiveToken && props.serverActiveTokenCount > 0
          ? isZh
            ? `你的账号已经在其他位置有 ${pluralizeConnections(props.serverActiveTokenCount, isZh)}。如果这里已安装 Acre Listing Studio，请确认它允许在 acresystem.us 运行；否则请打开 Chrome Web Store 完成此浏览器设置。`
            : `Your account already has ${pluralizeConnections(props.serverActiveTokenCount, isZh)} somewhere else. If Acre Listing Studio is installed here, make sure it can run on acresystem.us. Otherwise, open the Chrome Web Store and finish setup for this browser.`
          : isZh
            ? "刷新后 Acre 仍无法连接此标签页中的扩展。如果已安装 Acre Listing Studio，请确认它允许在 acresystem.us 运行；否则请打开 Chrome Web Store 完成此浏览器设置。"
            : "Acre still could not reach the extension from this tab after a refresh. If Acre Listing Studio is installed, make sure it can run on acresystem.us. Otherwise, open the Chrome Web Store and finish setup for this browser."
        : isZh
          ? "刷新后 Acre 仍无法连接此标签页中的扩展。请在 Chrome 中重载扩展，然后再次刷新本页。"
          : "Acre still could not reach the extension from this tab after a refresh. Reload the extension in Chrome, then refresh this page again."
      : isZh
        ? "如果已经安装 Acre Listing Studio，通常刷新一次此标签页即可让 Acre 识别扩展。"
        : "If Acre Listing Studio was already installed, this tab usually just needs one refresh so Acre can talk to it.";
    badgeClassName = "office-status-badge office-status-badge-neutral";
    badgeLabel = bridgeRefreshAttemptedRef.current
      ? STORE_INSTALL_URL
        ? isZh
          ? "需要设置"
          : "Needs setup"
        : isZh
          ? "需要重载"
          : "Needs reload"
      : isZh
        ? "需要刷新"
        : "Refresh needed";
    panelMessage = bridgeRefreshAttemptedRef.current
      ? STORE_INSTALL_URL
        ? isZh
          ? "如果已安装 Acre Listing Studio，请检查 Chrome 是否允许它在 acresystem.us 运行；否则请打开 Chrome Web Store 完成设置。"
          : "If Acre Listing Studio is already installed, check that Chrome allows it on acresystem.us. Otherwise, open the Chrome Web Store and finish setup."
        : isZh
          ? "请在 Chrome 中重载已安装扩展，然后再次刷新本页。"
          : "Reload the installed extension in Chrome, then refresh this page again."
      : isZh
        ? "刷新本页一次。如果已经安装 Acre Listing Studio，Chrome 会在重新载入后把扩展接入此标签页。"
        : "Refresh this page once. If Acre Listing Studio was already installed, Chrome will attach it to this tab on reload.";
  } else if (browserConnectionState === "checking") {
    heading = isZh ? "正在检查此浏览器" : "Checking this browser";
    description =
      isZh
        ? "Acre 正在检查此浏览器是否可以使用 Chrome 扩展。"
        : "Acre is checking whether the Chrome extension is available in this browser.";
    badgeLabel = isZh ? "检查中" : "Checking";
    panelMessage = isZh
      ? "正在检查此浏览器的扩展状态。"
      : "Checking extension status for this browser now.";
  }

  let actionLabel = isZh ? "检查扩展" : "Check extension";
  if (browserConnectionState === "checking") {
    actionLabel = isZh ? "正在检查..." : "Checking...";
  } else if (browserConnectionState === "connected") {
    actionLabel = isZh ? "此浏览器已连接" : "Connected in this browser";
  } else if (browserConnectionState === "pending" || isConnecting) {
    actionLabel = isConnecting
      ? isZh
        ? "正在连接..."
        : "Connecting..."
      : isZh
        ? "完成授权"
        : "Finish approval";
  } else if (browserConnectionState === "disconnected") {
    actionLabel = isZh ? "连接 Chrome 扩展" : "Connect Chrome extension";
  } else if (browserConnectionState === "not_installed") {
    actionLabel = bridgeRefreshAttemptedRef.current
      ? STORE_INSTALL_URL
        ? isZh
          ? "打开扩展设置"
          : "Open extension setup"
        : isZh
          ? "重载扩展"
          : "Reload extension"
      : isZh
        ? "刷新此标签页"
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
        <span className="listing-studio-banner-kicker">
          {isZh ? "当前浏览器" : "Current browser"}
        </span>
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
