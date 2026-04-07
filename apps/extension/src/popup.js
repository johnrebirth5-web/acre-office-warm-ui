const elements = {
  baseUrl: document.getElementById("baseUrl"),
  connectionBadge: document.getElementById("connectionBadge"),
  connectionCopy: document.getElementById("connectionCopy"),
  connectButton: document.getElementById("connectButton"),
  disconnectButton: document.getElementById("disconnectButton"),
  saveCopy: document.getElementById("saveCopy"),
  openLastButton: document.getElementById("openLastButton"),
};

async function sendMessage(message) {
  if (!chrome?.runtime?.id) {
    return {
      ok: false,
      connectionState: "disconnected",
      connectionError: "The Acre extension reloaded. Close and reopen the popup.",
      lastSaveResult: null,
      baseUrl: elements.baseUrl?.value || "",
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
        connectionState: "disconnected",
        connectionError: "The Acre extension reloaded. Close and reopen the popup.",
        lastSaveResult: null,
        baseUrl: elements.baseUrl?.value || "",
      };
    }
    throw error;
  }
}

function setBadge(label, tone) {
  elements.connectionBadge.textContent = label;
  elements.connectionBadge.className = `popup-badge${tone ? ` ${tone}` : ""}`;
}

async function refreshState() {
  const state = await sendMessage({ type: "CHECK_CONNECTION_STATUS" });
  elements.baseUrl.value = state.baseUrl || "";

  if (state.connectionState === "connected" && state.extensionToken) {
    setBadge("Connected", "success");
    elements.connectionCopy.textContent = state.connectedOrganizationName
      ? `Connected to ${state.connectedOrganizationName} as ${state.connectedMembershipLabel || "Acre user"}.`
      : "The extension is connected to Acre.";
  } else if (state.connectionState === "pending") {
    setBadge("Awaiting approval", "warning");
    elements.connectionCopy.textContent =
      "Finish the Acre approval page in your browser. This popup will complete the connection automatically once approved.";
  } else if (state.connectionError) {
    setBadge("Disconnected", "danger");
    elements.connectionCopy.textContent = state.connectionError;
  } else {
    setBadge("Disconnected", "");
    elements.connectionCopy.textContent =
      "Connect the extension to Acre to save supported listing pages into Listing Studio.";
  }

  if (state.lastSaveResult?.detailUrl) {
    elements.saveCopy.textContent = `Last packet saved ${new Date(state.lastSaveResult.savedAt).toLocaleString()}.`;
    elements.openLastButton.disabled = false;
    elements.openLastButton.dataset.detailUrl = state.lastSaveResult.detailUrl;
  } else {
    elements.saveCopy.textContent =
      "No listing has been saved from the extension yet.";
    elements.openLastButton.disabled = true;
    delete elements.openLastButton.dataset.detailUrl;
  }
}

elements.baseUrl.addEventListener("change", async () => {
  await sendMessage({
    type: "SET_BASE_URL",
    baseUrl: elements.baseUrl.value,
  });
  await refreshState();
});

elements.connectButton.addEventListener("click", async () => {
  await sendMessage({
    type: "SET_BASE_URL",
    baseUrl: elements.baseUrl.value,
  });
  await sendMessage({ type: "START_CONNECT" });
  await refreshState();
});

elements.disconnectButton.addEventListener("click", async () => {
  await sendMessage({ type: "DISCONNECT" });
  await refreshState();
});

elements.openLastButton.addEventListener("click", async () => {
  const detailUrl = elements.openLastButton.dataset.detailUrl;
  if (!detailUrl) {
    return;
  }

  await chrome.tabs.create({ url: detailUrl });
});

refreshState();
setInterval(refreshState, 2000);
