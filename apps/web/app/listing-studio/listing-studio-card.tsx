"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConfirmActionDialog, FormField, TextInput } from "@acre/ui";
import { startTransition, useState } from "react";
import type {
  StudioListingCompanyFeedItem,
  StudioListingListItem,
} from "@acre/db";
import { useI18n } from "../../lib/i18n/client";
import { StudioCollectionPicker } from "./studio-collection-picker";

type ListingStudioCardMode = "personal" | "dashboard";
type ListingStudioDeleteActionMode =
  | "delete_listing"
  | "remove_from_my_listings";

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
  collectionPickerButtonLabel?: string;
  showDeleteAction?: boolean;
  deleteActionMode?: ListingStudioDeleteActionMode;
  canManageCompanyFeed?: boolean;
  onRemoveFromCollection?: ((packId: string) => Promise<void> | void) | null;
  removeFromCollectionLabel?: string;
};

function getListingTypeLabel(listingType: string | null, isZh: boolean) {
  const normalized = listingType?.trim().toLowerCase();
  if (normalized === "sale") {
    return isZh ? "出售" : "For sale";
  }
  if (normalized === "rent") {
    return isZh ? "出租" : "Rental";
  }
  return null;
}

function formatListingText(value: string | null | undefined, isZh: boolean) {
  if (!value || !isZh) {
    return value ?? "";
  }

  return value
    .replace(/\bBeds?\b/gi, "卧室")
    .replace(/\bBaths?\b/gi, "卫浴")
    .replace(/\bSq\.?\s?Ft\.?\b/gi, "平方英尺")
    .replace(/\bSquare Feet\b/gi, "平方英尺")
    .replace(/\bFor sale\b/gi, "出售")
    .replace(/\bRental\b/gi, "出租")
    .replace(/\bActive\b/gi, "在售")
    .replace(/\bPending\b/gi, "待成交")
    .replace(/\bClosed\b/gi, "已成交")
    .replace(/\bOff market\b/gi, "未公开");
}

function formatCompanyFeedLabel(value: string | null | undefined, isZh: boolean) {
  if (!value || !isZh) {
    return value ?? "";
  }

  switch (value) {
    case "Acre Exclusive":
      return "Acre 独家";
    case "Acre Lising":
      return "Acre 房源";
    case "Acre Agent Rep":
      return "Acre 经纪代理";
    case "Acre Featured":
      return "Acre 精选";
    case "Acre Off-Market":
      return "Acre 非公开";
    case OTHER_COMPANY_FEED_LABEL:
      return "其他";
    default:
      return value;
  }
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
        d="M9 4.25h6m-9.25 3h12.5m-10.9 0 .78 11.15a1.45 1.45 0 0 0 1.45 1.35h4.84a1.45 1.45 0 0 0 1.45-1.35l.78-11.15M10.25 10.75v5.8m3.5-5.8v5.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.05"
      />
    </svg>
  );
}

export function ListingStudioCard({
  item,
  mode = "personal",
  showCollectionPicker = false,
  collectionPickerButtonLabel = "Add to collection",
  showDeleteAction = false,
  deleteActionMode = "delete_listing",
  canManageCompanyFeed = false,
  onRemoveFromCollection = null,
  removeFromCollectionLabel = "Remove from collection",
}: ListingStudioCardProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listingTypeLabel = getListingTypeLabel(item.listingType, isZh);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isSavingToMyListings, setIsSavingToMyListings] = useState(false);
  const [isSavedToMyListings, setIsSavedToMyListings] = useState(
    readInitialSavedState(item),
  );
  const [isRemovingFromCollection, setIsRemovingFromCollection] = useState(false);
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
  const resolvedDeleteActionMode = showDeleteAction ? deleteActionMode : null;
  const companyFeedMediaBadgeLabel = companyFeedVisible
    ? companyFeedLabel || DEFAULT_COMPANY_FEED_LABEL
    : null;
  const resolvedCollectionPickerButtonLabel =
    collectionPickerButtonLabel === "Add to collection" && isZh
      ? "加入清单"
      : collectionPickerButtonLabel;
  const resolvedRemoveFromCollectionLabel =
    removeFromCollectionLabel === "Remove from collection" && isZh
      ? "从清单移除"
      : removeFromCollectionLabel;

  if (isHidden || (mode === "dashboard" && !companyFeedVisible)) {
    return null;
  }

  async function handleDelete() {
    if (isDeleting || !resolvedDeleteActionMode) {
      return;
    }

    setIsDeleting(true);

    try {
      const isRemovingFromMyListings =
        resolvedDeleteActionMode === "remove_from_my_listings";
      const response = await fetch(
        isRemovingFromMyListings
          ? `/api/listing-studio/listings/${item.packId}/save`
          : `/api/listing-studio/listings/${item.packId}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          isZh
            ? isRemovingFromMyListings
              ? "无法从我的房源中移除。"
              : "无法删除这套房源。"
            : payload?.error ||
                (isRemovingFromMyListings
                  ? "Unable to remove this listing from My listings."
                  : "Unable to delete this listing."),
        );
      }

      setIsDeleteDialogOpen(false);
      setIsHidden(true);

      const nextSearchParams = new URLSearchParams(searchParams.toString());
      if (isRemovingFromMyListings) {
        nextSearchParams.delete("deleted");
        nextSearchParams.set("removed", "1");
      } else {
        nextSearchParams.delete("removed");
        nextSearchParams.set("deleted", "1");
      }
      const nextQuery = nextSearchParams.toString();

      startTransition(() => {
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
        router.refresh();
      });
    } catch (error) {
      window.alert(
        isZh
          ? resolvedDeleteActionMode === "remove_from_my_listings"
            ? "无法从我的房源中移除。"
            : "无法删除这套房源。"
          : error instanceof Error
            ? error.message
            : resolvedDeleteActionMode === "remove_from_my_listings"
              ? "Unable to remove this listing from My listings."
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
        throw new Error(
          isZh ? "无法保存这套房源。" : payload?.error || "Unable to save this listing.",
        );
      }

      setIsSavedToMyListings(true);
    } catch (error) {
      window.alert(
        isZh
          ? "无法保存这套房源。"
          : error instanceof Error
            ? error.message
            : "Unable to save this listing.",
      );
    } finally {
      setIsSavingToMyListings(false);
    }
  }

  async function handleRemoveFromCollection() {
    if (!onRemoveFromCollection || isRemovingFromCollection) {
      return;
    }

    setIsRemovingFromCollection(true);

    try {
      await onRemoveFromCollection(item.packId);
    } catch (error) {
      window.alert(
        isZh
          ? "无法从清单中移除这套房源。"
          : error instanceof Error
            ? error.message
            : "Unable to remove this listing from the collection.",
      );
    } finally {
      setIsRemovingFromCollection(false);
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
          isZh
            ? "无法更新公司面板显示状态。"
            : payload?.error || "Unable to update company dashboard visibility.",
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
        isZh
          ? "无法更新公司面板显示状态。"
          : error instanceof Error
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
      setPublishDialogError(
        isZh ? "发布前请输入自定义标签。" : "Enter a custom label before publishing.",
      );
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
              aria-label={
                isZh
                  ? `${resolvedDeleteActionMode === "remove_from_my_listings" ? "移除" : "删除"} ${item.displayTitle || item.addressLine}`
                  : `${resolvedDeleteActionMode === "remove_from_my_listings" ? "Remove" : "Delete"} ${item.displayTitle || item.addressLine}`
              }
              className="listing-studio-card-delete-button"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDeleteDialogOpen(true);
              }}
              title={
                resolvedDeleteActionMode === "remove_from_my_listings"
                  ? isZh
                    ? "从我的房源移除"
                    : "Remove from My listings"
                  : isZh
                    ? "删除房源"
                    : "Delete listing"
              }
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
            {listingTypeLabel || companyFeedMediaBadgeLabel ? (
              <div className="listing-studio-card-media-badges">
                {companyFeedMediaBadgeLabel ? (
                  <span className="listing-studio-card-media-badge">
                    {formatCompanyFeedLabel(companyFeedMediaBadgeLabel, isZh)}
                  </span>
                ) : null}
                {listingTypeLabel ? (
                  <span className="listing-studio-card-media-badge">{listingTypeLabel}</span>
                ) : null}
              </div>
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
                  {isZh ? "已分享" : "Shared"}
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
            <span className="listing-studio-card-facts">
              {formatListingText(item.factsLine, isZh)}
            </span>
            {item.statusLabel ? (
              <span className="listing-studio-card-status">
                {formatListingText(item.statusLabel, isZh)}
              </span>
            ) : null}
          </div>
        </Link>

        {mode === "dashboard" ||
        showCollectionPicker ||
        canManageCompanyFeed ||
        onRemoveFromCollection ? (
          <div className="listing-studio-card-footer listing-studio-card-footer-actions">
            {mode === "dashboard" ? (
              <button
                className={`office-button ${isSavedToMyListings ? "office-button-secondary" : "office-button-primary"}`}
                disabled={isSavingToMyListings || isSavedToMyListings}
                onClick={() => void handleSaveToMyListings()}
                type="button"
              >
                {isSavingToMyListings
                  ? isZh
                    ? "正在加入..."
                    : "Adding..."
                  : isSavedToMyListings
                    ? isZh
                      ? "已加入我的房源"
                      : "Added to my listings"
                    : isZh
                      ? "+ 加入我的房源"
                      : "+ Add to my listings"}
              </button>
            ) : null}

            {onRemoveFromCollection ? (
              <button
                className="office-button office-button-secondary listing-studio-card-remove-button"
                disabled={isRemovingFromCollection}
                onClick={() => void handleRemoveFromCollection()}
                type="button"
              >
                {isRemovingFromCollection
                  ? isZh
                    ? "正在移除..."
                    : "Removing..."
                  : resolvedRemoveFromCollectionLabel}
              </button>
            ) : null}

            {showCollectionPicker ? (
              <StudioCollectionPicker
                buttonLabel={resolvedCollectionPickerButtonLabel}
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
                    ? isZh
                      ? "正在更新..."
                      : "Updating..."
                    : isZh
                      ? "正在发布..."
                      : "Publishing..."
                  : mode === "dashboard" || companyFeedVisible
                    ? isZh
                      ? "从公司面板移除"
                      : "Remove from dashboard"
                    : isZh
                      ? "发布到公司面板"
                      : "Publish to dashboard"}
              </button>
            ) : null}
          </div>
        ) : null}
      </article>

      <ConfirmActionDialog
        cancelLabel={isZh ? "保留房源" : "Keep listing"}
        confirmLabel={
          isDeleting
            ? resolvedDeleteActionMode === "remove_from_my_listings"
              ? isZh
                ? "正在移除..."
                : "Removing..."
              : isZh
                ? "正在删除..."
                : "Deleting..."
            : resolvedDeleteActionMode === "remove_from_my_listings"
              ? isZh
                ? "从我的房源移除"
                : "Remove from my listings"
              : isZh
                ? "删除房源"
                : "Delete listing"
        }
        confirmVariant="danger"
        description={
          resolvedDeleteActionMode === "remove_from_my_listings"
            ? isZh
              ? "这会把房源从你的个人工作区以及包含它的客户清单中移除，公司共享的原始资料仍会保留。"
              : "This will remove the listing from your personal workspace and from any of your collections that currently include it. The shared company packet will stay available."
            : isZh
              ? "这会永久删除已保存资料、导入的媒体以及相关清单关联。"
              : "This will permanently remove the saved packet, its imported assets, and its collection memberships."
        }
        isOpen={isDeleteDialogOpen}
        onCancel={() => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(false);
          }
        }}
        onConfirm={() => {
          void handleDelete();
        }}
        title={
          resolvedDeleteActionMode === "remove_from_my_listings"
            ? isZh
              ? `从我的房源移除 ${item.displayTitle || item.addressLine}？`
              : `Remove ${item.displayTitle || item.addressLine} from My listings?`
            : isZh
              ? `删除 ${item.displayTitle || item.addressLine}？`
              : `Delete ${item.displayTitle || item.addressLine}?`
        }
      >
        <p>
          {resolvedDeleteActionMode === "remove_from_my_listings"
            ? isZh
              ? "之后仍可从公司面板重新加入。"
              : "You can always add it back again from the company dashboard later."
            : isZh
              ? "此操作无法撤销。"
              : "This action cannot be undone."}
        </p>
      </ConfirmActionDialog>

      <ConfirmActionDialog
        cancelLabel={isZh ? "取消" : "Cancel"}
        confirmLabel={
          isUpdatingCompanyFeed
            ? isZh
              ? "正在发布..."
              : "Publishing..."
            : isZh
              ? "确认"
              : "Confirm"
        }
        confirmVariant="primary"
        description={
          isZh
            ? "选择发布到公司面板后显示在房源卡片上的状态标签。"
            : "Choose the status label that should appear on this card after it is published to the company dashboard."
        }
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
        title={
          isZh
            ? `发布 ${item.displayTitle || item.addressLine} 到公司面板？`
            : `Publish ${item.displayTitle || item.addressLine} to dashboard?`
        }
      >
        <div className="listing-studio-publish-dialog">
          <div
            aria-label={
              isZh ? "公司面板状态标签" : "Company dashboard status label"
            }
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
                <span>{formatCompanyFeedLabel(option, isZh)}</span>
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
              <span>{formatCompanyFeedLabel(OTHER_COMPANY_FEED_LABEL, isZh)}</span>
            </label>
          </div>

          {companyFeedLabelChoice === OTHER_COMPANY_FEED_LABEL ? (
            <FormField label={isZh ? "自定义标签" : "Custom label"}>
              <TextInput
                maxLength={48}
                onChange={(event) => {
                  setCustomCompanyFeedLabel(event.target.value);
                  setPublishDialogError(null);
                }}
                placeholder={
                  isZh
                    ? "输入自定义公司面板标签"
                    : "Enter a custom dashboard label"
                }
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
