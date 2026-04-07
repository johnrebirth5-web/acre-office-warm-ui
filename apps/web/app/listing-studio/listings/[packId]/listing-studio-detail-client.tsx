"use client";

import { startTransition, useMemo, useState } from "react";
import type { StudioListingDetailSnapshot } from "@acre/db";
import { Button, SectionCard, TextareaInput, TextInput } from "@acre/ui";

type ListingStudioDetailClientProps = {
  detail: StudioListingDetailSnapshot;
};

function buildShareUrl(shareCode: string | null) {
  return shareCode ? `/share/packs/${shareCode}` : null;
}

export function ListingStudioDetailClient({
  detail,
}: ListingStudioDetailClientProps) {
  const [headline, setHeadline] = useState(detail.pack.headline);
  const [summary, setSummary] = useState(detail.pack.summary);
  const [agentNote, setAgentNote] = useState(detail.pack.agentNote);
  const [bulletText, setBulletText] = useState(detail.pack.bulletPoints.join("\n"));
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    detail.pack.selectedAssetIds,
  );
  const [coverAssetId, setCoverAssetId] = useState<string | null>(
    detail.pack.coverAssetId ?? detail.assets[0]?.id ?? null,
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareCode, setShareCode] = useState(detail.pack.shareCode);
  const [shareEnabled, setShareEnabled] = useState(detail.pack.shareEnabled);

  const heroAssetId =
    coverAssetId ?? selectedAssetIds[0] ?? detail.assets[0]?.id ?? null;
  const shareUrl = buildShareUrl(shareCode);
  const activeGallery = useMemo(
    () =>
      detail.assets.filter(
        (asset) =>
          selectedAssetIds.includes(asset.id) || asset.id === heroAssetId,
      ),
    [detail.assets, heroAssetId, selectedAssetIds],
  );

  function toggleAsset(assetId: string) {
    setSelectedAssetIds((current) => {
      if (current.includes(assetId)) {
        const next = current.filter((value) => value !== assetId);
        if (!next.length) {
          return current;
        }
        if (coverAssetId === assetId) {
          setCoverAssetId(next[0] ?? null);
        }
        return next;
      }

      return [...current, assetId];
    });
  }

  function normalizeBulletPoints() {
    return bulletText
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function savePack() {
    setIsSaving(true);
    setStatusMessage("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/listing-studio/listings/${detail.packId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            headline,
            summary,
            bulletPoints: normalizeBulletPoints(),
            selectedAssetIds,
            coverAssetId,
            agentNote,
          }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Unable to save the packet.");
        }

        setStatusMessage("Packet changes saved.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Unable to save the packet.");
      } finally {
        setIsSaving(false);
      }
    });
  }

  function publishShare() {
    setIsSharing(true);
    setStatusMessage("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/listing-studio/listings/${detail.packId}/share`, {
          method: "POST",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Unable to publish the share link.");
        }

        const body = (await response.json()) as { shareCode: string; shareUrl: string };
        setShareCode(body.shareCode);
        setShareEnabled(true);
        setStatusMessage("Public share link is ready.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Unable to publish the share link.");
      } finally {
        setIsSharing(false);
      }
    });
  }

  async function copyShareUrl() {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(window.location.origin + shareUrl);
    setStatusMessage("Share URL copied.");
  }

  return (
    <div className="listing-studio-detail-layout">
      <div className="listing-studio-detail-main">
        <SectionCard
          className="listing-studio-hero-card"
          subtitle={detail.locationLine ?? "Imported listing packet"}
          title={detail.title}
        >
          <div className="listing-studio-hero-stack">
            <div className="listing-studio-hero-media">
              {heroAssetId ? (
                <img
                  alt={detail.title}
                  src={`/api/listing-studio/assets/${heroAssetId}`}
                />
              ) : (
                <div className="listing-studio-card-media-fallback">
                  {detail.sourceSite}
                </div>
              )}
            </div>
            <div className="listing-studio-hero-strip">
              <strong>{detail.priceLabel}</strong>
              <span>{detail.addressLine}</span>
              <span>{detail.listingType ?? detail.statusLabel ?? "Listing packet"}</span>
            </div>
            {activeGallery.length ? (
              <div className="listing-studio-thumbnail-row">
                {activeGallery.map((asset) => (
                  <button
                    className={`listing-studio-thumbnail${asset.id === heroAssetId ? " is-active" : ""}`}
                    key={asset.id}
                    onClick={() => setCoverAssetId(asset.id)}
                    type="button"
                  >
                    <img
                      alt={asset.label ?? detail.title}
                      src={`/api/listing-studio/assets/${asset.id}`}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          className="office-list-card"
          subtitle="The normalized facts layer stays read-only. Editing happens on the customer-facing packet in the right rail."
          title="Facts"
        >
          <div className="listing-studio-facts-grid">
            {detail.facts.map((fact) => (
              <div className="listing-studio-fact-card" key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
              </div>
            ))}
          </div>
          {detail.descriptionText ? (
            <p className="listing-studio-description">{detail.descriptionText}</p>
          ) : null}
        </SectionCard>

        <div className="listing-studio-section-grid">
          <SectionCard
            className="office-list-card"
            subtitle="Grouped directly from the imported listing payload."
            title="Amenities"
          >
            {detail.amenities.length ? (
              <div className="listing-studio-pill-section">
                {detail.amenities.map((section) => (
                  <div className="listing-studio-pill-group" key={section.title}>
                    <strong>{section.title}</strong>
                    <div className="listing-studio-pill-row">
                      {section.items.map((item) => (
                        <span className="listing-studio-pill" key={item}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="listing-studio-muted">No amenities were captured.</p>
            )}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Nearby transit parsed from the source page when available."
            title="Transit"
          >
            {detail.transit.length ? (
              <div className="listing-studio-transit-list">
                {detail.transit.map((item) => (
                  <div className="listing-studio-transit-item" key={`${item.label}-${item.distanceLabel ?? ""}`}>
                    <strong>{item.label}</strong>
                    <span>{item.detail ?? "Transit access captured"}</span>
                    {item.distanceLabel ? <em>{item.distanceLabel}</em> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="listing-studio-muted">No transit details were captured.</p>
            )}
          </SectionCard>
        </div>

        <SectionCard
          className="office-list-card"
          subtitle="Select the images that should stay in the public packet and choose the hero image."
          title="Media selection"
        >
          <div className="listing-studio-media-selector-grid">
            {detail.assets.map((asset) => {
              const isSelected = selectedAssetIds.includes(asset.id);
              const isCover = asset.id === coverAssetId;

              return (
                <div className="listing-studio-media-selector-card" key={asset.id}>
                  <img
                    alt={asset.label ?? detail.title}
                    src={`/api/listing-studio/assets/${asset.id}`}
                  />
                  <div className="listing-studio-media-selector-body">
                    <div className="listing-studio-card-meta">
                      <span className="office-status-badge office-status-badge-neutral">
                        {asset.kind}
                      </span>
                      {isCover ? (
                        <span className="office-status-badge office-status-badge-success">
                          Cover
                        </span>
                      ) : null}
                    </div>
                    <strong>{asset.label ?? "Imported asset"}</strong>
                    <div className="listing-studio-media-selector-actions">
                      <Button
                        onClick={() => toggleAsset(asset.id)}
                        variant={isSelected ? "primary" : "secondary"}
                      >
                        {isSelected ? "Included" : "Include"}
                      </Button>
                      <Button
                        disabled={!isSelected}
                        onClick={() => setCoverAssetId(asset.id)}
                        variant="ghost"
                      >
                        Set hero
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <div className="listing-studio-detail-rail">
        <SectionCard
          className="office-list-card"
          subtitle="These fields only affect the customer-facing packet. The imported snapshot stays unchanged."
          title="Packet editor"
        >
          <div className="listing-studio-editor-form">
            <label className="listing-studio-filter-field">
              <span>Headline</span>
              <TextInput value={headline} onChange={(event) => setHeadline(event.target.value)} />
            </label>
            <label className="listing-studio-filter-field">
              <span>Summary</span>
              <TextareaInput
                rows={5}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>
            <label className="listing-studio-filter-field">
              <span>Bullet points</span>
              <TextareaInput
                rows={6}
                value={bulletText}
                onChange={(event) => setBulletText(event.target.value)}
              />
            </label>
            <label className="listing-studio-filter-field">
              <span>Agent note</span>
              <TextareaInput
                rows={5}
                value={agentNote}
                onChange={(event) => setAgentNote(event.target.value)}
              />
            </label>
            <div className="listing-studio-editor-actions">
              <Button onClick={savePack} variant="primary">
                {isSaving ? "Saving..." : "Save packet"}
              </Button>
              <Button
                onClick={publishShare}
                variant="secondary"
              >
                {isSharing ? "Publishing..." : shareEnabled ? "Refresh share link" : "Publish share"}
              </Button>
              <a
                className="office-button office-button-ghost"
                href={`/api/listing-studio/listings/${detail.packId}/pdf`}
                target="_blank"
              >
                Export PDF
              </a>
              {shareUrl ? (
                <>
                  <a
                    className="office-button office-button-ghost"
                    href={shareUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open share page
                  </a>
                  <Button onClick={copyShareUrl} variant="ghost">
                    Copy share link
                  </Button>
                </>
              ) : null}
            </div>
            {statusMessage ? (
              <p className="listing-studio-status-message">{statusMessage}</p>
            ) : null}
          </div>
        </SectionCard>

        {detail.floorPlans.length ? (
          <SectionCard
            className="office-list-card"
            subtitle="Floor plan entries parsed from the source page."
            title="Floor plans"
          >
            <div className="listing-studio-floorplan-list">
              {detail.floorPlans.map((plan, index) => (
                <a
                  className="listing-studio-floorplan-link"
                  href={
                    plan.assetId
                      ? `/api/listing-studio/assets/${plan.assetId}`
                      : plan.url || "#"
                  }
                  key={`${plan.label}-${index}`}
                  target="_blank"
                >
                  {plan.label}
                </a>
              ))}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          className="office-list-card"
          subtitle="The import source stays visible so the packet always keeps attribution and an audit trail."
          title="Source"
        >
          <div className="listing-studio-source-card">
            <span className="office-status-badge office-status-badge-neutral">
              {detail.sourceSite}
            </span>
            <a href={detail.sourceUrl} rel="noreferrer" target="_blank">
              Open original listing
            </a>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
