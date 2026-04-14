"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudioListingDetailSnapshot } from "@acre/db";
import { Button, ConfirmActionDialog, SectionCard, TextareaInput, TextInput } from "@acre/ui";
import {
  buildListingStudioMarketingKit,
  buildListingStudioPosterCopyText,
  buildListingStudioPosterDraft,
  buildListingStudioPosterHref,
  buildListingStudioPosterScanTarget,
  getListingStudioPosterTemplates,
  type ListingStudioPosterTemplateId,
} from "./listing-studio-poster";

type ListingStudioDetailClientProps = {
  detail: StudioListingDetailSnapshot;
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

function buildPosterUrl(input: {
  packId: string;
  templateId: ListingStudioPosterTemplateId;
  kicker: string;
  headline: string;
  subheadline: string;
  cta: string;
  footer: string;
  coverAssetId: string | null;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  download?: boolean;
  print?: boolean;
}) {
  return buildListingStudioPosterHref({
    packId: input.packId,
    draft: {
      templateId: input.templateId,
      kicker: input.kicker,
      headline: input.headline,
      subheadline: input.subheadline,
      cta: input.cta,
      footer: input.footer,
      coverAssetId: input.coverAssetId,
    },
    contactName: input.contactName,
    contactTitle: input.contactTitle,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail,
    download: input.download,
    print: input.print,
  });
}

export function ListingStudioDetailClient({
  detail,
}: ListingStudioDetailClientProps) {
  const router = useRouter();
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
    detail.pack.coverAssetId ?? detail.assets[0]?.id ?? null,
  );
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [shareCode, setShareCode] = useState(detail.pack.shareCode);
  const [shareEnabled, setShareEnabled] = useState(detail.pack.shareEnabled);
  const initialPosterDraft = buildListingStudioPosterDraft(
    detail,
    "editorial",
    detail.pack.coverAssetId ?? detail.assets[0]?.id ?? null,
  );
  const [posterTemplateId, setPosterTemplateId] = useState<
    ListingStudioPosterTemplateId
  >(initialPosterDraft.templateId);
  const [posterKicker, setPosterKicker] = useState(initialPosterDraft.kicker);
  const [posterHeadline, setPosterHeadline] = useState(
    initialPosterDraft.headline,
  );
  const [posterSubheadline, setPosterSubheadline] = useState(
    initialPosterDraft.subheadline,
  );
  const [posterCta, setPosterCta] = useState(initialPosterDraft.cta);
  const [posterFooter, setPosterFooter] = useState(initialPosterDraft.footer);
  const [posterCoverAssetId, setPosterCoverAssetId] = useState<string | null>(
    initialPosterDraft.coverAssetId,
  );

  const normalizedBulletPoints = useMemo(
    () => normalizeBulletPointsInput(bulletText),
    [bulletText],
  );
  const heroAssetId =
    coverAssetId ?? selectedAssetIds[0] ?? detail.assets[0]?.id ?? null;
  const shareUrl = buildShareUrl(shareCode);
  const posterTemplates = getListingStudioPosterTemplates();
  const packetPreviewDetail = useMemo(
    () => ({
      ...detail,
      pack: {
        ...detail.pack,
        headline,
        summary,
        bulletPoints: normalizedBulletPoints,
        selectedAssetIds,
        coverAssetId,
        agentNote,
        shareEnabled,
        shareCode,
        contactName,
        contactTitle,
        contactPhone,
        contactEmail,
      },
    }),
    [
      agentNote,
      contactEmail,
      contactName,
      contactPhone,
      contactTitle,
      coverAssetId,
      detail,
      headline,
      normalizedBulletPoints,
      selectedAssetIds,
      shareCode,
      shareEnabled,
      summary,
    ],
  );
  const posterDraft = useMemo(
    () => ({
      templateId: posterTemplateId,
      kicker: posterKicker,
      headline: posterHeadline,
      subheadline: posterSubheadline,
      cta: posterCta,
      footer: posterFooter,
      coverAssetId: posterCoverAssetId,
    }),
    [
      posterCta,
      posterCoverAssetId,
      posterFooter,
      posterHeadline,
      posterKicker,
      posterSubheadline,
      posterTemplateId,
    ],
  );
  const posterPreviewUrl = useMemo(
    () =>
      buildPosterUrl({
        packId: detail.packId,
        templateId: posterTemplateId,
        kicker: posterKicker,
        headline: posterHeadline,
        subheadline: posterSubheadline,
        cta: posterCta,
        footer: posterFooter,
        coverAssetId: posterCoverAssetId,
        contactName,
        contactTitle,
        contactPhone,
        contactEmail,
      }),
    [
      contactEmail,
      contactName,
      contactPhone,
      contactTitle,
      detail.packId,
      posterCta,
      posterCoverAssetId,
      posterFooter,
      posterHeadline,
      posterKicker,
      posterSubheadline,
      posterTemplateId,
    ],
  );
  const posterPrintUrl = useMemo(
    () =>
      buildPosterUrl({
        packId: detail.packId,
        templateId: posterTemplateId,
        kicker: posterKicker,
        headline: posterHeadline,
        subheadline: posterSubheadline,
        cta: posterCta,
        footer: posterFooter,
        coverAssetId: posterCoverAssetId,
        print: true,
        contactName,
        contactTitle,
        contactPhone,
        contactEmail,
      }),
    [
      contactEmail,
      contactName,
      contactPhone,
      contactTitle,
      detail.packId,
      posterCta,
      posterCoverAssetId,
      posterFooter,
      posterHeadline,
      posterKicker,
      posterSubheadline,
      posterTemplateId,
    ],
  );
  const posterDownloadUrl = useMemo(
    () =>
      buildPosterUrl({
        packId: detail.packId,
        templateId: posterTemplateId,
        kicker: posterKicker,
        headline: posterHeadline,
        subheadline: posterSubheadline,
        cta: posterCta,
        footer: posterFooter,
        coverAssetId: posterCoverAssetId,
        download: true,
        contactName,
        contactTitle,
        contactPhone,
        contactEmail,
      }),
    [
      contactEmail,
      contactName,
      contactPhone,
      contactTitle,
      detail.packId,
      posterCta,
      posterCoverAssetId,
      posterFooter,
      posterHeadline,
      posterKicker,
      posterSubheadline,
      posterTemplateId,
    ],
  );
  const posterCopyText = useMemo(
    () =>
      buildListingStudioPosterCopyText(
        packetPreviewDetail,
        posterDraft,
      ),
    [packetPreviewDetail, posterDraft],
  );
  const marketingKit = useMemo(
    () => buildListingStudioMarketingKit(packetPreviewDetail, posterDraft),
    [packetPreviewDetail, posterDraft],
  );
  const posterPacketTarget = buildListingStudioPosterScanTarget(packetPreviewDetail);
  const scanTargetHref = posterPacketTarget.href;
  const scanTargetLabel = posterPacketTarget.label;
  const scanTargetHint = posterPacketTarget.hint;
  const activePosterTemplate =
    posterTemplates.find((template) => template.id === posterTemplateId) ??
    posterTemplates[0];
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
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Unable to save the listing.");
        }

        setStatusMessage("Listing changes saved.");
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Unable to save the listing.");
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

  async function copyPosterCopy() {
    try {
      await navigator.clipboard.writeText(posterCopyText);
      setStatusMessage("Poster copy copied.");
    } catch {
      setStatusMessage("Clipboard access is not available for poster copy.");
    }
  }

  async function copyMarketingKitCopy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage(`${label} copied.`);
    } catch {
      setStatusMessage(`Clipboard access is not available for ${label.toLowerCase()}.`);
    }
  }

  async function copyScanLink() {
    try {
      const absoluteUrl = scanTargetHref.startsWith("http")
        ? scanTargetHref
        : `${window.location.origin}${scanTargetHref.startsWith("/") ? scanTargetHref : `/${scanTargetHref}`}`;
      await navigator.clipboard.writeText(absoluteUrl);
      setStatusMessage("Scan link copied.");
    } catch {
      setStatusMessage("Unable to copy the scan link in this browser.");
    }
  }

  async function copyPosterHtml() {
    try {
      const response = await fetch(posterPreviewUrl, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Unable to load the poster preview.");
      }

      await navigator.clipboard.writeText(await response.text());
      setStatusMessage("Poster HTML copied.");
    } catch {
      setStatusMessage("Unable to copy poster HTML in this browser.");
    }
  }

  function deleteListing() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    setStatusMessage("");

    startTransition(async () => {
      try {
        const response = await fetch(`/api/listing-studio/listings/${detail.packId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error || "Unable to delete the listing.");
        }

        router.push("/listing-studio/listings?deleted=1");
        router.refresh();
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Unable to delete the listing.");
        setIsDeleting(false);
        setIsDeleteDialogOpen(false);
      }
    });
  }

  return (
    <>
      <div className="listing-studio-detail-layout">
        <div className="listing-studio-detail-main">
          <SectionCard
            className="listing-studio-hero-card"
            subtitle={detail.locationLine ?? "Imported listing"}
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
                <span>{detail.listingType ?? detail.statusLabel ?? "Saved listing"}</span>
              </div>
              <div className="listing-studio-facts-grid">
                {detail.facts.map((fact) => (
                  <div className="listing-studio-fact-card" key={fact.label}>
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                ))}
              </div>
              <div className="listing-studio-hero-workspace">
                <div className="listing-studio-keyvalue-card listing-studio-hero-workspace-card">
                  <span>Workspace structure</span>
                  <strong>Curate first, publish second</strong>
                  <span>
                    Edit the client-facing packet here, keep imported source detail nearby, and use the right rail for save, share, and export.
                  </span>
                </div>
                <div className="listing-studio-anchor-row">
                  <a className="office-button office-button-secondary office-button-sm" href="#listing-studio-editor">
                    Edit pack
                  </a>
                  <a className="office-button office-button-secondary office-button-sm" href="#listing-studio-source-data">
                    Source data
                  </a>
                  <a className="office-button office-button-secondary office-button-sm" href="#listing-studio-media">
                    Photos
                  </a>
                  <a className="office-button office-button-secondary office-button-sm" href="#listing-studio-poster">
                    Poster
                  </a>
                  <a className="office-button office-button-secondary office-button-sm" href="#listing-studio-marketing">
                    Marketing
                  </a>
                </div>
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
              {detail.descriptionText ? (
                <p className="listing-studio-description">{detail.descriptionText}</p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            id="listing-studio-editor"
            subtitle="Keep the curated client-facing packet compact here. Save, publish, and export from the right rail."
            title="Curated page editor"
          >
            <div className="listing-studio-keyvalue-grid">
              <div className="listing-studio-keyvalue-card">
                <span>Share state</span>
                <strong>{shareEnabled && shareUrl ? "Published share page" : "Draft only"}</strong>
                <span>
                  {shareEnabled && shareUrl
                    ? shareUrl
                    : "Publish when the packet is ready for a public Acre link."}
                </span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Selected media</span>
                <strong>
                  {selectedAssetIds.length} of {detail.assets.length} images active
                </strong>
                <span>{coverAssetId ? "A hero image is set for share, PDF, and poster output." : "Pick a hero image in the media section."}</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Poster mode</span>
                <strong>{activePosterTemplate.label}</strong>
                <span>{activePosterTemplate.description}</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Scan path</span>
                <strong>{scanTargetLabel}</strong>
                <span>{scanTargetHint}</span>
              </div>
            </div>
            <div className="listing-studio-form-grid">
              <label className="listing-studio-filter-field">
                <span>Contact name</span>
                <TextInput value={contactName} onChange={(event) => setContactName(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field">
                <span>Contact title</span>
                <TextInput value={contactTitle} onChange={(event) => setContactTitle(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field">
                <span>Contact phone</span>
                <TextInput value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field">
                <span>Contact email</span>
                <TextInput value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field listing-studio-form-grid-span">
                <span>Headline</span>
                <TextInput value={headline} onChange={(event) => setHeadline(event.target.value)} />
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
          </SectionCard>

          <SectionCard
            className="office-list-card"
            id="listing-studio-source-data"
            subtitle="Keep the imported source context nearby without letting it take over the editing surface."
            title="Imported snapshot"
          >
            {detail.sourceFacts.length ? (
              <div className="listing-studio-keyvalue-grid">
                {detail.sourceFacts.slice(0, 6).map((item) => (
                  <div className="listing-studio-keyvalue-card" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="listing-studio-section-grid">
              <div className="listing-studio-detail-section-block">
                <strong>Amenities</strong>
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
              </div>
              <div className="listing-studio-detail-section-block">
                <strong>Transit</strong>
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
              </div>
            </div>

            {detail.sourceFacts.length > 6 ? (
              <details className="listing-studio-disclosure-card">
                <summary className="listing-studio-disclosure-summary">
                  <div>
                    <strong>All source facts</strong>
                    <span>Full structured data captured from the original listing page.</span>
                  </div>
                  <span className="listing-studio-disclosure-toggle">Expand</span>
                </summary>
                <div className="listing-studio-disclosure-body">
                  <div className="listing-studio-keyvalue-grid">
                    {detail.sourceFacts.map((item) => (
                      <div className="listing-studio-keyvalue-card" key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ) : null}

            {detail.propertyHistory.length || detail.capturedSections.length || detail.floorPlans.length ? (
              <details className="listing-studio-disclosure-card">
                <summary className="listing-studio-disclosure-summary">
                  <div>
                    <strong>History and extra captured details</strong>
                    <span>Property history, additional scraped sections, and floor plan references stay available on demand.</span>
                  </div>
                  <span className="listing-studio-disclosure-toggle">Expand</span>
                </summary>
                <div className="listing-studio-disclosure-body">
                  {detail.propertyHistory.length ? (
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
                  ) : null}
                  {detail.capturedSections.length ? (
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
                  ) : null}
                  {detail.floorPlans.length ? (
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
                  ) : null}
                </div>
              </details>
            ) : null}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            id="listing-studio-media"
            subtitle="Select the images that stay on the public page and choose the hero image."
            title="Media library"
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
                            Hero
                          </span>
                        ) : null}
                      </div>
                      <strong>{asset.label ?? "Imported asset"}</strong>
                      <div className="listing-studio-media-selector-actions">
                        <Button
                          onClick={() => toggleAsset(asset.id)}
                          size="sm"
                          variant={isSelected ? "primary" : "secondary"}
                        >
                          {isSelected ? "Included" : "Include"}
                        </Button>
                        <Button
                          disabled={!isSelected}
                          onClick={() => setCoverAssetId(asset.id)}
                          size="sm"
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

          <SectionCard
            className="office-list-card"
            id="listing-studio-poster"
            subtitle="Build the HTML poster from the same saved packet. Preview stays inline so it feels like part of the page, not a separate tool."
            title="Poster studio"
          >
            <div className="listing-studio-keyvalue-grid">
              <div className="listing-studio-keyvalue-card">
                <span>Template</span>
                <strong>{activePosterTemplate.label}</strong>
                <span>{activePosterTemplate.description}</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Poster hero</span>
                <strong>{posterCoverAssetId ? "Selected image ready" : "No image selected"}</strong>
                <span>{posterCoverAssetId ? "Poster preview uses the selected hero asset." : "Pick a poster hero to finish the layout."}</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Agent block</span>
                <strong>{contactName || "Acre listing studio"}</strong>
                <span>{contactTitle || "Listing presentation"}</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Scan target</span>
                <strong>{scanTargetLabel}</strong>
                <span>{scanTargetHint}</span>
              </div>
            </div>
            <div className="listing-studio-filter-actions">
              {posterTemplates.map((template) => (
                <Button
                  key={template.id}
                  onClick={() => {
                    const nextDraft = buildListingStudioPosterDraft(
                      packetPreviewDetail,
                      template.id,
                      posterCoverAssetId,
                    );
                    setPosterTemplateId(template.id);
                    setPosterKicker(nextDraft.kicker);
                    setPosterHeadline(nextDraft.headline);
                    setPosterSubheadline(nextDraft.subheadline);
                    setPosterCta(nextDraft.cta);
                    setPosterFooter(nextDraft.footer);
                  }}
                  size="sm"
                  variant={posterTemplateId === template.id ? "primary" : "secondary"}
                >
                  {template.label}
                </Button>
              ))}
            </div>
            <div className="listing-studio-form-grid">
              <label className="listing-studio-filter-field">
                <span>Kicker</span>
                <TextInput value={posterKicker} onChange={(event) => setPosterKicker(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field">
                <span>CTA</span>
                <TextInput value={posterCta} onChange={(event) => setPosterCta(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field listing-studio-form-grid-span">
                <span>Headline</span>
                <TextInput value={posterHeadline} onChange={(event) => setPosterHeadline(event.target.value)} />
              </label>
              <label className="listing-studio-filter-field listing-studio-form-grid-span">
                <span>Subheadline</span>
                <TextareaInput
                  rows={3}
                  value={posterSubheadline}
                  onChange={(event) => setPosterSubheadline(event.target.value)}
                />
              </label>
              <label className="listing-studio-filter-field listing-studio-form-grid-span">
                <span>Footer</span>
                <TextInput value={posterFooter} onChange={(event) => setPosterFooter(event.target.value)} />
              </label>
            </div>
            <div className="listing-studio-filter-field">
              <span>Poster hero image</span>
              <div className="listing-studio-filter-actions">
                {detail.assets.slice(0, 6).map((asset) => (
                  <Button
                    key={asset.id}
                    onClick={() => setPosterCoverAssetId(asset.id)}
                    size="sm"
                    variant={posterCoverAssetId === asset.id ? "primary" : "secondary"}
                  >
                    {asset.label ?? asset.kind}
                  </Button>
                ))}
              </div>
            </div>
            <div className="listing-studio-poster-frame">
              <iframe
                key={posterPreviewUrl}
                src={posterPreviewUrl}
                title="Listing Studio poster preview"
              />
            </div>
            <div className="listing-studio-editor-actions">
              <a
                className="office-button office-button-secondary"
                href={posterPrintUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open print view
              </a>
              <a
                className="office-button office-button-secondary"
                download
                href={posterDownloadUrl}
              >
                Download HTML
              </a>
              <Button onClick={() => void copyPosterHtml()} variant="ghost">
                Copy HTML
              </Button>
              <Button onClick={() => void copyPosterCopy()} variant="ghost">
                Copy poster copy
              </Button>
            </div>
            <p className="listing-studio-muted">
              Review the poster before sharing or exporting. This stays manual and review-first.
            </p>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            id="listing-studio-marketing"
            subtitle="Copy-ready campaign material stays attached to the same packet, but only the highest-value pieces stay open by default."
            title="Marketing workspace"
          >
            <div className="listing-studio-editor-actions">
              <Button
                onClick={() =>
                  void copyMarketingKitCopy("Full marketing kit", marketingKit.fullText)
                }
                variant="secondary"
              >
                Copy full kit
              </Button>
              {marketingKit.bundles.map((bundle) => (
                <Button
                  key={bundle.id}
                  onClick={() => void copyMarketingKitCopy(bundle.title, bundle.text)}
                  variant="ghost"
                >
                  Copy {bundle.title}
                </Button>
              ))}
            </div>
            <div className="listing-studio-keyvalue-grid">
              <div className="listing-studio-keyvalue-card">
                <span>Copy included</span>
                <strong>Caption, blurb, follow-up</strong>
                <span>All copy blocks derive from the same saved listing and current poster draft.</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Delivery plan</span>
                <strong>
                  {marketingKit.deliveryPlan.sequence.length} steps · {marketingKit.deliveryPlan.checklist.length} checks
                </strong>
                <span>The manual delivery plan stays available, but no longer floods the page by default.</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Template briefs</span>
                <strong>{marketingKit.templateBriefs.length} briefs</strong>
                <span>Every poster layout still carries a quick use brief for easier selection.</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Campaign flights</span>
                <strong>{marketingKit.flights.length} reusable cadences</strong>
                <span>Launch, event, and evergreen sequences stay ready to copy when needed.</span>
              </div>
            </div>

            <div className="listing-studio-keyvalue-grid">
              {marketingKit.bundles.map((bundle) => (
                <div className="listing-studio-keyvalue-card" key={bundle.id}>
                  <div className="listing-studio-card-meta">
                    <span className="office-status-badge office-status-badge-neutral">
                      {bundle.note}
                    </span>
                    <span className="office-status-badge office-status-badge-success">
                      Campaign bundle
                    </span>
                  </div>
                  <strong>{bundle.title}</strong>
                  <span>{bundle.description}</span>
                  <span className="listing-studio-prewrap">{bundle.text}</span>
                  <div className="listing-studio-editor-actions">
                    <Button
                      onClick={() => void copyMarketingKitCopy(bundle.title, bundle.text)}
                      size="sm"
                      variant="secondary"
                    >
                      Copy bundle
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <details className="listing-studio-disclosure-card" open>
              <summary className="listing-studio-disclosure-summary">
                <div>
                  <strong>Send-ready packages and delivery plan</strong>
                  <span>Package sets, manual sequence, and readiness checks are still attached here for later use.</span>
                </div>
                <span className="listing-studio-disclosure-toggle">Expand</span>
              </summary>
              <div className="listing-studio-disclosure-body">
                <div className="listing-studio-keyvalue-grid">
                  {marketingKit.deliveryPlan.packages.map((campaignPackage) => (
                    <div className="listing-studio-keyvalue-card" key={campaignPackage.id}>
                      <div className="listing-studio-card-meta">
                        <span className="office-status-badge office-status-badge-neutral">
                          {campaignPackage.note}
                        </span>
                        <span className="office-status-badge office-status-badge-success">
                          Send-ready
                        </span>
                      </div>
                      <strong>{campaignPackage.title}</strong>
                      <span>{campaignPackage.description}</span>
                      <span className="listing-studio-prewrap">{campaignPackage.text}</span>
                      <div className="listing-studio-editor-actions">
                        <Button
                          onClick={() => void copyMarketingKitCopy(campaignPackage.title, campaignPackage.text)}
                          size="sm"
                          variant="secondary"
                        >
                          Copy package
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="listing-studio-detail-section-list">
                  <div className="listing-studio-detail-section-block">
                    <div className="listing-studio-card-meta">
                      <span className="office-status-badge office-status-badge-neutral">
                        Manual review path
                      </span>
                    </div>
                    <strong>Delivery sequence</strong>
                    <div className="listing-studio-keyvalue-grid">
                      {marketingKit.deliveryPlan.sequence.map((step, index) => (
                        <div className="listing-studio-keyvalue-card" key={step.id}>
                          <div className="listing-studio-card-meta">
                            <span className="office-status-badge office-status-badge-neutral">
                              Step {index + 1}
                            </span>
                            <span className="office-status-badge office-status-badge-success">
                              {step.note}
                            </span>
                          </div>
                          <strong>{step.title}</strong>
                          <span>{step.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="listing-studio-detail-section-block">
                    <div className="listing-studio-card-meta">
                      <span className="office-status-badge office-status-badge-neutral">
                        {marketingKit.deliveryPlan.summary}
                      </span>
                    </div>
                    <strong>Readiness checklist</strong>
                    <div className="listing-studio-keyvalue-grid">
                      {marketingKit.deliveryPlan.checklist.map((item) => (
                        <div className="listing-studio-keyvalue-card" key={item.id}>
                          <div className="listing-studio-card-meta">
                            <span className={`office-status-badge ${item.ready ? "office-status-badge-success" : "office-status-badge-warning"}`}>
                              {item.ready ? "Ready" : "Review"}
                            </span>
                          </div>
                          <strong>{item.title}</strong>
                          <span>{item.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </details>

            <details className="listing-studio-disclosure-card">
              <summary className="listing-studio-disclosure-summary">
                <div>
                  <strong>Template briefs and campaign flights</strong>
                  <span>Higher-volume planning material stays collapsed until you actually need it.</span>
                </div>
                <span className="listing-studio-disclosure-toggle">Expand</span>
              </summary>
              <div className="listing-studio-disclosure-body">
                <div className="listing-studio-keyvalue-grid">
                  {marketingKit.templateBriefs.map((brief) => (
                    <div className="listing-studio-keyvalue-card" key={brief.id}>
                      <div className="listing-studio-card-meta">
                        <span className="office-status-badge office-status-badge-neutral">
                          {brief.note}
                        </span>
                        <span className="office-status-badge office-status-badge-success">
                          Template brief
                        </span>
                      </div>
                      <strong>{brief.title}</strong>
                      <span>{brief.description}</span>
                      <span className="listing-studio-prewrap">{brief.text}</span>
                      <div className="listing-studio-editor-actions">
                        <Button
                          onClick={() => void copyMarketingKitCopy(brief.title, brief.text)}
                          size="sm"
                          variant="secondary"
                        >
                          Copy brief
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="listing-studio-keyvalue-grid">
                  {marketingKit.flights.map((flight) => (
                    <div className="listing-studio-keyvalue-card" key={flight.id}>
                      <div className="listing-studio-card-meta">
                        <span className="office-status-badge office-status-badge-neutral">
                          {flight.note}
                        </span>
                        <span className="office-status-badge office-status-badge-success">
                          Flight plan
                        </span>
                      </div>
                      <strong>{flight.title}</strong>
                      <span>{flight.description}</span>
                      <span className="listing-studio-prewrap">
                        {flight.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}
                      </span>
                      <span className="listing-studio-prewrap">{flight.text}</span>
                      <div className="listing-studio-editor-actions">
                        <Button
                          onClick={() => void copyMarketingKitCopy(flight.title, flight.text)}
                          size="sm"
                          variant="secondary"
                        >
                          Copy flight
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            <details className="listing-studio-disclosure-card">
              <summary className="listing-studio-disclosure-summary">
                <div>
                  <strong>Variant blocks</strong>
                  <span>Keep the lower-level caption, blurb, and follow-up variants tucked away until needed.</span>
                </div>
                <span className="listing-studio-disclosure-toggle">Expand</span>
              </summary>
              <div className="listing-studio-disclosure-body">
                <div className="listing-studio-detail-section-list">
                  {marketingKit.sections.map((section) => (
                    <div className="listing-studio-detail-section-block" key={section.title}>
                      <div className="listing-studio-editor-actions listing-studio-inline-space-between">
                        <strong>{section.title}</strong>
                        <Button
                          onClick={() =>
                            void copyMarketingKitCopy(
                              `${section.title} block`,
                              [
                                section.title,
                                section.subtitle,
                                ...section.variants.map(
                                  (variant) => `\n${variant.label}\n${variant.note}\n${variant.text}`,
                                ),
                              ].join("\n"),
                            )
                          }
                          size="sm"
                          variant="ghost"
                        >
                          Copy section
                        </Button>
                      </div>
                      <p className="listing-studio-muted">{section.subtitle}</p>
                      <div className="listing-studio-keyvalue-grid">
                        {section.variants.map((variant) => (
                          <div className="listing-studio-keyvalue-card" key={variant.id}>
                            <div className="listing-studio-card-meta">
                              <span className="office-status-badge office-status-badge-neutral">
                                {variant.note}
                              </span>
                              <span className="office-status-badge office-status-badge-success">
                                {section.title}
                              </span>
                            </div>
                            <strong>{variant.label}</strong>
                            <span>{variant.text}</span>
                            <div className="listing-studio-editor-actions">
                              <Button
                                onClick={() => void copyMarketingKitCopy(variant.label, variant.text)}
                                size="sm"
                                variant="secondary"
                              >
                                Copy
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            <p className="listing-studio-muted">
              {marketingKit.summaryLine}. The kit keeps the scan link, contact block, and listing copy aligned.
            </p>
          </SectionCard>
        </div>

        <div className="listing-studio-detail-rail">
          <SectionCard
            className="office-list-card listing-studio-rail-priority-card"
            subtitle="The right rail now focuses on save, share, and export so the main column can stay editorial."
            title="Publish and export"
          >
            <div className="listing-studio-keyvalue-grid">
              <div className="listing-studio-keyvalue-card">
                <span>Save state</span>
                <strong>{isSaving ? "Saving in progress" : "Ready to save"}</strong>
                <span>Persist the current contact block, copy, and media selection back into this packet.</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Share page</span>
                <strong>{shareEnabled && shareUrl ? "Published" : "Not published"}</strong>
                <span>{shareEnabled && shareUrl ? shareUrl : "Publish when the packet should open as a public Acre page."}</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Poster export</span>
                <strong>{activePosterTemplate.label}</strong>
                <span>Preview, print, and HTML download all stay in sync with the current poster draft.</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>PDF export</span>
                <strong>Saved listing snapshot</strong>
                <span>The PDF follows the latest saved contact details, selected assets, and summary copy.</span>
              </div>
            </div>
            <div className="listing-studio-editor-actions">
              <Button disabled={isDeleting} onClick={savePack} variant="primary">
                {isSaving ? "Saving..." : "Save listing"}
              </Button>
              <Button
                disabled={isDeleting}
                onClick={publishShare}
                variant="secondary"
              >
                {isSharing ? "Publishing..." : shareEnabled ? "Refresh share link" : "Publish share"}
              </Button>
              <a
                className="office-button office-button-secondary"
                href={`/api/listing-studio/listings/${detail.packId}/pdf`}
                target="_blank"
              >
                Export PDF
              </a>
              {shareUrl ? (
                <>
                  <a
                    className="office-button office-button-secondary"
                    href={shareUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open share page
                  </a>
                  <Button disabled={isDeleting} onClick={copyShareUrl} variant="ghost">
                    Copy share link
                  </Button>
                </>
              ) : null}
            </div>
            <div className="listing-studio-editor-actions">
              <a
                className="office-button office-button-secondary"
                href={posterPrintUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open print view
              </a>
              <a
                className="office-button office-button-secondary"
                download
                href={posterDownloadUrl}
              >
                Download HTML
              </a>
              <Button onClick={() => void copyPosterCopy()} variant="ghost">
                Copy poster copy
              </Button>
            </div>
            {statusMessage ? (
              <p className="listing-studio-status-message">{statusMessage}</p>
            ) : null}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="The contact block and scan path are summarized here so you do not have to hunt for them inside the larger tools."
            title="Contact and scan"
          >
            <div className="listing-studio-keyvalue-grid">
              <div className="listing-studio-keyvalue-card">
                <span>Agent info</span>
                <strong>{contactName || "Acre listing studio"}</strong>
                <span>{contactTitle || "Listing presentation"}</span>
                <strong>{contactPhone || "Phone not published"}</strong>
                <span>{contactEmail || "Email not published"}</span>
              </div>
              <div className="listing-studio-keyvalue-card">
                <span>Scan path</span>
                <strong>{scanTargetLabel}</strong>
                <span>{scanTargetHint}</span>
                <strong>{scanTargetHref}</strong>
              </div>
            </div>
            <div className="listing-studio-editor-actions">
              <Button onClick={() => void copyScanLink()} variant="secondary">
                Copy scan link
              </Button>
              <a
                className="office-button office-button-secondary"
                href={scanTargetHref}
                rel="noreferrer"
                target="_blank"
              >
                Open scan link
              </a>
            </div>
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Original listing source and any file-like references stay grouped here."
            title="Source and files"
          >
            <div className="listing-studio-source-card">
              <span className="office-status-badge office-status-badge-neutral">
                {detail.sourceSite}
              </span>
              <a href={detail.sourceUrl} rel="noreferrer" target="_blank">
                Open original listing
              </a>
            </div>
            {detail.floorPlans.length ? (
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
            ) : (
              <p className="listing-studio-muted">No floor plan files were captured for this listing.</p>
            )}
          </SectionCard>

          <SectionCard
            className="office-list-card"
            subtitle="Delete this saved listing from Listing Studio."
            title="Danger zone"
          >
            <div className="listing-studio-editor-form">
              <p className="listing-studio-muted">
                This only deletes the local Listing Studio record. The source StreetEasy or Zillow page is untouched.
              </p>
              <Button
                disabled={isDeleting}
                onClick={() => setIsDeleteDialogOpen(true)}
                variant="danger"
              >
                {isDeleting ? "Deleting..." : "Delete listing"}
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
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
          You can always save the source page again later, but this saved listing will be gone.
        </p>
      </ConfirmActionDialog>
    </>
  );
}
