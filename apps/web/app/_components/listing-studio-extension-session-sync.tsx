"use client";

import { useEffect } from "react";

const PAGE_SOURCE = "acre-listing-studio-dashboard";
const EXTENSION_SOURCE = "acre-listing-studio-extension";
const REQUEST_TYPE = "ACRE_LISTING_STUDIO_EXTENSION_REQUEST";
const RESPONSE_TYPE = "ACRE_LISTING_STUDIO_EXTENSION_RESPONSE";

type ExtensionMessageAction = "GET_CONFIG" | "DISCONNECT";
type ExtensionBridgePayload = {
  connectionState?: string;
  extensionToken?: string | null;
};

function createRequestId() {
  return `ls-sync-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sendExtensionRequest(action: ExtensionMessageAction) {
  return new Promise<ExtensionBridgePayload | null>((resolve) => {
    const requestId = createRequestId();

    function cleanup() {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timeoutId);
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window) {
        return;
      }

      const data = event.data;
      if (
        !data ||
        data.source !== EXTENSION_SOURCE ||
        data.type !== RESPONSE_TYPE ||
        data.requestId !== requestId
      ) {
        return;
      }

      cleanup();
      resolve((data.payload ?? null) as ExtensionBridgePayload | null);
    }

    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 1500);

    window.addEventListener("message", handleMessage);
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
  });
}

type ListingStudioExtensionSessionSyncProps = {
  currentMembershipId: string;
};

export function ListingStudioExtensionSessionSync(
  props: ListingStudioExtensionSessionSyncProps,
) {
  useEffect(() => {
    let cancelled = false;

    async function syncExtensionSession() {
      const payload = await sendExtensionRequest("GET_CONFIG");

      if (
        cancelled ||
        payload?.connectionState !== "connected" ||
        !payload.extensionToken
      ) {
        return;
      }

      const response = await fetch(
        "/api/listing-studio/extension/connect/session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            extensionToken: payload.extensionToken,
          }),
        },
      ).catch(() => null);

      if (!response || cancelled) {
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            tokenValid?: boolean;
            matchesCurrentMembership?: boolean;
          }
        | null;

      if (
        cancelled ||
        response.ok === false ||
        !body ||
        (body.tokenValid && body.matchesCurrentMembership)
      ) {
        return;
      }

      await sendExtensionRequest("DISCONNECT");
    }

    void syncExtensionSession();

    return () => {
      cancelled = true;
    };
  }, [props.currentMembershipId]);

  return null;
}
