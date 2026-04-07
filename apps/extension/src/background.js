const STORAGE_KEYS = {
  baseUrl: "acreBaseUrl",
  extensionToken: "acreExtensionToken",
  connectionState: "acreConnectionState",
  challengeToken: "acreChallengeToken",
  challengeExpiresAt: "acreChallengeExpiresAt",
  connectedOrganizationName: "acreConnectedOrganizationName",
  connectedMembershipLabel: "acreConnectedMembershipLabel",
  tokenExpiresAt: "acreTokenExpiresAt",
  connectionError: "acreConnectionError",
  lastSaveResult: "acreLastSaveResult",
};

const DEFAULT_BASE_URL = "https://acresystem.us";

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function storageSet(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, resolve);
  });
}

function storageRemove(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") {
    return DEFAULT_BASE_URL;
  }

  return value.trim().replace(/\/+$/, "") || DEFAULT_BASE_URL;
}

async function getState() {
  const state = await storageGet(Object.values(STORAGE_KEYS));
  return {
    baseUrl: normalizeBaseUrl(state[STORAGE_KEYS.baseUrl]),
    extensionToken: state[STORAGE_KEYS.extensionToken] || null,
    connectionState: state[STORAGE_KEYS.connectionState] || "disconnected",
    challengeToken: state[STORAGE_KEYS.challengeToken] || null,
    challengeExpiresAt: state[STORAGE_KEYS.challengeExpiresAt] || null,
    connectedOrganizationName:
      state[STORAGE_KEYS.connectedOrganizationName] || null,
    connectedMembershipLabel:
      state[STORAGE_KEYS.connectedMembershipLabel] || null,
    tokenExpiresAt: state[STORAGE_KEYS.tokenExpiresAt] || null,
    connectionError: state[STORAGE_KEYS.connectionError] || null,
    lastSaveResult: state[STORAGE_KEYS.lastSaveResult] || null,
  };
}

async function setBaseUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  await storageSet({
    [STORAGE_KEYS.baseUrl]: normalized,
  });
  return normalized;
}

async function startConnectFlow() {
  const state = await getState();
  const response = await fetch(`${state.baseUrl}/api/listing-studio/extension/connect/start`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Unable to start the Acre connection flow.");
  }

  const body = await response.json();
  const approvalUrl = body.approvalUrl;
  const challengeToken = body.challengeToken;
  const expiresAt = body.expiresAt;

  await storageSet({
    [STORAGE_KEYS.connectionState]: "pending",
    [STORAGE_KEYS.challengeToken]: challengeToken,
    [STORAGE_KEYS.challengeExpiresAt]: expiresAt,
    [STORAGE_KEYS.connectionError]: null,
  });

  await chrome.tabs.create({ url: approvalUrl });

  return {
    connectionState: "pending",
    challengeToken,
    challengeExpiresAt: expiresAt,
  };
}

async function checkConnectionStatus() {
  const state = await getState();

  if (state.connectionState !== "pending" || !state.challengeToken) {
    return state;
  }

  const response = await fetch(
    `${state.baseUrl}/api/listing-studio/extension/connect/status?challengeToken=${encodeURIComponent(state.challengeToken)}`,
  );

  if (!response.ok) {
    const nextState = {
      [STORAGE_KEYS.connectionState]: "disconnected",
      [STORAGE_KEYS.connectionError]: "Unable to verify the Acre extension approval.",
    };
    await storageSet(nextState);
    return getState();
  }

  const body = await response.json();

  if (body.status === "approved" && body.extensionToken) {
    await storageSet({
      [STORAGE_KEYS.connectionState]: "connected",
      [STORAGE_KEYS.extensionToken]: body.extensionToken,
      [STORAGE_KEYS.connectedOrganizationName]:
        body.organizationName || null,
      [STORAGE_KEYS.connectedMembershipLabel]:
        body.membershipLabel || null,
      [STORAGE_KEYS.tokenExpiresAt]: body.expiresAt || null,
      [STORAGE_KEYS.challengeToken]: null,
      [STORAGE_KEYS.challengeExpiresAt]: null,
      [STORAGE_KEYS.connectionError]: null,
    });
    return getState();
  }

  if (body.status === "expired" || body.status === "consumed" || body.status === "not_found") {
    await storageSet({
      [STORAGE_KEYS.connectionState]: "disconnected",
      [STORAGE_KEYS.challengeToken]: null,
      [STORAGE_KEYS.challengeExpiresAt]: null,
      [STORAGE_KEYS.connectionError]:
        body.status === "expired"
          ? "The Acre approval request expired. Start the connection again."
          : "The Acre approval request is no longer active. Start the connection again.",
    });
    return getState();
  }

  return getState();
}

async function disconnect() {
  await storageRemove([
    STORAGE_KEYS.extensionToken,
    STORAGE_KEYS.connectedOrganizationName,
    STORAGE_KEYS.connectedMembershipLabel,
    STORAGE_KEYS.tokenExpiresAt,
    STORAGE_KEYS.challengeToken,
    STORAGE_KEYS.challengeExpiresAt,
    STORAGE_KEYS.connectionError,
  ]);
  await storageSet({
    [STORAGE_KEYS.connectionState]: "disconnected",
  });
  return getState();
}

async function saveListing(payload) {
  const state = await getState();

  if (!state.extensionToken) {
    return {
      ok: false,
      errorCode: "NOT_CONNECTED",
      error: "Connect the Acre extension before saving listings.",
    };
  }

  const response = await fetch(`${state.baseUrl}/api/listing-studio/imports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${state.extensionToken}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      await disconnect();
    }

    return {
      ok: false,
      errorCode: response.status === 401 ? "TOKEN_INVALID" : "SAVE_FAILED",
      error: body?.error || "Unable to save the listing into Acre.",
    };
  }

  const result = {
    ok: true,
    importId: body.importId,
    packId: body.packId,
    detailUrl: body.detailUrl,
    savedAt: new Date().toISOString(),
  };

  await storageSet({
    [STORAGE_KEYS.lastSaveResult]: result,
  });

  return result;
}

if (chrome?.runtime?.onInstalled?.addListener) {
  chrome.runtime.onInstalled.addListener(async () => {
    const state = await getState();
    if (!state.baseUrl) {
      await setBaseUrl(DEFAULT_BASE_URL);
    }
  });
}

if (chrome?.runtime?.onMessage?.addListener) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void (async () => {
      try {
        switch (message?.type) {
          case "GET_CONFIG": {
            sendResponse(await getState());
            return;
          }
          case "SET_BASE_URL": {
            const baseUrl = await setBaseUrl(message.baseUrl);
            sendResponse({ ok: true, baseUrl });
            return;
          }
          case "START_CONNECT": {
            sendResponse(await startConnectFlow());
            return;
          }
          case "CHECK_CONNECTION_STATUS": {
            sendResponse(await checkConnectionStatus());
            return;
          }
          case "DISCONNECT": {
            sendResponse(await disconnect());
            return;
          }
          case "SAVE_LISTING": {
            sendResponse(await saveListing(message.payload));
            return;
          }
          default: {
            sendResponse({ ok: false, error: "Unknown extension action." });
          }
        }
      } catch (error) {
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unexpected Acre extension error.",
        });
      }
    })();

    return true;
  });
}
