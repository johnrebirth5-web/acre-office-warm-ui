const PAGE_SOURCE = "acre-listing-studio-dashboard";
const EXTENSION_SOURCE = "acre-listing-studio-extension";
const REQUEST_TYPE = "ACRE_LISTING_STUDIO_EXTENSION_REQUEST";
const RESPONSE_TYPE = "ACRE_LISTING_STUDIO_EXTENSION_RESPONSE";
const READY_TYPE = "ACRE_LISTING_STUDIO_BRIDGE_READY";

function postToPage(message) {
  window.postMessage(
    {
      source: EXTENSION_SOURCE,
      ...message,
    },
    window.location.origin,
  );
}

function announceReady() {
  postToPage({
    type: READY_TYPE,
  });
}

async function sendToBackground(message) {
  if (!chrome?.runtime?.id) {
    return {
      ok: false,
      error:
        "The Acre extension is not available on this page. Reload the extension and refresh the dashboard.",
    };
  }

  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : String(error || "");

    if (
      messageText.includes("Extension context invalidated") ||
      messageText.includes("Receiving end does not exist")
    ) {
      return {
        ok: false,
        error:
          "The Acre extension reloaded. Refresh this page and try again.",
      };
    }

    throw error;
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window) {
    return;
  }

  const data = event.data;
  if (
    !data ||
    data.source !== PAGE_SOURCE ||
    data.type !== REQUEST_TYPE ||
    typeof data.requestId !== "string"
  ) {
    return;
  }

  void (async () => {
    try {
      if (typeof data.baseUrl === "string" && data.baseUrl.trim()) {
        await sendToBackground({
          type: "SET_BASE_URL",
          baseUrl: data.baseUrl,
        });
      }

      const payload = await sendToBackground({
        type: data.action,
      });

      postToPage({
        type: RESPONSE_TYPE,
        requestId: data.requestId,
        ok: payload?.ok !== false,
        payload,
        error: payload?.ok === false ? payload.error : null,
      });
    } catch (error) {
      postToPage({
        type: RESPONSE_TYPE,
        requestId: data.requestId,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to reach the Acre extension.",
      });
    }
  })();
});

announceReady();
window.setTimeout(announceReady, 250);
window.setTimeout(announceReady, 1200);
window.addEventListener("pageshow", announceReady);
