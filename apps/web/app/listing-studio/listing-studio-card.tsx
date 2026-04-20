"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConfirmActionDialog, FormField, TextInput } from "@acre/ui";
import { startTransition, useState } from "react";
import type {
  StudioListingCompanyFeedItem,
  StudioListingListItem,
} from "@acre/db";
import { StudioCollectionPicker } from "./studio-collection-picker";

type ListingStudioCardMode = "personal" | "dashboard";

const DEFAULT_COMPANY_FEED_LABEL = "Acre Featured";
const OTHER_COMPANY_FEED_LABEL = "Other";
const COMPANY_FEED_LABEL_OPTIONS = [
  "Acre Exclusive",
  "Acre Lising",
  "Acre Agent Rep",
  "Acre Featured",
  "Acre Off-Market",
] as const;

type CompanyFeedPresetLabel = (typeof COMPANY_FEED_LABEL_OPTIONS)[number];
type CompanyFeedLabelChoice = CompanyFeedPresetLabel | typeof OTHER_COMPANY_FEED_LABEL;

type ListingStudioCardProps = {
  item: StudioListingListItem | StudioListingCompanyFeedItem;
  mode?: ListingStudioCardMode;
  showCollectionPicker?: boolean;
  showDeleteAction?: boolean;
  canManageCompanyFeed?: boolean;
};

function getListingTypeLabel(listingType: string | null) {
  const normalized = listingType?.trim().toLowerCase();
  if (normalized === "sale") {
    return "For sale";
  }
  if (normalized === "rent") {
    return "Rental";
  }
  return null;
}

function readInitialSavedState(
  item: StudioListingListItem | StudioListingCompanyFeedItem,
) {
  if ("isSavedToMyListings" in item) {
    return item.isSavedToMyListings;
  }

  return Boolean(item.savedAt);
}

function resolveCompanyFeedLabel(
  label: string | null | undefined,
  companyFeedVisible: boolean,
) {
  const trimmedLabel = label?.trim() || null;

  return trimmedLabel ?? (companyFeedVisible ? DEFAULT_COMPANY_FEED_LABEL : null);
}

function readCompanyFeedLabelChoice(
  label: string | null | undefined,
): {
  choice: CompanyFeedLabelChoice;
  customLabel: string;
} {
  const normalizedLabel = label?.trim() || "";

  if (!normalizedLabel) {
    return {
      choice: DEFAULT_COMPANY_FEED_LABEL,
      customLabel: "",
    };
  }

  const presetChoice = COMPANY_FEED_LABEL_OPTIONS.find(
    (option) => option === normalizedLabel,
  );

  if (presetChoice) {
    return {
      choice: presetChoice,
      customLabel: "",
    };
  }

  return {
    choice: OTHER_COMPANY_FEED_LABEL,
    customLabel: normalizedLabel,
  };
}

function IconTrash() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M9 4.75h6m-8 3h10m-8.5 0 .55 9.2a1 1 0 0 0 1 .94h3.9a1 1 0 0 0 1-.94l.55-9.2M10 11.25v4.5m4-4.5v4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ListingStudioCard({
  item,
  mode = "personal",
  showCollectionPicker = false,
  showDeleteAction = false,
  canManageCompanyFeed = false,
}: ListingStudioCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listingTypeLabel = getListingTypeLabel(item.listingType);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isSavingToMyListings, setIsSavingToMyListings] = useState(false);
  const [isSavedToMyListings, setIsSavedToMyListings] = useState(
    readInitialSavedState(item),
  );
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [publishDialogError, setPublishDialogError] = useState<string | null>(null);
  const [isUpdatingCompanyFeed, setIsUpdatingCompanyFeed] = useState(false);
  const [companyFeedVisible, setCompanyFeedVisible] = useState(
    item.companyFeedVisible,
  );
  const [companyFeedLabel, setCompanyFeedLabel] = useState(
    resolveCompanyFeedLabel(item.companyFeedLabel, item.companyFeedVisible),
  );
  const initialCompanyFeedChoice = readCompanyFeedLabelChoice(
    resolveCompanyFeedLabel(item.companyFeedLabel, item.companyFeedVisible),
  );
  const [companyFeedLabelChoice, setCompanyFeedLabelChoice] =
    useState<CompanyFeedLabelChoice>(initialCompanyFeedChoice.choice);
  const [customCompanyFeedLabel, setCustomCompanyFeedLabel] = useState(
    initialCompanyFeedChoice.customLabel,
  );

  if (isHidden || (mode === "dashboard" && !companyFeedVisible)) {
    return null;
  }

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/listing-studio/listings/${item.packId}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to delete this listing.");
      }

      setIsDeleteDialogOpen(false);
      setIsHidden(true);

      const nextSearchParams = new URLSearchParams(searchParams.toString());
      nextSearchParams.set("deleted", "1");
      const nextQuery = nextSearchParams.toString();

      startTransition(() => {
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
        router.refresh();
      });
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to delete this listing.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSaveToMyListings() {
    if (isSavingToMyListings || isSavedToMyListings) {
      return;
    }

    setIsSavingToMyListings(true);

    try {
      const response = await fetch(
        `/api/listing-studio/listings/${item.packId}/save`,
        {
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to save this listing.");
      }

      setIsSavedToMyListings(true);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Unable to save this listing.",
      );
    } finally {
      setIsSavingToMyListings(false);
    }
  }

  function openPublishDialog() {
    const nextChoice = readCompanyFeedLabelChoice(
      resolveCompanyFeedLabel(companyFeedLabel, companyFeedVisible),
    );

    setCompanyFeedLabelChoice(nextChoice.choice);
    setCustomCompanyFeedLabel(nextChoice.customLabel);
    setPublishDialogError(null);
    setIsPublishDialogOpen(true);
  }

  async function handleCompanyFeedToggle(
    nextVisible: boolean,
    nextLabel?: string | null,
  ) {
    if (isUpdatingCompanyFeed) {
      return;
    }

    setIsUpdatingCompanyFeed(true);

    try {
      const response = await fetch(`/api/listing-studio/listings/${item.packId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyFeedVisible: nextVisible,
          ...(nextLabel !== undefined ? { companyFeedLabel: nextLabel } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to update company dashboard visibility.",
        );
      }

      setCompanyFeedVisible(nextVisible);
      if (nextLabel !== undefined) {
        setCompanyFeedLabel(resolveCompanyFeedLabel(nextLabel, nextVisible));
      } else if (nextVisible) {
        setCompanyFeedLabel((currentLabel) =>
          resolveCompanyFeedLabel(currentLabel, true),
        );
      }
      setPublishDialogError(null);
      setIsPublishDialogOpen(false);
      if (mode === "dashboard" && !nextVisible) {
        setIsHidden(true);
      }
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to update company dashboard visibility.",
      );
    } finally {
      setIsUpdatingCompanyFeed(false);
    }
  }

  async function handlePublishToDashboard() {
    const nextLabel =
      companyFeedLabelChoice === OTHER_COMPANY_FEED_LABEL
        ? customCompanyFeedLabel.trim()
        : companyFeedLabelChoice;

    if (!nextLabel) {
      setPublishDialogError("Enter a custom label before publishing.");
      return;
    }

    await handleCompanyFeedToggle(true, nextLabel);
  }

  return (
    <>
      <article className="listing-studio-card">
        {showDeleteAction ? (
          <div className="listing-studio-card-top-actions">
            <button
              aria-label={`Delete ${item.displayTitle || item.addressLine}`}
              className="listing-studio-card-delete-button"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDeleteDialogOpen(true);
              }}
              title="Delete listing"
              type="button"
            >
              <IconTrash />
            </button>
          </div>
        ) : null}

        <Link
          className="listing-studio-card-link"
          href={`/listing-studio/listings/${item.packId}`}
        >
          <div className="listing-studio-card-media">
            {listingTypeLabel ? (
              <span className="listing-studio-card-media-badge">{listingTypeLabel}</span>
            ) : null}
            {item.heroAssetId ? (
              <img
                alt={item.displayTitle || item.addressLine}
                src={`/api/listing-studio/assets/${item.heroAssetId}`}
              />
            ) : (
              <div className="listing-studio-card-media-fallback">
                {item.sourceSite === "streeteasy" ? "StreetEasy" : "Zillow"}
              </div>
            )}
          </div>
          <div className="listing-studio-card-body">
            <div className="listing-studio-card-meta">
              <span className="office-status-badge office-status-badge-neutral">
                {item.sourceSite}
              </span>
              {item.shareEnabled ? (
                <span className="office-status-badge office-status-badge-success">
                  Shared
                </span>
              ) : null}
              {companyFeedVisible ? (
                <span className="office-status-badge office-status-badge-accent">
                  {companyFeedLabel || DEFAULT_COMPANY_FEED_LABEL}
                </span>
              ) : null}
            </div>
            <strong>{item.priceLabel}</strong>
            {item.displayTitle ? (
              <span className="listing-studio-card-title">{item.displayTitle}</span>
            ) : null}
            <span className="listing-studio-card-address">{item.addressLine}</span>
            {item.locationLine ? (
              <span className="listing-studio-card-location">{item.locationLine}</span>
            ) : null}
            <span className="listing-studio-card-facts">{item.factsLine}</span>
            {item.statusLabel ? (
              <span className="listing-studio-card-status">{item.statusLabel}</span>
            ) : null}
          </div>
        </Link>

        {mode === "dashboard" || showCollectionPicker || canManageCompanyFeed ? (
          <div className="listing-studio-card-footer listing-studio-card-footer-actions">
            {mode === "dashboard" ? (
              <button
                className={`office-button ${isSavedToMyListings ? "office-button-secondary" : "office-button-primary"}`}
                disabled={isSavingToMyListings || isSavedToMyListings}
                onClick={() => void handleSaveToMyListings()}
                type="button"
              >
                {isSavingToMyListings
                  ? "Adding..."
                  : isSavedToMyListings
                    ? "Added to my listings"
                    : "+ Add to my listings"}
              </button>
            ) : null}

            {showCollectionPicker ? (
              <StudioCollectionPicker
                buttonLabel="Add to collection"
                packId={item.packId}
              />
            ) : null}

            {canManageCompanyFeed ? (
              <button
                className="office-button office-button-secondary"
                disabled={isUpdatingCompanyFeed}
                onClick={() =>
                  mode === "dashboard" || companyFeedVisible
                    ? void handleCompanyFeedToggle(false)
                    : openPublishDialog()
                }
                type="button"
              >
                {isUpdatingCompanyFeed
                  ? mode === "dashboard" || companyFeedVisible
                    ? "Updating..."
                    : "Publishing..."
                  : mode === "dashboard" || companyFeedVisible
                    ? "Remove from dashboard"
                    : "Publish to dashboard"}
              </button>
            ) : null}
          </div>
        ) : null}
      </article>

      <ConfirmActionDialog
        cancelLabel="Keep listing"
        confirmLabel={isDeleting ? "Deleting..." : "Delete listing"}
        confirmVariant="danger"
        description="This will permanently remove the saved packet, its imported assets, and its collection memberships."
        isOpen={isDeleteDialogOpen}
        onCancel={() => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(false);
          }
        }}
        onConfirm={() => {
          void handleDelete();
        }}
        title={`Delete ${item.displayTitle || item.addressLine}?`}
      >
        <p>This action cannot be undone.</p>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        cancelLabel="Cancel"
        confirmLabel={isUpdatingCompanyFeed ? "Publishing..." : "Confirm"}
        confirmVariant="primary"
        description="Choose the status label that should appear on this card after it is published to the company dashboard."
        isOpen={isPublishDialogOpen}
        onCancel={() => {
          if (!isUpdatingCompanyFeed) {
            setPublishDialogError(null);
            setIsPublishDialogOpen(false);
          }
        }}
        onConfirm={() => {
          void handlePublishToDashboard();
        }}
        title={`Publish ${item.displayTitle || item.addressLine} to dashboard?`}
      >
        <div className="listing-studio-publish-dialog">
          <div
            aria-label="Company dashboard status label"
            className="listing-studio-publish-options"
            role="radiogroup"
          >
            {COMPANY_FEED_LABEL_OPTIONS.map((option) => (
              <label
                className={`listing-studio-publish-option${companyFeedLabelChoice === option ? " is-selected" : ""}`}
                key={option}
              >
                <input
                  checked={companyFeedLabelChoice === option}
                  name={`company-feed-label-${item.packId}`}
                  onChange={() => {
                    setCompanyFeedLabelChoice(option);
                    setPublishDialogError(null);
                  }}
                  type="radio"
                  value={option}
                />
                <span>{option}</span>
              </label>
            ))}

            <label
              className={`listing-studio-publish-option${companyFeedLabelChoice === OTHER_COMPANY_FEED_LABEL ? " is-selected" : ""}`}
            >
              <input
                checked={companyFeedLabelChoice === OTHER_COMPANY_FEED_LABEL}
                name={`company-feed-label-${item.packId}`}
                onChange={() => {
                  setCompanyFeedLabelChoice(OTHER_COMPANY_FEED_LABEL);
                  setPublishDialogError(null);
                }}
                type="radio"
                value={OTHER_COMPANY_FEED_LABEL}
              />
              <span>{OTHER_COMPANY_FEED_LABEL}</span>
            </label>
          </div>

          {companyFeedLabelChoice === OTHER_COMPANY_FEED_LABEL ? (
            <FormField label="Custom label">
              <TextInput
                maxLength={48}
                onChange={(event) => {
                  setCustomCompanyFeedLabel(event.target.value);
                  setPublishDialogError(null);
                }}
                placeholder="Enter a custom dashboard label"
                value={customCompanyFeedLabel}
              />
            </FormField>
          ) : null}

          {publishDialogError ? (
            <p className="listing-studio-publish-error">{publishDialogError}</p>
          ) : null}
        </div>
      </ConfirmActionDialog>
    </>
  );
}
