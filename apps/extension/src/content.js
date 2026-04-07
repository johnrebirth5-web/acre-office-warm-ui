(function () {
  const PANEL_ID = "acre-listing-studio-root";
  const PANEL_WIDTH = 336;
  let currentUrl = "";
  let currentPayload = null;
  let currentConfig = null;
  const MINIMIZED_ICON_URL = chrome.runtime.getURL("icons/icon32.png");
  let panelState = {
    minimized: false,
    mode: "idle",
    message: "",
    detailUrl: null,
  };

  function trimText(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  function queryText(selectors, root = document) {
    for (const selector of selectors) {
      const node = root.querySelector(selector);
      const value = trimText(node?.textContent || "");
      if (value) {
        return value;
      }
    }
    return null;
  }

  function extractJsonLdNodes() {
    const nodes = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      const raw = script.textContent?.trim();
      if (!raw) {
        continue;
      }

      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          nodes.push(...parsed);
        } else if (parsed && typeof parsed === "object" && Array.isArray(parsed["@graph"])) {
          nodes.push(...parsed["@graph"]);
        } else {
          nodes.push(parsed);
        }
      } catch {}
    }
    return nodes.filter(Boolean);
  }

  function findLdNode(predicate) {
    return extractJsonLdNodes().find((node) => {
      try {
        return predicate(node || {});
      } catch {
        return false;
      }
    }) || null;
  }

  function parseMoneyValue(value) {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.replace(/[^0-9.-]+/g, "");
      if (!normalized) {
        return null;
      }
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  function findPriceText() {
    const selectors = [
      '[data-testid="price"]',
      '[class*="price"] strong',
      '[class*="price"]',
      'span[class*="price"]',
      'div[class*="price"]',
    ];
    const priced = queryText(selectors);
    if (priced && priced.includes("$")) {
      return priced;
    }

    const bodyText = document.body.innerText || "";
    const match = bodyText.match(/\$[0-9][0-9,]*(?:\.[0-9]+)?(?:\/mo)?/);
    return match ? match[0] : null;
  }

  function collectUniqueUrls(values) {
    const seen = new Set();
    const results = [];
    for (const value of values) {
      const normalized = trimText(value);
      if (!normalized || normalized.startsWith("data:")) {
        continue;
      }
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      results.push(normalized);
    }
    return results;
  }

  function collectImageUrls() {
    const ldImages = extractJsonLdNodes()
      .flatMap((node) => {
        const candidates = [];
        if (Array.isArray(node?.image)) {
          candidates.push(...node.image);
        } else if (typeof node?.image === "string") {
          candidates.push(node.image);
        }
        if (Array.isArray(node?.photo)) {
          candidates.push(...node.photo);
        } else if (typeof node?.photo === "string") {
          candidates.push(node.photo);
        }
        return candidates;
      });

    const domImages = [...document.images]
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean)
      .filter((src) => !/logo|avatar|icon|sprite/i.test(src));

    return collectUniqueUrls([...ldImages, ...domImages]).slice(0, 16);
  }

  function collectFloorPlans() {
    const candidates = [];
    for (const element of document.querySelectorAll("a, button")) {
      const label = trimText(element.textContent || "");
      if (!label || !/floor plan/i.test(label)) {
        continue;
      }
      const href = element.getAttribute("href");
      const src = element.getAttribute("data-src");
      const url = trimText(href) || trimText(src);
      if (url) {
        candidates.push({ label, url: new URL(url, location.href).toString() });
      }
    }
    return candidates;
  }

  function collectSectionTextItems(sectionTitles) {
    const items = [];
    for (const heading of document.querySelectorAll("h2, h3, h4")) {
      const title = trimText(heading.textContent || "");
      if (!title || !sectionTitles.some((candidate) => candidate.test(title))) {
        continue;
      }

      let sibling = heading.nextElementSibling;
      let depth = 0;
      while (sibling && depth < 6) {
        if (/^H[1-4]$/.test(sibling.tagName)) {
          break;
        }

        sibling
          .querySelectorAll("li, p, span, div")
          .forEach((node) => {
            const value = trimText(node.textContent || "");
            if (value && value.length <= 120) {
              items.push(value);
            }
          });
        sibling = sibling.nextElementSibling;
        depth += 1;
      }
    }

    return [...new Set(items)].slice(0, 18);
  }

  function extractDescription() {
    const selectors = [
      '[data-testid="description"]',
      '[data-testid="home-description-text"]',
      '[class*="description"] p',
      '[id*="description"] p',
    ];
    const direct = queryText(selectors);
    if (direct) {
      return direct;
    }

    const aboutHeading = [...document.querySelectorAll("h2, h3, h4")].find((node) =>
      /about|overview|description/i.test(node.textContent || ""),
    );
    if (aboutHeading) {
      const paragraph = aboutHeading.nextElementSibling?.querySelector("p") || aboutHeading.nextElementSibling;
      return trimText(paragraph?.textContent || "");
    }

    return null;
  }

  function buildFacts(ldNode, factsText) {
    const bedrooms =
      parseMoneyValue(ldNode?.numberOfBedroomsTotal) ||
      parseMoneyValue(ldNode?.numberOfRooms) ||
      parseMoneyValue(factsText.match(/([0-9.]+)\s*bed/i)?.[1]);
    const bathrooms =
      parseMoneyValue(ldNode?.numberOfBathroomsTotal) ||
      parseMoneyValue(factsText.match(/([0-9.]+)\s*bath/i)?.[1]);
    const sqft =
      parseMoneyValue(ldNode?.floorSize?.value) ||
      parseMoneyValue(factsText.match(/([0-9,]+)\s*(sq\.?\s*ft|sf)/i)?.[1]);

    return {
      bedrooms: bedrooms ? String(bedrooms) : null,
      bathrooms: bathrooms ? String(bathrooms) : null,
      sqft: sqft || null,
    };
  }

  function parseStreetEasyPayload() {
    const ldResidence =
      findLdNode((node) => node["@type"] && String(node["@type"]).toLowerCase().includes("residence")) ||
      findLdNode((node) => node.address);
    const ldOffer = findLdNode((node) => node.offers || node.price);
    const factsText = document.body.innerText || "";
    const title =
      queryText(["h1", '[data-testid="address"]']) ||
      trimText(ldResidence?.name) ||
      document.title.replace(/\s*\|\s*StreetEasy.*$/, "");
    const address =
      trimText(ldResidence?.address?.streetAddress) ||
      title;
    const city = trimText(ldResidence?.address?.addressLocality) || queryText(['[data-testid="city-state-zip"]']);
    const state = trimText(ldResidence?.address?.addressRegion);
    const postalCode = trimText(ldResidence?.address?.postalCode);
    const priceText = findPriceText();
    const price =
      parseMoneyValue(ldOffer?.offers?.price) ||
      parseMoneyValue(ldOffer?.price) ||
      parseMoneyValue(priceText);
    const facts = buildFacts(ldResidence, factsText);
    const amenities = collectSectionTextItems([/amenities/i, /home features/i, /building amenities/i]);
    const transit = collectSectionTextItems([/nearby transit/i, /transportation/i]).map((item) => ({
      label: item,
    }));
    const floorPlans = collectFloorPlans();
    const imageUrls = collectImageUrls();

    return {
      sourceSite: "streeteasy",
      sourceUrl: location.href,
      title,
      address,
      city,
      state,
      postalCode,
      buildingName:
        queryText(["[class*='building'] a", "[class*='building']"]) ||
        trimText(ldResidence?.containedInPlace?.name),
      listingType: /for rent|\/mo/i.test(priceText || "") ? "rent" : "sale",
      statusLabel:
        queryText(["[class*='status']", "[data-testid='listing-status']"]) ||
        null,
      price,
      priceLabel: priceText,
      bedrooms: facts.bedrooms,
      bathrooms: facts.bathrooms,
      sqft: facts.sqft,
      descriptionText: extractDescription(),
      amenities: amenities.length ? { "Amenities & building": amenities } : [],
      transit,
      floorPlans,
      assetUrls: imageUrls,
    };
  }

  function parseZillowPayload() {
    const ldResidence =
      findLdNode((node) => node.address) ||
      findLdNode((node) => node["@type"] && String(node["@type"]).toLowerCase().includes("house"));
    const title =
      queryText(['h1[data-testid="address"]', "h1"]) ||
      trimText(ldResidence?.name) ||
      document.title.replace(/\s*\|\s*Zillow.*$/, "");
    const address =
      trimText(ldResidence?.address?.streetAddress) ||
      title;
    const city =
      trimText(ldResidence?.address?.addressLocality) ||
      queryText(['[data-testid="city-state-zip"]']);
    const state = trimText(ldResidence?.address?.addressRegion);
    const postalCode = trimText(ldResidence?.address?.postalCode);
    const priceText = findPriceText();
    const price =
      parseMoneyValue(ldResidence?.offers?.price) ||
      parseMoneyValue(priceText);
    const factsText = document.body.innerText || "";
    const facts = buildFacts(ldResidence, factsText);
    const amenities = collectSectionTextItems([/amenities/i, /features/i]);
    const transit = collectSectionTextItems([/nearby schools/i, /commute/i, /transit/i]).map((item) => ({
      label: item,
    }));
    const floorPlans = collectFloorPlans();
    const imageUrls = collectImageUrls();

    return {
      sourceSite: "zillow",
      sourceUrl: location.href,
      title,
      address,
      city,
      state,
      postalCode,
      buildingName: queryText(["[class*='building']", "[class*='community']"]),
      listingType: /rent/i.test(document.body.innerText || "") ? "rent" : "sale",
      statusLabel:
        queryText(["[data-testid='home-status']", "[class*='status']"]) ||
        null,
      price,
      priceLabel: priceText,
      bedrooms: facts.bedrooms,
      bathrooms: facts.bathrooms,
      sqft: facts.sqft,
      descriptionText: extractDescription(),
      amenities: amenities.length ? { "Amenities & features": amenities } : [],
      transit,
      floorPlans,
      assetUrls: imageUrls,
    };
  }

  function buildPayload() {
    const host = location.hostname.toLowerCase();
    const isStreetEasy = host.includes("streeteasy.com");
    const isZillow = host.includes("zillow.com");

    if (!isStreetEasy && !isZillow) {
      return null;
    }

    const sitePayload = isStreetEasy
      ? parseStreetEasyPayload()
      : parseZillowPayload();
    const title = trimText(sitePayload.title);
    const priceLabel = trimText(sitePayload.priceLabel);

    if (!title || !priceLabel) {
      return null;
    }

    const addressLine = trimText(sitePayload.address) || title;
    const assets = sitePayload.assetUrls.map((url, index) => ({
      kind: index === 0 ? "hero" : "gallery",
      url,
      label: index === 0 ? "Hero image" : `Gallery image ${index + 1}`,
      sortOrder: index,
    }));
    for (const [index, plan] of sitePayload.floorPlans.entries()) {
      assets.push({
        kind: "floor_plan",
        url: plan.url,
        label: plan.label || `Floor plan ${index + 1}`,
        sortOrder: assets.length + index,
      });
    }

    return {
      preview: {
        sourceSite: sitePayload.sourceSite,
        title,
        addressLine,
        priceLabel,
        factsLine: [
          sitePayload.bedrooms ? `${sitePayload.bedrooms} bd` : null,
          sitePayload.bathrooms ? `${sitePayload.bathrooms} ba` : null,
          sitePayload.sqft ? `${sitePayload.sqft.toLocaleString()} sf` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        imageUrls: sitePayload.assetUrls.slice(0, 4),
      },
      payload: {
        sourceSite: sitePayload.sourceSite,
        sourceUrl: location.href,
        rawHtml: document.documentElement.outerHTML,
        canonicalFields: {
          title,
          streetAddress: addressLine,
          city: sitePayload.city,
          state: sitePayload.state,
          postalCode: sitePayload.postalCode,
          buildingName: sitePayload.buildingName,
          listingType: sitePayload.listingType,
          statusLabel: sitePayload.statusLabel,
          price: sitePayload.price,
          priceLabel,
          bedrooms: sitePayload.bedrooms,
          bathrooms: sitePayload.bathrooms,
          sqft: sitePayload.sqft,
          descriptionText: sitePayload.descriptionText,
          amenities: sitePayload.amenities,
          transit: sitePayload.transit,
          floorPlans: sitePayload.floorPlans,
        },
        assets,
      },
    };
  }

  async function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
  }

  function createShadowPanel() {
    let host = document.getElementById(PANEL_ID);
    if (host) {
      return host.shadowRoot;
    }

    host = document.createElement("div");
    host.id = PANEL_ID;
    host.style.position = "fixed";
    host.style.right = "20px";
    host.style.bottom = "20px";
    host.style.zIndex = "2147483647";
    document.documentElement.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    return shadowRoot;
  }

  function renderPanel() {
    if (!currentPayload) {
      const existing = document.getElementById(PANEL_ID);
      if (existing) {
        existing.remove();
      }
      return;
    }

    const shadowRoot = createShadowPanel();
    const { preview } = currentPayload;
    const isConnected = currentConfig?.connectionState === "connected";
    const isPending = currentConfig?.connectionState === "pending";
    const statusText =
      panelState.mode === "saved"
        ? "Saved to Listing Studio"
        : panelState.mode === "saving"
          ? "Saving to Acre..."
          : panelState.mode === "error"
            ? panelState.message || "Acre save error"
            : isConnected
              ? "Connected to Acre"
              : isPending
                ? "Awaiting Acre approval"
                : "Connect Acre to save";

    const imagesHtml = preview.imageUrls
      .map(
        (src) =>
          `<img alt="" src="${src.replace(/"/g, "&quot;")}" />`,
      )
      .join("");

    if (panelState.minimized) {
      shadowRoot.innerHTML = `
        <style>
          .acre-launcher {
            width: 56px;
            height: 56px;
            display: grid;
            place-items: center;
            border: 1px solid rgba(20, 74, 119, 0.14);
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.98);
            box-shadow: 0 18px 48px rgba(22, 36, 51, 0.18);
            cursor: pointer;
          }
          .acre-launcher img {
            width: 30px;
            height: 30px;
            object-fit: contain;
            display: block;
          }
        </style>
        <button class="acre-launcher" data-action="restore" type="button" aria-label="Open Acre Listing Studio">
          <img alt="Acre" src="${MINIMIZED_ICON_URL}" />
        </button>
      `;

      shadowRoot.querySelector('[data-action="restore"]')?.addEventListener("click", () => {
        panelState.minimized = false;
        renderPanel();
      });
      return;
    }

    shadowRoot.innerHTML = `
      <style>
        .acre-panel {
          width: ${PANEL_WIDTH}px;
          display: grid;
          gap: 12px;
          padding: 14px;
          border: 1px solid rgba(20, 74, 119, 0.12);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 24px 64px rgba(22, 36, 51, 0.18);
          color: #162433;
          font-family: Arial, sans-serif;
        }
        .acre-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .acre-brand {
          display: grid;
          gap: 2px;
        }
        .acre-brand span {
          color: #52708f;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .acre-brand strong {
          font-size: 17px;
        }
        .acre-controls {
          display: flex;
          gap: 6px;
        }
        .acre-icon-button {
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 999px;
          background: #edf3fb;
          color: #144a77;
          cursor: pointer;
        }
        .acre-status {
          padding: 8px 10px;
          border-radius: 12px;
          background: ${
            panelState.mode === "error"
              ? "#fde8e8"
              : panelState.mode === "saved"
                ? "#e6f7ef"
                : isConnected
                  ? "#edf3fb"
                  : "#fff4e5"
          };
          color: ${
            panelState.mode === "error"
              ? "#b42318"
              : panelState.mode === "saved"
                ? "#1f7a57"
                : isConnected
                  ? "#144a77"
                  : "#915b08"
          };
          font-size: 12px;
          line-height: 1.4;
        }
        .acre-body {
          display: grid;
          gap: 12px;
        }
        .acre-preview {
          display: grid;
          gap: 8px;
        }
        .acre-preview strong {
          font-size: 15px;
        }
        .acre-preview span {
          color: #5d6e84;
          font-size: 12px;
          line-height: 1.4;
        }
        .acre-image-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 6px;
        }
        .acre-image-row img {
          width: 100%;
          height: 54px;
          object-fit: cover;
          border-radius: 10px;
          background: #eef2f6;
        }
        .acre-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .acre-button {
          border: 0;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .acre-button.primary {
          background: #144a77;
          color: #fff;
        }
        .acre-button.secondary {
          background: #edf3fb;
          color: #144a77;
        }
      </style>
      <section class="acre-panel">
        <div class="acre-header">
          <div class="acre-brand">
            <span>Acre</span>
            <strong>Listing Studio</strong>
          </div>
          <div class="acre-controls">
            <button class="acre-icon-button" data-action="minimize" type="button">–</button>
          </div>
        </div>
        <div class="acre-status">${statusText}</div>
        <div class="acre-body">
          <div class="acre-preview">
            <strong>${preview.title}</strong>
            <span>${preview.addressLine}</span>
            <span>${preview.priceLabel}</span>
            ${preview.factsLine ? `<span>${preview.factsLine}</span>` : ""}
          </div>
          ${imagesHtml ? `<div class="acre-image-row">${imagesHtml}</div>` : ""}
          <div class="acre-actions">
            <button class="acre-button primary" data-action="save" type="button">
              ${panelState.mode === "saving" ? "Saving..." : "Save to Acre"}
            </button>
            ${
              !isConnected
                ? `<button class="acre-button secondary" data-action="connect" type="button">${
                    isPending ? "Check approval" : "Connect Acre"
                  }</button>`
                : ""
            }
            ${
              panelState.detailUrl
                ? `<button class="acre-button secondary" data-action="open" type="button">Open in Acre</button>`
                : ""
            }
          </div>
        </div>
      </section>
    `;

    shadowRoot.querySelector('[data-action="minimize"]')?.addEventListener("click", () => {
      panelState.minimized = true;
      renderPanel();
    });
    shadowRoot.querySelector('[data-action="connect"]')?.addEventListener("click", async () => {
      if (currentConfig?.connectionState === "pending") {
        currentConfig = await sendMessage({ type: "CHECK_CONNECTION_STATUS" });
      } else {
        currentConfig = await sendMessage({ type: "START_CONNECT" });
      }
      renderPanel();
    });
    shadowRoot.querySelector('[data-action="open"]')?.addEventListener("click", async () => {
      if (!panelState.detailUrl) {
        return;
      }
      window.open(panelState.detailUrl, "_blank", "noopener,noreferrer");
    });
    shadowRoot.querySelector('[data-action="save"]')?.addEventListener("click", async () => {
      panelState.mode = "saving";
      panelState.message = "";
      renderPanel();

      const result = await sendMessage({
        type: "SAVE_LISTING",
        payload: currentPayload.payload,
      });

      if (result?.ok) {
        panelState.mode = "saved";
        panelState.detailUrl = result.detailUrl || null;
        panelState.message = "Saved to Listing Studio";
      } else {
        panelState.mode = "error";
        panelState.message = result?.error || "Unable to save the listing into Acre.";
        if (result?.errorCode === "TOKEN_INVALID" || result?.errorCode === "NOT_CONNECTED") {
          currentConfig = await sendMessage({ type: "GET_CONFIG" });
        }
      }

      renderPanel();
    });
  }

  async function refresh() {
    const payload = buildPayload();
    if (!payload) {
      currentPayload = null;
      renderPanel();
      return;
    }

    currentPayload = payload;
    currentConfig = await sendMessage({ type: "CHECK_CONNECTION_STATUS" });
    renderPanel();
  }

  function boot() {
    currentUrl = location.href;
    refresh();
    setInterval(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        panelState = {
          minimized: false,
          mode: "idle",
          message: "",
          detailUrl: null,
        };
      }
      refresh();
    }, 2500);
  }

  boot();
})();
