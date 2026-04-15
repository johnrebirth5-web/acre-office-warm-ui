"use client";

import { type ReactNode, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudioListingDetailSnapshot } from "@acre/db";
import { Button, ConfirmActionDialog, TextareaInput, TextInput } from "@acre/ui";

type ListingStudioDetailClientProps = {
  detail: StudioListingDetailSnapshot;
};

type MediaMode = "photo" | "floorplan" | "map";

type TransitSummary = {
  nearestWalkMinutes: number | null;
  withinFiveHundredMeters: number | null;
};

function buildShareUrl(shareCode: string | null) {
  return shareCode ? `/share/packs/${shareCode}` : null;
}

function normalizeBulletPointsInput(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isPhotoAssetKind(kind: StudioListingDetailSnapshot["assets"][number]["kind"]) {
  return kind === "hero" || kind === "gallery";
}

function isLikelyPdf(url: string | null, mimeType?: string | null) {
  if (mimeType?.toLowerCase().includes("pdf")) {
    return true;
  }

  return typeof url === "string" && /\.pdf(?:$|\?)/i.test(url);
}

function getInitialPhotoId(detail: StudioListingDetailSnapshot) {
  const photoAssets = detail.assets.filter((asset) => isPhotoAssetKind(asset.kind));
  const preferredIds = [detail.pack.coverAssetId, ...detail.pack.selectedAssetIds].filter(
    (value): value is string => Boolean(value),
  );

  return (
    preferredIds.find((assetId) => photoAssets.some((asset) => asset.id === assetId)) ??
    photoAssets[0]?.id ??
    null
  );
}

function getInitialMediaMode(detail: StudioListingDetailSnapshot): MediaMode {
  if (getInitialPhotoId(detail)) {
    return "photo";
  }

  if (
    detail.assets.some((asset) => asset.kind === "floor_plan") ||
    detail.floorPlans.length
  ) {
    return "floorplan";
  }

  if (detail.latitude !== null || detail.longitude !== null || detail.addressLine) {
    return "map";
  }

  return "photo";
}

function findSourceFactValue(
  items: Array<{ label: string; value: string }>,
  matcher: RegExp,
) {
  return items.find((item) => matcher.test(item.label))?.value ?? null;
}

function getHeaderEyebrow(detail: StudioListingDetailSnapshot) {
  return (
    findSourceFactValue(detail.sourceFacts, /building/i) ??
    detail.locationLine
      ?.split("·")
      .map((entry) => entry.trim())
      .find(Boolean) ??
    (detail.sourceSite === "streeteasy" ? "StreetEasy" : "Zillow")
  );
}

function getListingStateLabel(detail: StudioListingDetailSnapshot) {
  if (detail.listingType) {
    if (/rent/i.test(detail.listingType)) {
      return "For rent";
    }
    if (/sale/i.test(detail.listingType)) {
      return "For sale";
    }
  }

  return detail.statusLabel ?? "Saved listing";
}

function buildMapEmbedUrl(detail: StudioListingDetailSnapshot) {
  if (detail.latitude !== null && detail.longitude !== null) {
    return `https://www.google.com/maps?q=${detail.latitude},${detail.longitude}&z=16&output=embed`;
  }

  const query = [detail.addressLine, detail.locationLine].filter(Boolean).join(", ").trim();
  if (!query) {
    return null;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

function collectFinancialHighlights(detail: StudioListingDetailSnapshot) {
  const candidates = [...detail.facts, ...detail.sourceFacts];
  const highlights: Array<{ label: string; value: string }> = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    if (
      !/common charges|hoa|maintenance|tax|price \/ ft|lease term|net effective/i.test(
        item.label,
      )
    ) {
      continue;
    }

    const key = item.label.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    highlights.push(item);
  }

  return highlights;
}

function parseTransitSummary(
  transit: Array<{ label: string; detail?: string | null; distanceLabel?: string | null }>,
): TransitSummary {
  let nearestWalkMinutes: number | null = null;
  let withinFiveHundredMeters = 0;
  let foundDistance = false;

  for (const item of transit) {
    const haystack = [item.detail, item.distanceLabel, item.label].filter(Boolean).join(" ");
    const walkMatch = haystack.match(/(\d+)\s*min(?:ute)?(?:s)?\s*walk/i);
    const distanceMatch = haystack.match(/([0-9.]+)\s*km/i);

    if (walkMatch) {
      const minutes = Number(walkMatch[1]);
      if (Number.isFinite(minutes)) {
        nearestWalkMinutes =
          nearestWalkMinutes === null ? minutes : Math.min(nearestWalkMinutes, minutes);
      }
    }

    if (distanceMatch) {
      const kilometers = Number(distanceMatch[1]);
      if (Number.isFinite(kilometers)) {
        foundDistance = true;
        if (kilometers <= 0.5) {
          withinFiveHundredMeters += 1;
        }
      }
    }
  }

  return {
    nearestWalkMinutes,
    withinFiveHundredMeters: foundDistance ? withinFiveHundredMeters : null,
  };
}

function ListingStudioDisclosure(props: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <details className="listing-studio-disclosure-card">
      <summary className="listing-studio-disclosure-summary">
        <div>
          <strong>{props.title}</strong>
          <span>{props.description}</span>
        </div>
        <span className="listing-studio-disclosure-toggle">Expand</span>
      </summary>
      <div className="listing-studio-disclosure-body">{props.children}</div>
    </details>
  );
}

export function ListingStudioDetailClient({
  detail,
}: ListingStudioDetailClientProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDetailsElement | null>(null);

  const [headline, setHeadline] = useState(detail.pack.headline);
  const [summary, setSummary] = useState(detail.pack.summary);
  const [agentNote, setAgentNote] = useState(detail.pack.agentNote);
  const [bulletText, setBulletText] = useState(detail.pack.bulletPoints.join("\n"));
  const [contactName, setContactName] = useState(detail.pack.contactName);
  const [contactTitle, setContactTitle] = useState(detail.pack.contactTitle);
  const [contactPhone, setContactPhone] = useState(detail.pack.contactPhone);
  const [contactEmail, setContactEmail] = useState(detail.pack.contactEmail);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    detail.pack.selectedAssetIds,
  );
  const [coverAssetId, setCoverAssetId] = useState<string | null>(
    detail.pack.coverAssetId ?? getInitialPhotoId(detail),
  );
  const [activePhotoId, setActivePhotoId] = useState<string | null>(() =>
    getInitialPhotoId(detail),
  );
  const [mediaMode, setMediaMode] = useState<MediaMode>(() =>
    getInitialMediaMode(detail),
  );
  const [shareCode, setShareCode] = useState(detail.pack.shareCode);
  const [shareEnabled, setShareEnabled] = useState(detail.pack.shareEnabled);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const normalizedBulletPoints = useMemo(
    () => normalizeBulletPointsInput(bulletText),
    [bulletText],
  );
  const shareUrl = buildShareUrl(shareCode);
  const photoAssets = useMemo(
    () => detail.assets.filter((asset) => isPhotoAssetKind(asset.kind)),
    [detail.assets],
  );
  const photoAssetIds = useMemo(
    () => new Set(photoAssets.map((asset) => asset.id)),
    [photoAssets],
  );
  const activePhoto =
    photoAssets.find((asset) => asset.id === activePhotoId) ?? photoAssets[0] ?? null;
  const floorPlanAsset = detail.assets.find((asset) => asset.kind === "floor_plan") ?? null;
  const floorPlanSrc =
    (floorPlanAsset ? `/api/listing-studio/assets/${floorPlanAsset.id}` : null) ??
    (detail.floorPlans[0]?.assetId
      ? `/api/listing-studio/assets/${detail.floorPlans[0].assetId}`
      : null) ??
    detail.floorPlans[0]?.url ??
    null;
  const floorPlanIsPdf = isLikelyPdf(floorPlanSrc, floorPlanAsset?.mimeType ?? null);
  const floorPlanLabel =
    floorPlanAsset?.label ?? detail.floorPlans[0]?.label ?? "Floor plan";
  const mapEmbedUrl = useMemo(() => buildMapEmbedUrl(detail), [detail]);
  const statusPill = getListingStateLabel(detail);
  const headerEyebrow = getHeaderEyebrow(detail);
  const financialHighlights = useMemo(
    () => collectFinancialHighlights(detail),
    [detail],
  );
  const transitSummary = useMemo(
    () => parseTransitSummary(detail.transit),
    [detail.transit],
  );
  const sourceDetailFacts = useMemo(
    () =>
      detail.sourceFacts.filter(
        (item) =>
          !/common charges|hoa|maintenance|tax|price \/ ft|lease term|net effective/i.test(
            item.label,
          ),
      ),
    [detail.sourceFacts],
  );

  function closeMenu() {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  }

  function handleSelectPhoto(assetId: string) {
    setMediaMode("photo");
    setActivePhotoId(assetId);
  }

  function toggleSelectedPhoto(assetId: string) {
    setSelectedAssetIds((current) => {
      const currentPhotoIds = current.filter((id) => photoAssetIds.has(id));
      const nonPhotoIds = current.filter((id) => !photoAssetIds.has(id));

      if (currentPhotoIds.includes(assetId)) {
        const nextPhotoIds = currentPhotoIds.filter((id) => id !== assetId);
        if (!nextPhotoIds.length) {
          return current;
        }

        if (coverAssetId === assetId) {
          setCoverAssetId(nextPhotoIds[0] ?? photoAssets[0]?.id ?? null);
        }

        return [...nonPhotoIds, ...nextPhotoIds];
      }

      return [...nonPhotoIds, ...currentPhotoIds, assetId];
    });
  }

  function setLeadPhoto(assetId: string) {
    setCoverAssetId(assetId);
    setActivePhotoId(assetId);
    setMediaMode("photo");
    setSelectedAssetIds((current) =>
      current.includes(assetId) ? current : [...current, assetId],
    );
  }

  async function savePack(options?: { closeEditor?: boolean }) {
    setIsSaving(true);
    setStatusMessage("");

    try {
      const response = await fetch(`/api/listing-studio/listings/${detail.packId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          headline,
          summary,
          bulletPoints: normalizedBulletPoints,
          selectedAssetIds,
          coverAssetId,
          agentNote,
          contactName,
          contactTitle,
          contactPhone,
          contactEmail,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Unable to save the listing.");
      }

      setStatusMessage("Listing changes saved.");
      if (options?.closeEditor) {
        setIsEditorOpen(false);
      }
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to save the listing.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function publishShare() {
    setIsSharing(true);
    setStatusMessage("");

    try {
      const response = await fetch(`/api/listing-studio/listings/${detail.packId}/share`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error || "Unable to publish the share link.");
      }

      const body = (await response.json()) as { shareCode: string };
      setShareCode(body.shareCode);
      setShareEnabled(true);
      setStatusMessage("Public share link is ready.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to publish the share link.",
      );
    } finally {
      setIsSharing(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
    setStatusMessage("Share URL copied.");
  }

  function deleteListing() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setStatusMessage("");

    void (async () => {
      try {
        const response = await fetch(`/api/listing-studio/listings/${detail.packId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error || "Unable to delete the listing.");
        }

        router.push("/listing-studio/listings?deleted=1");
        router.refresh();
      } catch (error) {
        setStatusMessage(
          error instanceof Error ? error.message : "Unable to delete the listing.",
        );
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
      }
    })();
  }

  return (
    <>
      <div className="listing-studio-view-page">
        <header className="listing-studio-view-header">
          <div className="listing-studio-view-header-copy">
            <span className="listing-studio-view-eyebrow">{headerEyebrow}</span>
            <h1>{detail.addressLine}</h1>
            {detail.locationLine ? <p>{detail.locationLine}</p> : null}
          </div>

          <details className="listing-studio-view-menu" ref={menuRef}>
            <summary className="listing-studio-view-menu-trigger" aria-label="Listing actions">
              <span />
              <span />
              <span />
            </summary>
            <div className="listing-studio-view-menu-popover">
              <span className="listing-studio-view-menu-label">Acre actions</span>
              <button
                className="listing-studio-view-menu-item"
                onClick={() => {
                  closeMenu();
                  setIsEditorOpen(true);
                }}
                type="button"
              >
                Edit packet
              </button>
              <button
                className="listing-studio-view-menu-item"
                disabled={isSaving}
                onClick={() => {
                  closeMenu();
                  void savePack();
                }}
                type="button"
              >
                {isSaving ? "Saving..." : "Save listing"}
              </button>
              <button
                className="listing-studio-view-menu-item"
                disabled={isSharing}
                onClick={() => {
                  closeMenu();
                  void publishShare();
                }}
                type="button"
              >
                {isSharing ? "Publishing..." : shareEnabled ? "Refresh share link" : "Publish share"}
              </button>
              <a
                className="listing-studio-view-menu-item"
                href={`/api/listing-studio/listings/${detail.packId}/pdf`}
                onClick={closeMenu}
                rel="noreferrer"
                target="_blank"
              >
                Export PDF
              </a>
              {shareUrl ? (
                <>
                  <a
                    className="listing-studio-view-menu-item"
                    href={shareUrl}
                    onClick={closeMenu}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open share page
                  </a>
                  <button
                    className="listing-studio-view-menu-item"
                    onClick={() => {
                      closeMenu();
                      void copyShareUrl();
                    }}
                    type="button"
                  >
                    Copy share link
                  </button>
                </>
              ) : null}
              <div className="listing-studio-view-menu-divider" />
              <a
                className="listing-studio-view-menu-item"
                href={detail.sourceUrl}
                onClick={closeMenu}
                rel="noreferrer"
                target="_blank"
              >
                Open original listing
              </a>
              <button
                className="listing-studio-view-menu-item is-danger"
                onClick={() => {
                  closeMenu();
                  setIsDeleteDialogOpen(true);
                }}
                type="button"
              >
                Delete listing
              </button>
            </div>
          </details>
        </header>

        {statusMessage ? (
          <p className="listing-studio-view-feedback">{statusMessage}</p>
        ) : null}

        <section className="listing-studio-view-stage-card">
          <div className="listing-studio-view-stage">
            <span className="listing-studio-view-status-pill">{statusPill}</span>

            {mediaMode === "map" && mapEmbedUrl ? (
              <iframe
                allowFullScreen
                className="listing-studio-view-stage-frame"
                loading="lazy"
                src={mapEmbedUrl}
                title={`${detail.addressLine} map`}
              />
            ) : mediaMode === "floorplan" && floorPlanSrc ? (
              floorPlanIsPdf ? (
                <iframe
                  allowFullScreen
                  className="listing-studio-view-stage-frame"
                  loading="lazy"
                  src={floorPlanSrc}
                  title={floorPlanLabel}
                />
              ) : (
                <img
                  alt={floorPlanLabel}
                  className="listing-studio-view-stage-image is-contained"
                  src={floorPlanSrc}
                />
              )
            ) : activePhoto ? (
              <img
                alt={activePhoto.label ?? detail.title}
                className="listing-studio-view-stage-image"
                src={`/api/listing-studio/assets/${activePhoto.id}`}
              />
            ) : (
              <div className="listing-studio-view-stage-empty">
                No media was captured for this listing yet.
              </div>
            )}
          </div>

          <div className="listing-studio-view-stage-rail">
            <div className="listing-studio-view-thumbnail-row">
              {photoAssets.map((asset) => (
                <button
                  className={`listing-studio-view-thumbnail${mediaMode === "photo" && activePhoto?.id === asset.id ? " is-active" : ""}`}
                  key={asset.id}
                  onClick={() => handleSelectPhoto(asset.id)}
                  type="button"
                >
                  <img
                    alt={asset.label ?? detail.title}
                    src={`/api/listing-studio/assets/${asset.id}`}
                  />
                </button>
              ))}
            </div>

            <div className="listing-studio-view-mode-row">
              {floorPlanSrc ? (
                <button
                  className={`listing-studio-view-mode-button${mediaMode === "floorplan" ? " is-active" : ""}`}
                  onClick={() => setMediaMode("floorplan")}
                  type="button"
                >
                  Floor plan
                </button>
              ) : null}
              {mapEmbedUrl ? (
                <button
                  className={`listing-studio-view-mode-button${mediaMode === "map" ? " is-active" : ""}`}
                  onClick={() => setMediaMode("map")}
                  type="button"
                >
                  Map
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="listing-studio-view-summary-card">
          <div className="listing-studio-view-price-block">
            <strong>{detail.priceLabel}</strong>
            <span>{headerEyebrow}</span>
          </div>

          <div className="listing-studio-view-address-block">
            <strong>{detail.addressLine}</strong>
            {detail.locationLine ? <span>{detail.locationLine}</span> : null}
          </div>

          {detail.facts.length ? (
            <div className="listing-studio-view-facts-grid">
              {detail.facts.map((fact) => (
                <div className="listing-studio-view-fact-card" key={fact.label}>
                  <span>{fact.label}</span>
                  <strong>{fact.value}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {financialHighlights.length ? (
            <div className="listing-studio-view-chip-row">
              {financialHighlights.map((item) => (
                <span className="listing-studio-view-chip" key={item.label}>
                  {item.label} {item.value}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {detail.amenities.length ? (
          <section className="listing-studio-view-info-card">
            <div className="listing-studio-view-section-head">
              <h2>Building amenities</h2>
            </div>
            <div className="listing-studio-view-amenities-sections">
              {detail.amenities.map((section) => (
                <div className="listing-studio-view-amenity-group" key={section.title}>
                  <strong>{section.title}</strong>
                  <ul className="listing-studio-view-amenity-list">
                    {section.items.map((item) => (
                      <li key={`${section.title}-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {detail.transit.length ? (
          <section className="listing-studio-view-info-card">
            <div className="listing-studio-view-section-head">
              <h2>Nearby transit</h2>
            </div>

            {transitSummary.nearestWalkMinutes !== null ||
            transitSummary.withinFiveHundredMeters !== null ? (
              <div className="listing-studio-view-transit-summary">
                {transitSummary.nearestWalkMinutes !== null ? (
                  <div className="listing-studio-view-transit-summary-card">
                    <span>Nearest station</span>
                    <strong>{transitSummary.nearestWalkMinutes} min walk</strong>
                  </div>
                ) : null}
                {transitSummary.withinFiveHundredMeters !== null ? (
                  <div className="listing-studio-view-transit-summary-card">
                    <span>Within 500m</span>
                    <strong>{transitSummary.withinFiveHundredMeters} stations</strong>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="listing-studio-view-transit-list">
              {detail.transit.map((item) => (
                <div
                  className="listing-studio-view-transit-item"
                  key={`${item.label}-${item.distanceLabel ?? ""}`}
                >
                  <div>
                    <strong>{item.label}</strong>
                    {item.detail ? <span>{item.detail}</span> : null}
                  </div>
                  {item.distanceLabel ? <em>{item.distanceLabel}</em> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {detail.pack.summary || detail.descriptionText ? (
          <section className="listing-studio-view-info-card">
            <div className="listing-studio-view-section-head">
              <h2>Overview</h2>
            </div>
            <div className="listing-studio-view-copy-stack">
              {detail.pack.summary ? <p>{detail.pack.summary}</p> : null}
              {detail.descriptionText ? <p>{detail.descriptionText}</p> : null}
            </div>
          </section>
        ) : null}

        {sourceDetailFacts.length ? (
          <section className="listing-studio-view-info-card">
            <div className="listing-studio-view-section-head">
              <h2>Source facts</h2>
            </div>
            <div className="listing-studio-view-source-grid">
              {sourceDetailFacts.slice(0, 6).map((item) => (
                <div className="listing-studio-view-source-card" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {detail.propertyHistory.length ? (
          <ListingStudioDisclosure
            description="Raw price and listing history stay nearby without taking over the primary reading flow."
            title="Property history"
          >
            <div className="listing-studio-detail-section-list">
              {detail.propertyHistory.map((section) => (
                <div className="listing-studio-detail-section-block" key={section.title}>
                  <strong>{section.title}</strong>
                  <div className="listing-studio-detail-section-items">
                    {section.items.map((item) => (
                      <span key={`${section.title}-${item}`}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ListingStudioDisclosure>
        ) : null}

        {detail.capturedSections.length ? (
          <ListingStudioDisclosure
            description="Additional scraped sections stay collapsed until you need the raw source payload."
            title="Additional details"
          >
            <div className="listing-studio-detail-section-list">
              {detail.capturedSections.map((section) => (
                <div className="listing-studio-detail-section-block" key={section.title}>
                  <strong>{section.title}</strong>
                  <div className="listing-studio-detail-section-items">
                    {section.items.map((item) => (
                      <span key={`${section.title}-${item}`}>{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ListingStudioDisclosure>
        ) : null}
      </div>

      {isEditorOpen ? (
        <div
          className="office-modal-overlay"
          onClick={() => {
            if (!isSaving) {
              setIsEditorOpen(false);
            }
          }}
        >
          <section
            aria-label="Edit listing packet"
            aria-modal="true"
            className="office-modal listing-studio-view-edit-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="office-modal-header office-modal-header-configurable">
              <div className="office-modal-title-block">
                <span className="listing-studio-view-edit-kicker">Edit packet</span>
                <h3>{detail.addressLine}</h3>
                <p>
                  Packet edits stay internal to Acre. The detail page itself now stays aligned
                  to the imported listing view.
                </p>
              </div>
              <div className="office-modal-header-actions">
                <Button
                  onClick={() => setIsEditorOpen(false)}
                  type="button"
                  variant="secondary"
                >
                  Close
                </Button>
                <Button
                  disabled={isSaving}
                  onClick={() => void savePack({ closeEditor: true })}
                  type="button"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </header>

            <div className="office-modal-body">
              <div className="listing-studio-view-edit-body">
                <section className="listing-studio-view-edit-section">
                  <div className="listing-studio-view-edit-section-head">
                    <strong>Editorial copy</strong>
                    <span>These fields still control the internal packet, share page, and exports.</span>
                  </div>
                  <div className="listing-studio-form-grid">
                    <label className="listing-studio-filter-field listing-studio-form-grid-span">
                      <span>Headline</span>
                      <TextInput
                        value={headline}
                        onChange={(event) => setHeadline(event.target.value)}
                      />
                    </label>
                    <label className="listing-studio-filter-field listing-studio-form-grid-span">
                      <span>Summary</span>
                      <TextareaInput
                        rows={4}
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                      />
                    </label>
                    <label className="listing-studio-filter-field listing-studio-form-grid-span">
                      <span>Bullet points</span>
                      <TextareaInput
                        rows={5}
                        value={bulletText}
                        onChange={(event) => setBulletText(event.target.value)}
                      />
                    </label>
                    <label className="listing-studio-filter-field listing-studio-form-grid-span">
                      <span>Agent note</span>
                      <TextareaInput
                        rows={4}
                        value={agentNote}
                        onChange={(event) => setAgentNote(event.target.value)}
                      />
                    </label>
                  </div>
                </section>

                <section className="listing-studio-view-edit-section">
                  <div className="listing-studio-view-edit-section-head">
                    <strong>Contact block</strong>
                    <span>The share page and packet exports still use this Acre contact panel.</span>
                  </div>
                  <div className="listing-studio-form-grid">
                    <label className="listing-studio-filter-field">
                      <span>Contact name</span>
                      <TextInput
                        value={contactName}
                        onChange={(event) => setContactName(event.target.value)}
                      />
                    </label>
                    <label className="listing-studio-filter-field">
                      <span>Contact title</span>
                      <TextInput
                        value={contactTitle}
                        onChange={(event) => setContactTitle(event.target.value)}
                      />
                    </label>
                    <label className="listing-studio-filter-field">
                      <span>Contact phone</span>
                      <TextInput
                        value={contactPhone}
                        onChange={(event) => setContactPhone(event.target.value)}
                      />
                    </label>
                    <label className="listing-studio-filter-field">
                      <span>Contact email</span>
                      <TextInput
                        value={contactEmail}
                        onChange={(event) => setContactEmail(event.target.value)}
                      />
                    </label>
                  </div>
                </section>

                <section className="listing-studio-view-edit-section">
                  <div className="listing-studio-view-edit-section-head">
                    <strong>Share / PDF media selection</strong>
                    <span>
                      The detail page always shows all imported photos. These choices only affect
                      what Acre uses for share and PDF outputs.
                    </span>
                  </div>
                  <div className="listing-studio-view-edit-media-grid">
                    {photoAssets.map((asset) => {
                      const isSelected = selectedAssetIds.includes(asset.id);
                      const isLead = coverAssetId === asset.id;

                      return (
                        <div className="listing-studio-view-edit-media-card" key={asset.id}>
                          <img
                            alt={asset.label ?? detail.title}
                            src={`/api/listing-studio/assets/${asset.id}`}
                          />
                          <div className="listing-studio-view-edit-media-body">
                            <div className="listing-studio-view-edit-media-copy">
                              <strong>{asset.label ?? "Imported photo"}</strong>
                              <span>{isLead ? "Lead asset" : "Gallery asset"}</span>
                            </div>
                            <div className="listing-studio-editor-actions">
                              <Button
                                onClick={() => toggleSelectedPhoto(asset.id)}
                                size="sm"
                                variant={isSelected ? "primary" : "secondary"}
                              >
                                {isSelected ? "Included" : "Include"}
                              </Button>
                              <Button
                                onClick={() => setLeadPhoto(asset.id)}
                                size="sm"
                                variant={isLead ? "primary" : "ghost"}
                              >
                                {isLead ? "Lead photo" : "Set lead"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>

            <footer className="office-modal-footer">
              <span>Publishing is still a separate explicit step after saving.</span>
              <div className="office-modal-actions">
                <Button
                  onClick={() => setIsEditorOpen(false)}
                  type="button"
                  variant="secondary"
                >
                  Close
                </Button>
                <Button
                  disabled={isSaving}
                  onClick={() => void savePack({ closeEditor: true })}
                  type="button"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      <ConfirmActionDialog
        cancelLabel="Keep listing"
        confirmLabel={isDeleting ? "Deleting..." : "Delete listing"}
        confirmVariant="danger"
        description="This permanently removes the imported listing, downloaded images, raw source files, share events, and generated PDF for this listing."
        isOpen={isDeleteDialogOpen}
        onCancel={() => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(false);
          }
        }}
        onConfirm={deleteListing}
        title="Delete this listing?"
      >
        <p className="listing-studio-muted">
          You can save the source page again later, but this saved listing will be gone.
        </p>
      </ConfirmActionDialog>
    </>
  );
}
