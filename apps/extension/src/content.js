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
  let deepCapturePreparedForUrl = null;

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

  function normalizeWhitespace(value) {
    return typeof value === "string"
      ? value.replace(/\s+/g, " ").trim()
      : "";
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function extractFirstMoneyLabel(value) {
    const matches = normalizeWhitespace(value).match(
      /\$[0-9][0-9,]*(?:\.[0-9]+)?(?:\/(?:mo|month|yr|year))?/gi,
    );
    return trimText(matches?.[0] || "");
  }

  function textLooksLikeDescription(value) {
    const normalized = normalizeWhitespace(value);
    if (!normalized || normalized.length < 16) {
      return false;
    }
    if (/^(show full description|read more|show more)$/i.test(normalized)) {
      return false;
    }
    if (/^\d+\s+units?$/i.test(normalized)) {
      return false;
    }
    return true;
  }

  function parseCityStatePostal(value) {
    const normalized = normalizeWhitespace(value);
    const match = normalized.match(/([A-Za-z .'-]+),\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/);
    if (!match) {
      return null;
    }

    return {
      city: trimText(match[1]),
      state: trimText(match[2]),
      postalCode: trimText(match[3]),
    };
  }

  function extractCityStatePostal(fallbackText = "") {
    const candidates = [
      queryText(['[data-testid="city-state-zip"]']),
      queryText(["[class*='city-state-zip']", "[class*='location']"]),
      fallbackText,
      document.body.innerText || "",
    ].filter(Boolean);

    for (const candidate of candidates) {
      const parsed = parseCityStatePostal(candidate);
      if (parsed) {
        return parsed;
      }
    }

    return {
      city: null,
      state: null,
      postalCode: null,
    };
  }

  function extractCoordinates(...candidates) {
    for (const candidate of candidates) {
      const latitude = parseMoneyValue(candidate?.latitude);
      const longitude = parseMoneyValue(candidate?.longitude);
      if (latitude !== null && longitude !== null) {
        return { latitude, longitude };
      }
    }

    const html = document.documentElement.innerHTML || "";
    const htmlMatch = html.match(
      /"latitude"\s*:\s*([0-9.+-]+)[^]*?"longitude"\s*:\s*([0-9.+-]+)/i,
    );
    if (htmlMatch) {
      const latitude = parseMoneyValue(htmlMatch[1]);
      const longitude = parseMoneyValue(htmlMatch[2]);
      if (latitude !== null && longitude !== null) {
        return { latitude, longitude };
      }
    }

    const mapSource = [...document.querySelectorAll("iframe, img, a")]
      .map((node) =>
        node.getAttribute("src") ||
        node.getAttribute("href") ||
        node.getAttribute("data-src") ||
        "",
      )
      .find((value) => /google\.com\/maps|maps\/place|staticmap/i.test(value || ""));
    if (mapSource) {
      const latLngMatch = mapSource.match(/([0-9.+-]+),([0-9.+-]+)/);
      if (latLngMatch) {
        const latitude = parseMoneyValue(latLngMatch[1]);
        const longitude = parseMoneyValue(latLngMatch[2]);
        if (latitude !== null && longitude !== null) {
          return { latitude, longitude };
        }
      }
    }

    return {
      latitude: null,
      longitude: null,
    };
  }

  function findRegexValue(patterns, sourceText) {
    const text = sourceText || "";
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const value = trimText(match?.[1] ?? match?.[0] ?? "");
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
      '[data-testid="price-label"]',
      '[aria-label*="price" i]',
      '[class*="price"] strong',
      '[class*="price"]',
      'span[class*="price"]',
      'div[class*="price"]',
    ];
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const priced = extractFirstMoneyLabel(node?.textContent || "");
      if (priced) {
        return priced;
      }
    }

    return extractFirstMoneyLabel(document.body.innerText || "");
  }

  function collectUniqueUrls(values) {
    const seen = new Set();
    const results = [];
    for (const value of values) {
      const trimmed = trimText(value);
      if (!trimmed || trimmed.startsWith("data:")) {
        continue;
      }

      let normalized = trimmed;
      try {
        normalized = new URL(trimmed, location.href).toString();
      } catch {
        continue;
      }

      if (!/^https?:/i.test(normalized)) {
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
      .filter((image) => {
        const src = image.currentSrc || image.src;
        if (!src || /logo|avatar|icon|sprite/i.test(src)) {
          return false;
        }
        return (image.naturalWidth || 0) >= 80 && (image.naturalHeight || 0) >= 80;
      })
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean);

    return collectUniqueUrls([...domImages, ...ldImages]).slice(0, 32);
  }

  function collectFloorPlans() {
    const seen = new Set();
    const candidates = [];

    function pushCandidate(label, url) {
      const trimmedUrl = trimText(url || "");
      if (!trimmedUrl) {
        return;
      }
      let normalizedUrl = trimmedUrl;
      try {
        normalizedUrl = new URL(trimmedUrl, location.href).toString();
      } catch {
        return;
      }

      if (!/^https?:/i.test(normalizedUrl) || seen.has(normalizedUrl)) {
        return;
      }

      seen.add(normalizedUrl);
      candidates.push({
        label: trimText(label) || "Floor plan",
        url: normalizedUrl,
      });
    }

    for (const element of document.querySelectorAll("a, button, img, source")) {
      const label = normalizeWhitespace(
        [
          element.textContent || "",
          element.getAttribute("aria-label") || "",
          element.getAttribute("title") || "",
          element.getAttribute("alt") || "",
        ].join(" "),
      );
      const urlCandidates = [
        element.getAttribute("href"),
        element.getAttribute("src"),
        element.getAttribute("data-src"),
        element.getAttribute("data-url"),
        element.getAttribute("data-image"),
        element.getAttribute("data-full"),
      ];

      if (
        /floor\s*plan/i.test(label) ||
        urlCandidates.some((candidate) => /floor[_-]?plan|floorplan/i.test(candidate || ""))
      ) {
        urlCandidates.forEach((candidate) => pushCandidate(label, candidate));
      }
    }

    for (const script of document.querySelectorAll("script")) {
      const raw = script.textContent || "";
      if (!/floor[_ -]?plan/i.test(raw)) {
        continue;
      }

      const absoluteMatches = raw.match(/https?:\/\/[^"'\\\s)]+/g) || [];
      const relativeMatches = raw.match(/\/[^"'\\\s)]+(?:floor[_-]?plan|floorplan)[^"'\\\s)]*/gi) || [];
      [...absoluteMatches, ...relativeMatches].forEach((candidate) =>
        pushCandidate("Floor plan", candidate),
      );
    }

    return candidates;
  }

  function collectSectionTextItems(sectionTitles) {
    const items = [];
    for (const heading of document.querySelectorAll("h2, h3, h4, h5, [role='heading']")) {
      const title = trimText(heading.textContent || "");
      if (!title || !sectionTitles.some((candidate) => candidate.test(title))) {
        continue;
      }

      let sibling = heading.nextElementSibling;
      let depth = 0;
      while (sibling && depth < 10) {
        if (/^H[1-4]$/.test(sibling.tagName)) {
          break;
        }

        sibling
          .querySelectorAll("li, p, span, div, a, button, article, [role='listitem']")
          .forEach((node) => {
            const value = normalizeWhitespace(node.textContent || "");
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

  function parseTransitLines(lines) {
    const normalizedLines = lines
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean);
    if (!normalizedLines.length) {
      return null;
    }

    const label = normalizedLines.find(
      (line) =>
        line.length <= 48 &&
        !/nearby transit|nearest station|within 500m|\+\s*\d+\s+more/i.test(line) &&
        !/^\d+\s*min(?:s)?\s*walk$/i.test(line) &&
        !/\b\d+\s+stations?\b/i.test(line),
    );
    if (!label) {
      return null;
    }

    const detail = normalizedLines.find(
      (line) =>
        line !== label &&
        (/\b(?:walk|station|train|subway)\b/i.test(line) || /\b\d+(?:\.\d+)?\s*(?:km|mi)\b/i.test(line)),
    );
    const distanceLabel = normalizedLines.find(
      (line) => line !== label && /^\d+\s*min(?:s)?$/i.test(line),
    );

    if (!detail && !distanceLabel) {
      return null;
    }

    return {
      label,
      detail: detail || null,
      distanceLabel: distanceLabel || null,
    };
  }

  function collectTransitItems() {
    const seen = new Set();
    const results = [];
    const headings = [...document.querySelectorAll("h2, h3, h4, h5, [role='heading']")].filter((heading) =>
      /nearby transit|transportation|subway|stations?|commute/i.test(heading.textContent || ""),
    );

    for (const heading of headings) {
      let sibling = heading.nextElementSibling;
      let depth = 0;

      while (sibling && depth < 10) {
        if (/^H[1-4]$/.test(sibling.tagName)) {
          break;
        }

        const candidates = [sibling, ...sibling.querySelectorAll("li, a, button, article, div, [role='listitem']")];
        for (const candidate of candidates) {
          const parsed = parseTransitLines((candidate.innerText || candidate.textContent || "").split(/\n+/));
          if (!parsed) {
            continue;
          }

          const key = `${parsed.label}::${parsed.distanceLabel || parsed.detail || ""}`;
          if (seen.has(key)) {
            continue;
          }

          seen.add(key);
          results.push(parsed);
        }

        sibling = sibling.nextElementSibling;
        depth += 1;
      }
    }

    return results.slice(0, 12);
  }

  function collectSectionBlocks(sectionTitles) {
    const blocks = [];

    for (const heading of document.querySelectorAll("h2, h3, h4, h5")) {
      const title = trimText(heading.textContent || "");
      if (!title || !sectionTitles.some((candidate) => candidate.test(title))) {
        continue;
      }

      let sibling = heading.nextElementSibling;
      let depth = 0;
      const items = [];

      while (sibling && depth < 8) {
        if (/^H[1-4]$/.test(sibling.tagName)) {
          break;
        }

        const scopedNodes = sibling.querySelectorAll("li, p, div, span, a");
        if (scopedNodes.length) {
          scopedNodes.forEach((node) => {
            const value = normalizeWhitespace(node.textContent || "");
            if (
              value &&
              value !== title &&
              value.length <= 180 &&
              value.length >= 2
            ) {
              items.push(value);
            }
          });
        } else {
          const value = normalizeWhitespace(sibling.textContent || "");
          if (value && value !== title && value.length <= 180) {
            items.push(value);
          }
        }

        sibling = sibling.nextElementSibling;
        depth += 1;
      }

      const uniqueItems = [...new Set(items)].slice(0, 24);
      if (uniqueItems.length) {
        blocks.push({ title, items: uniqueItems });
      }
    }

    return blocks;
  }

  function extractLabeledFacts(pageText) {
    const normalizedText = pageText || "";
    const commonChargesLabel = findRegexValue(
      [
        /common charges\s+(\$[0-9,]+(?:\.\d+)?(?:\/(?:mo|month|yr|year))?)/i,
        /maintenance\s+(\$[0-9,]+(?:\.\d+)?(?:\/(?:mo|month|yr|year))?)/i,
        /hoa(?: fees?)?\s+(\$[0-9,]+(?:\.\d+)?(?:\/(?:mo|month|yr|year))?)/i,
        /hoa\s*(\$\s*[0-9,]+(?:\.\d+)?(?:\/(?:mo|month|yr|year))?)/i,
      ],
      normalizedText,
    );
    const taxesLabel = findRegexValue(
      [
        /tax(?:es)?\s+(\$[0-9,]+(?:\.\d+)?(?:\/(?:mo|month|yr|year))?)/i,
        /taxes?\s*(\$\s*[0-9,]+(?:\.\d+)?(?:\/(?:mo|month|yr|year))?)/i,
      ],
      normalizedText,
    );
    const pricePerSquareFootLabel = findRegexValue(
      [
        /(\$[0-9,]+(?:\.\d+)?)\s+per\s*(?:ft²|sq\.?\s*ft|sf)/i,
        /price per(?: square)? foot\s+(\$[0-9,]+(?:\.\d+)?)/i,
      ],
      normalizedText,
    );
    const availabilityLabel = findRegexValue(
      [
        /(Available(?:\s+(?:Now|now|Immediately|immediately|[A-Z][a-z]{2,8}\s+\d{1,2}))?)/i,
        /availability\s+([A-Za-z]{3,12}\s+\d{1,2}|Available now|Now)/i,
        /(Available\s+[A-Z][a-z]{2,8}\s+\d{1,2})/i,
      ],
      normalizedText,
    );
    const leaseTermLabel = findRegexValue(
      [/(\d{1,2}(?:-\d{1,2})?\s*-\s*month lease|\d{1,2}-month lease)/i],
      normalizedText,
    );
    const netEffectiveLabel = findRegexValue(
      [/(Net:\s*\$[0-9,]+(?:\.\d+)?(?:\/mo)?(?:\s*\([^)]+\))?)/i],
      normalizedText,
    );
    const listedBy = findRegexValue(
      [/listed by\s+([A-Za-z0-9 .,&'/-]{2,120})/i],
      normalizedText,
    );
    const brokerLabel = findRegexValue(
      [/broker(?:age)?\s+([A-Za-z0-9 .,&'/-]{2,120})/i],
      normalizedText,
    );
    const propertyType = findRegexValue(
      [/\b(condo|co-op|coop|townhouse|house|rental unit|apartment|condop)\b/i],
      normalizedText,
    );
    const rooms = findRegexValue([/([0-9.]+)\s*rooms?/i], normalizedText);

    return {
      commonChargesLabel,
      taxesLabel,
      pricePerSquareFootLabel,
      availabilityLabel,
      leaseTermLabel,
      netEffectiveLabel,
      listedBy,
      brokerLabel,
      propertyType,
      rooms,
    };
  }

  function buildHeroFactsFromPayload(payload) {
    const facts = [
      payload.bedrooms ? { label: "Bedrooms", value: String(payload.bedrooms) } : null,
      payload.bathrooms ? { label: "Bathrooms", value: String(payload.bathrooms) } : null,
      payload.sqft ? { label: "Sqft", value: String(payload.sqft) } : null,
      payload.rooms ? { label: "Rooms", value: String(payload.rooms) } : null,
      payload.availabilityLabel ? { label: "Availability", value: payload.availabilityLabel } : null,
      payload.commonChargesLabel ? { label: "Common charges", value: payload.commonChargesLabel } : null,
      payload.taxesLabel ? { label: "Taxes", value: payload.taxesLabel } : null,
      payload.pricePerSquareFootLabel ? { label: "Price / ft", value: payload.pricePerSquareFootLabel } : null,
      payload.leaseTermLabel ? { label: "Lease term", value: payload.leaseTermLabel } : null,
    ].filter(Boolean);

    return facts.slice(0, 8);
  }

  function buildSourceFacts(payload) {
    return [
      payload.buildingName ? { label: "Building", value: payload.buildingName } : null,
      payload.propertyType ? { label: "Property type", value: payload.propertyType } : null,
      payload.listedBy ? { label: "Listed by", value: payload.listedBy } : null,
      payload.brokerLabel ? { label: "Broker", value: payload.brokerLabel } : null,
      payload.netEffectiveLabel ? { label: "Net effective", value: payload.netEffectiveLabel } : null,
      payload.commonChargesLabel ? { label: "Common charges", value: payload.commonChargesLabel } : null,
      payload.taxesLabel ? { label: "Taxes", value: payload.taxesLabel } : null,
    ].filter(Boolean);
  }

  function extractDescription(detailSections = []) {
    const aboutSection = detailSections.find((section) => /about|overview|description/i.test(section.title));
    const aboutCandidate = aboutSection?.items.find((item) => textLooksLikeDescription(item));
    if (aboutCandidate) {
      return aboutCandidate;
    }

    const metaDescription = trimText(
      document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
    );
    if (textLooksLikeDescription(metaDescription) && !/px-captcha/i.test(metaDescription || "")) {
      return metaDescription;
    }

    const selectors = [
      '[data-testid="description"]',
      '[data-testid="home-description-text"]',
      '[class*="description"] p',
      '[id*="description"] p',
    ];
    const direct = queryText(selectors);
    if (textLooksLikeDescription(direct)) {
      return direct;
    }

    const aboutHeading = [...document.querySelectorAll("h2, h3, h4")].find((node) =>
      /about|overview|description/i.test(node.textContent || ""),
    );
    if (aboutHeading) {
      const paragraph = aboutHeading.nextElementSibling?.querySelector("p") || aboutHeading.nextElementSibling;
      const value = trimText(paragraph?.textContent || "");
      if (textLooksLikeDescription(value)) {
        return value;
      }
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
      parseMoneyValue(factsText.match(/([0-9,]+)\s*(?:square\s*feet|sq(?:uare)?\.?\s*ft|sqft|sf)\b/i)?.[1]);

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
    const priceText = findPriceText();
    const price =
      parseMoneyValue(ldOffer?.offers?.price) ||
      parseMoneyValue(ldOffer?.price) ||
      parseMoneyValue(priceText);
    const facts = buildFacts(ldResidence, factsText);
    const labeledFacts = extractLabeledFacts(factsText);
    const amenities = collectSectionTextItems([/amenities/i, /home features/i, /building amenities/i]);
    const floorPlans = collectFloorPlans();
    const floorPlanUrlSet = new Set(floorPlans.map((plan) => plan.url).filter(Boolean));
    const imageUrls = collectImageUrls().filter((url) => !floorPlanUrlSet.has(url));
    const detailSections = collectSectionBlocks([
      /nearby transit/i,
      /transportation/i,
      /subway/i,
      /policies/i,
      /home features/i,
      /building amenities/i,
      /property details/i,
      /listing details/i,
      /price history/i,
      /listing history/i,
      /^about$/i,
    ]);
    const locationBits = extractCityStatePostal(
      queryText(['[data-testid="city-state-zip"]']) ||
      queryText(["[class*='city-state-zip']", "[class*='location']"]) ||
      "",
    );
    const coordinates = extractCoordinates(
      ldResidence?.geo,
      ldResidence?.address?.geo,
      ldOffer?.geo,
    );
    const transit = collectTransitItems();
    const descriptionText = extractDescription(detailSections);

    return {
      sourceSite: "streeteasy",
      sourceUrl: location.href,
      title,
      address,
      city: trimText(ldResidence?.address?.addressLocality) || locationBits.city,
      state: trimText(ldResidence?.address?.addressRegion) || locationBits.state,
      postalCode: trimText(ldResidence?.address?.postalCode) || locationBits.postalCode,
      buildingName:
        queryText(["[class*='building'] a", "[class*='building']"]) ||
        trimText(ldResidence?.containedInPlace?.name),
      listingType: /for rent|\/mo/i.test(`${priceText || ""} ${factsText}`) ? "rent" : "sale",
      statusLabel:
        queryText(["[class*='status']", "[data-testid='listing-status']"]) ||
        null,
      price,
      priceLabel: priceText,
      bedrooms: facts.bedrooms,
      bathrooms: facts.bathrooms,
      rooms: labeledFacts.rooms,
      sqft: facts.sqft,
      commonChargesLabel: labeledFacts.commonChargesLabel,
      taxesLabel: labeledFacts.taxesLabel,
      pricePerSquareFootLabel: labeledFacts.pricePerSquareFootLabel,
      availabilityLabel: labeledFacts.availabilityLabel,
      leaseTermLabel: labeledFacts.leaseTermLabel,
      netEffectiveLabel: labeledFacts.netEffectiveLabel,
      propertyType: labeledFacts.propertyType,
      listedBy: labeledFacts.listedBy,
      brokerLabel: labeledFacts.brokerLabel,
      descriptionText,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      heroFacts: buildHeroFactsFromPayload({
        ...facts,
        rooms: labeledFacts.rooms,
        availabilityLabel: labeledFacts.availabilityLabel,
        commonChargesLabel: labeledFacts.commonChargesLabel,
        taxesLabel: labeledFacts.taxesLabel,
        pricePerSquareFootLabel: labeledFacts.pricePerSquareFootLabel,
        leaseTermLabel: labeledFacts.leaseTermLabel,
      }),
      sourceFacts: buildSourceFacts({
        buildingName:
          queryText(["[class*='building'] a", "[class*='building']"]) ||
          trimText(ldResidence?.containedInPlace?.name),
        propertyType: labeledFacts.propertyType,
        listedBy: labeledFacts.listedBy,
        brokerLabel: labeledFacts.brokerLabel,
        netEffectiveLabel: labeledFacts.netEffectiveLabel,
        commonChargesLabel: labeledFacts.commonChargesLabel,
        taxesLabel: labeledFacts.taxesLabel,
      }),
      amenities: amenities.length ? { "Amenities & building": amenities } : [],
      transit,
      floorPlans,
      detailSections,
      propertyHistory: detailSections.filter((section) => /history/i.test(section.title)),
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
    const rawLocationText =
      queryText(['[data-testid="city-state-zip"]']) ||
      queryText(["[class*='city-state-zip']", "[class*='location']"]) ||
      "";
    const locationBits = extractCityStatePostal(rawLocationText);
    const city =
      trimText(ldResidence?.address?.addressLocality) ||
      locationBits.city;
    const priceText = findPriceText();
    const price =
      parseMoneyValue(ldResidence?.offers?.price) ||
      parseMoneyValue(priceText);
    const factsText = document.body.innerText || "";
    const facts = buildFacts(ldResidence, factsText);
    const labeledFacts = extractLabeledFacts(factsText);
    const amenities = collectSectionTextItems([/amenities/i, /features/i]);
    const floorPlans = collectFloorPlans();
    const floorPlanUrlSet = new Set(floorPlans.map((plan) => plan.url).filter(Boolean));
    const imageUrls = collectImageUrls().filter((url) => !floorPlanUrlSet.has(url));
    const detailSections = collectSectionBlocks([
      /nearby transit/i,
      /transportation/i,
      /commute/i,
      /transit/i,
      /price history/i,
      /property details/i,
      /home facts/i,
      /policies/i,
      /features/i,
      /^about$/i,
    ]);
    const coordinates = extractCoordinates(
      ldResidence?.geo,
      ldResidence?.address?.geo,
      ldResidence?.offers?.geo,
    );
    const transit = collectTransitItems();
    const descriptionText = extractDescription(detailSections);

    return {
      sourceSite: "zillow",
      sourceUrl: location.href,
      title,
      address,
      city,
      state: trimText(ldResidence?.address?.addressRegion) || locationBits.state,
      postalCode: trimText(ldResidence?.address?.postalCode) || locationBits.postalCode,
      buildingName: queryText(["[class*='building']", "[class*='community']"]),
      listingType: /rent/i.test(`${document.body.innerText || ""} ${priceText || ""}`) ? "rent" : "sale",
      statusLabel:
        queryText(["[data-testid='home-status']", "[class*='status']"]) ||
        null,
      price,
      priceLabel: priceText,
      bedrooms: facts.bedrooms,
      bathrooms: facts.bathrooms,
      rooms: labeledFacts.rooms,
      sqft: facts.sqft,
      commonChargesLabel: labeledFacts.commonChargesLabel,
      taxesLabel: labeledFacts.taxesLabel,
      pricePerSquareFootLabel: labeledFacts.pricePerSquareFootLabel,
      availabilityLabel: labeledFacts.availabilityLabel,
      leaseTermLabel: labeledFacts.leaseTermLabel,
      netEffectiveLabel: labeledFacts.netEffectiveLabel,
      propertyType: labeledFacts.propertyType,
      listedBy: labeledFacts.listedBy,
      brokerLabel: labeledFacts.brokerLabel,
      descriptionText,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      heroFacts: buildHeroFactsFromPayload({
        ...facts,
        rooms: labeledFacts.rooms,
        availabilityLabel: labeledFacts.availabilityLabel,
        commonChargesLabel: labeledFacts.commonChargesLabel,
        taxesLabel: labeledFacts.taxesLabel,
        pricePerSquareFootLabel: labeledFacts.pricePerSquareFootLabel,
        leaseTermLabel: labeledFacts.leaseTermLabel,
      }),
      sourceFacts: buildSourceFacts({
        buildingName: queryText(["[class*='building']", "[class*='community']"]),
        propertyType: labeledFacts.propertyType,
        listedBy: labeledFacts.listedBy,
        brokerLabel: labeledFacts.brokerLabel,
        netEffectiveLabel: labeledFacts.netEffectiveLabel,
        commonChargesLabel: labeledFacts.commonChargesLabel,
        taxesLabel: labeledFacts.taxesLabel,
      }),
      amenities: amenities.length ? { "Amenities & features": amenities } : [],
      transit,
      floorPlans,
      detailSections,
      propertyHistory: detailSections.filter((section) => /history/i.test(section.title)),
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
          latitude: sitePayload.latitude,
          longitude: sitePayload.longitude,
          buildingName: sitePayload.buildingName,
          listingType: sitePayload.listingType,
          statusLabel: sitePayload.statusLabel,
          price: sitePayload.price,
          priceLabel,
          bedrooms: sitePayload.bedrooms,
          bathrooms: sitePayload.bathrooms,
          rooms: sitePayload.rooms,
          sqft: sitePayload.sqft,
          availabilityLabel: sitePayload.availabilityLabel,
          commonChargesLabel: sitePayload.commonChargesLabel,
          taxesLabel: sitePayload.taxesLabel,
          pricePerSquareFootLabel: sitePayload.pricePerSquareFootLabel,
          leaseTermLabel: sitePayload.leaseTermLabel,
          netEffectiveLabel: sitePayload.netEffectiveLabel,
          propertyType: sitePayload.propertyType,
          listedBy: sitePayload.listedBy,
          brokerLabel: sitePayload.brokerLabel,
          descriptionText: sitePayload.descriptionText,
          heroFacts: sitePayload.heroFacts,
          sourceFacts: sitePayload.sourceFacts,
          amenities: sitePayload.amenities,
          transit: sitePayload.transit,
          floorPlans: sitePayload.floorPlans,
          detailSections: sitePayload.detailSections,
          propertyHistory: sitePayload.propertyHistory,
        },
        assets,
      },
    };
  }

  async function preparePageForDeepCapture() {
    if (deepCapturePreparedForUrl === location.href) {
      return;
    }

    const scroller = document.scrollingElement || document.documentElement;
    if (!scroller) {
      deepCapturePreparedForUrl = location.href;
      return;
    }

    const originalScrollTop = scroller.scrollTop;
    const viewportHeight = window.innerHeight || 900;
    const maxScrollTop = Math.max(scroller.scrollHeight - viewportHeight, 0);
    const step = Math.max(Math.round(viewportHeight * 0.9), 560);

    if (maxScrollTop > viewportHeight) {
      for (let nextTop = step; nextTop < maxScrollTop; nextTop += step) {
        window.scrollTo({ top: nextTop, behavior: "auto" });
        await sleep(120);
      }
      window.scrollTo({ top: maxScrollTop, behavior: "auto" });
      await sleep(240);
      window.scrollTo({ top: originalScrollTop, behavior: "auto" });
      await sleep(120);
    }

    deepCapturePreparedForUrl = location.href;
  }

  async function buildPayloadForSave() {
    await preparePageForDeepCapture();
    return buildPayload();
  }

  async function sendMessage(message) {
    if (!chrome?.runtime?.id) {
      return {
        ok: false,
        errorCode: "EXTENSION_CONTEXT_INVALIDATED",
        error: "The Acre extension reloaded. Refresh this page and try again.",
        connectionState: "disconnected",
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
          errorCode: "EXTENSION_CONTEXT_INVALIDATED",
          error: "The Acre extension reloaded. Refresh this page and try again.",
          connectionState: "disconnected",
        };
      }
      throw error;
    }
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

      const payloadForSave = await buildPayloadForSave();
      if (!payloadForSave) {
        panelState.mode = "error";
        panelState.message = "Unable to capture the latest listing data from this page.";
        renderPanel();
        return;
      }
      currentPayload = payloadForSave;

      const result = await sendMessage({
        type: "SAVE_LISTING",
        payload: payloadForSave.payload,
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
        deepCapturePreparedForUrl = null;
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
