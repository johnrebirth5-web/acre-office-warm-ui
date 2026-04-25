"use client";

import { copyTextToClipboard } from "../../../office/settings/users/users-shared";
import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import type {
  StudioListingCollectionDetail,
  StudioListingListItem,
} from "@acre/db";
import { useI18n } from "../../../../lib/i18n/client";
import { ListingStudioCard } from "../../listing-studio-card";
import { DeleteCollectionButton } from "../delete-collection-button";
import { ListingStudioCollectionMap } from "./listing-studio-collection-map";

type ListingStudioCollectionDetailClientProps = {
  detail: StudioListingCollectionDetail;
  availableListings: StudioListingListItem[];
};

type CollectionDetailResponse =
  | StudioListingCollectionDetail
  | {
      error?: string;
    }
  | null;

type CollectionShareResponse =
  | {
      shareCode: string;
      shareUrl: string;
    }
  | {
      error?: string;
    }
  | null;

type ShareMethod = "copy-with-message" | "wechat-card";

function isCollectionDetail(
  value: CollectionDetailResponse,
): value is StudioListingCollectionDetail {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "listings" in value &&
      Array.isArray(value.listings),
  );
}

function formatRelativeDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return locale === "zh-CN" ? "最近更新" : "Recently updated";
  }

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ListingStudioCollectionDetailClient({
  detail,
  availableListings,
}: ListingStudioCollectionDetailClientProps) {
  const [detailState, setDetailState] = useState(detail);
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareDialogMessage, setShareDialogMessage] = useState("");
  const [shareMethod, setShareMethod] = useState<ShareMethod>("copy-with-message");
  const [copyingShareMethod, setCopyingShareMethod] = useState<ShareMethod | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>(
    detail.listings.map((item) => item.packId),
  );
  const deferredSearch = useDeferredValue(search);
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const isCopyingShareLink = copyingShareMethod !== null;

  const currentPackIds = useMemo(
    () => new Set(detailState.listings.map((item) => item.packId)),
    [detailState.listings],
  );

  const filteredAvailableListings = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return availableListings;
    }

    return availableListings.filter((item) =>
      [item.displayTitle, item.addressLine, item.locationLine, item.priceLabel]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query)),
    );
  }, [availableListings, deferredSearch]);

  const pendingSelectionSet = useMemo(
    () => new Set(selectedPackIds),
    [selectedPackIds],
  );

  const hasSelectionChanges = useMemo(() => {
    if (pendingSelectionSet.size !== currentPackIds.size) {
      return true;
    }

    return Array.from(pendingSelectionSet).some((packId) => !currentPackIds.has(packId));
  }, [currentPackIds, pendingSelectionSet]);

  function applyDetailState(nextDetail: StudioListingCollectionDetail) {
    startTransition(() => {
      setDetailState(nextDetail);
      setSelectedPackIds(
        nextDetail.listings.map(
          (item: StudioListingCollectionDetail["listings"][number]) => item.packId,
        ),
      );
    });
  }

  function openManager() {
    setSelectedPackIds(detailState.listings.map((item) => item.packId));
    setSearch("");
    setIsManagerOpen(true);
  }

  function togglePack(packId: string) {
    setSelectedPackIds((current) =>
      current.includes(packId)
        ? current.filter((value) => value !== packId)
        : [...current, packId],
    );
  }

  function openShareDialog() {
    setShareMethod("copy-with-message");
    setShareDialogMessage("");
    setIsShareDialogOpen(true);
  }

  async function copyShareLink(nextShareMethod: ShareMethod) {
    if (isCopyingShareLink) {
      return;
    }

    setShareMethod(nextShareMethod);
    setCopyingShareMethod(nextShareMethod);
    setStatusMessage("");
    setShareDialogMessage("");

    try {
      const response = await fetch(
        `/api/listing-studio/collections/${detailState.id}/share`,
        {
          method: "POST",
        },
      );
      const payload = (await response.json().catch(() => null)) as CollectionShareResponse;

      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        !("shareUrl" in payload) ||
        typeof payload.shareUrl !== "string" ||
        typeof payload.shareCode !== "string"
      ) {
        throw new Error(isZh ? "无法复制分享链接。" : "Unable to copy the share link.");
      }

      setDetailState((current) => ({
        ...current,
        shareEnabled: true,
        shareCode: payload.shareCode,
      }));
      await copyTextToClipboard(payload.shareUrl);
      if (nextShareMethod === "wechat-card") {
        setShareDialogMessage(
          isZh
            ? "链接已复制。请按说明在微信内打开并分享卡片。"
            : "Link copied. Follow the steps below to share the WeChat card.",
        );
      } else {
        setShareDialogMessage(
          isZh
            ? "链接已复制。可以直接发给客户。"
            : "Link copied. Send it to your client so they can open it in a browser.",
        );
      }
    } catch {
      setShareDialogMessage(isZh ? "复制失败。" : "Unable to copy the share link.");
    } finally {
      setCopyingShareMethod(null);
    }
  }

  async function refreshCollection() {
    const response = await fetch(
      `/api/listing-studio/collections/${detailState.id}`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as CollectionDetailResponse;

    if (!response.ok || !isCollectionDetail(payload)) {
      throw new Error(
        isZh
          ? "无法刷新清单。"
          : payload && typeof payload === "object" && "error" in payload
            ? payload.error || "Unable to refresh the collection."
            : "Unable to refresh the collection.",
      );
    }

    applyDetailState(payload);
  }

  async function removeListingFromCollection(packId: string) {
    setStatusMessage("");

    const response = await fetch(
      `/api/listing-studio/collections/${detailState.id}/items/${packId}`,
      {
        method: "DELETE",
      },
    );
    const payload = (await response.json().catch(() => null)) as CollectionDetailResponse;

    if (!response.ok || !isCollectionDetail(payload)) {
      throw new Error(
        isZh
          ? "无法从清单中移除这套房源。"
          : payload && typeof payload === "object" && "error" in payload
            ? payload.error || "Unable to remove the listing from this collection."
            : "Unable to remove the listing from this collection.",
      );
    }

    applyDetailState(payload);
    setStatusMessage(
      isZh
        ? "房源已从此清单中移除。"
        : "Listing removed from this collection.",
    );
  }

  async function saveSelectionChanges() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    const additions = selectedPackIds.filter((packId) => !currentPackIds.has(packId));
    const removals = Array.from(currentPackIds).filter(
      (packId) => !pendingSelectionSet.has(packId),
    );

    try {
      if (additions.length || removals.length) {
        await Promise.all([
          ...additions.map(async (packId) => {
            const response = await fetch(
              `/api/listing-studio/collections/${detailState.id}/items`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ packId }),
              },
            );
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as
                | { error?: string }
                | null;
              throw new Error(
                isZh
                  ? "无法把房源加入清单。"
                  : payload?.error || "Unable to add listings to the collection.",
              );
            }
          }),
          ...removals.map(async (packId) => {
            const response = await fetch(
              `/api/listing-studio/collections/${detailState.id}/items/${packId}`,
              {
                method: "DELETE",
              },
            );
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as
                | { error?: string }
                | null;
              throw new Error(
                isZh
                  ? "无法从清单中移除房源。"
                  : payload?.error || "Unable to remove listings from the collection.",
              );
            }
          }),
        ]);
      }

      await refreshCollection();
      setIsManagerOpen(false);
      setStatusMessage(isZh ? "清单房源已更新。" : "Collection listings updated.");
    } catch (error) {
      setStatusMessage(
        isZh
          ? "无法更新清单。"
          : error instanceof Error
            ? error.message
            : "Unable to update the collection.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="listing-studio-collection-detail-page">
      <section className="office-page-header listing-studio-header listing-studio-header-with-actions">
        <div className="office-page-heading">
          <span className="office-eyebrow">
            {isZh ? "客户清单" : "Collections"}
          </span>
          <h2>{detailState.name}</h2>
          <p>
            {isZh
              ? `此清单中有 ${detailState.listingCount} 套已保存房源。更新于 ${formatRelativeDate(
                  detailState.updatedAt,
                  locale,
                )}。`
              : `${detailState.listingCount} saved listing${
                  detailState.listingCount === 1 ? "" : "s"
                } in this folder. Updated ${formatRelativeDate(
                  detailState.updatedAt,
                  locale,
                )}.`}
          </p>
        </div>

        <div className="office-page-actions listing-studio-header-actions">
          <button
            className="office-button office-button-secondary"
            onClick={openShareDialog}
            type="button"
          >
            {isZh ? "分享" : "Share"}
          </button>
          <button
            className="office-button office-button-secondary"
            onClick={openManager}
            type="button"
          >
            {isZh ? "添加房源" : "Add listings"}
          </button>
          <DeleteCollectionButton
            collectionId={detailState.id}
            collectionName={detailState.name}
            onError={(message) => setStatusMessage(message)}
          />
        </div>
      </section>

      {statusMessage ? (
        <p className="listing-studio-status-message">{statusMessage}</p>
      ) : null}

      {isShareDialogOpen ? (
        <div
          className="office-modal-overlay"
          onClick={() => {
            if (!isCopyingShareLink) {
              setIsShareDialogOpen(false);
            }
          }}
        >
          <section
            aria-label={isZh ? "分享清单" : "Share collection"}
            aria-modal="true"
            className="office-modal listing-studio-share-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="listing-studio-share-dialog-header">
              <div>
                <span>{isZh ? "客户分享" : "Client share"}</span>
                <h3>{isZh ? "分享清单" : "Share Collection"}</h3>
              </div>
              <button
                aria-label={isZh ? "关闭分享弹窗" : "Close share dialog"}
                disabled={isCopyingShareLink}
                onClick={() => setIsShareDialogOpen(false)}
                type="button"
              >
                x
              </button>
            </header>

            <div
              aria-label={isZh ? "分享方式" : "Share methods"}
              className="listing-studio-share-dialog-methods"
              role="group"
            >
              <button
                aria-pressed={shareMethod === "copy-with-message"}
                className={cx(
                  "listing-studio-share-dialog-method",
                  shareMethod === "copy-with-message" && "is-active",
                )}
                disabled={isCopyingShareLink}
                onClick={() => void copyShareLink("copy-with-message")}
                type="button"
              >
                {copyingShareMethod === "copy-with-message"
                  ? isZh
                    ? "正在复制..."
                    : "Copying..."
                  : isZh
                    ? "复制链接与说明"
                    : "Copy with message"}
              </button>
              <button
                aria-pressed={shareMethod === "wechat-card"}
                className={cx(
                  "listing-studio-share-dialog-method",
                  shareMethod === "wechat-card" && "is-active",
                )}
                disabled={isCopyingShareLink}
                onClick={() => void copyShareLink("wechat-card")}
                type="button"
              >
                {copyingShareMethod === "wechat-card"
                  ? isZh
                    ? "正在复制..."
                    : "Copying..."
                  : isZh
                    ? "微信卡片"
                    : "WeChat card"}
              </button>
            </div>

            {shareDialogMessage ? (
              <p
                aria-live="polite"
                className="listing-studio-share-dialog-status"
                role="status"
              >
                {shareDialogMessage}
              </p>
            ) : null}

            {shareMethod === "wechat-card" ? (
              <div className="listing-studio-share-dialog-wechat">
                <ol>
                  <li>
                    {isZh
                      ? "先在微信内打开这个链接，例如发给自己后在聊天中点击。"
                      : "First, open this link inside WeChat (for example, send it to yourself and tap the link in a chat)."}
                  </li>
                  <li>
                    {isZh
                      ? "页面在微信浏览器中打开后，点击右上角菜单。"
                      : "When the page is open in WeChat's browser, tap the menu button in the top-right corner."}
                  </li>
                  <li>
                    {isZh
                      ? "选择“发送给朋友”或“分享到朋友圈”，微信会展示带清单预览的卡片。"
                      : 'Choose "Send to Chat" or "Share to Moments". WeChat will show a card with the collection preview.'}
                  </li>
                </ol>
              </div>
            ) : (
              <p className="listing-studio-share-dialog-copy">
                {isZh
                  ? "复制链接后直接发给客户。客户点击链接，即可在浏览器中查看这组房源。"
                  : "Copy the link and send it to your client. They can open it in a browser to view the collection."}
              </p>
            )}
          </section>
        </div>
      ) : null}

      {isManagerOpen ? (
        <section className="listing-studio-collection-manager">
          <div className="listing-studio-collection-manager-header">
            <div>
              <strong>
                {isZh ? "管理清单房源" : "Manage collection listings"}
              </strong>
              <p>
                {isZh
                  ? "搜索所有已导入的房源资料，并选择哪些应加入此清单。"
                  : "Search all imported Listing Studio packets, then decide which ones belong in this collection."}
              </p>
            </div>
            <button
              className="office-button office-button-secondary"
              onClick={() => setIsManagerOpen(false)}
              type="button"
            >
              {isZh ? "关闭" : "Close"}
            </button>
          </div>

          <label className="listing-studio-shell-search">
            <span>{isZh ? "搜索已导入房源" : "Search imported listings"}</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                isZh
                  ? "地址、楼宇、街区、价格..."
                  : "Address, building, neighborhood, price..."
              }
              value={search}
            />
          </label>

          <div className="listing-studio-collection-option-list">
            {filteredAvailableListings.length ? (
              filteredAvailableListings.map((item) => {
                const isSelected = pendingSelectionSet.has(item.packId);

                return (
                  <button
                    className={cx(
                      "listing-studio-collection-option",
                      isSelected && "is-selected",
                    )}
                    key={item.packId}
                    onClick={() => togglePack(item.packId)}
                    type="button"
                  >
                    <span className="listing-studio-collection-option-check">
                      {isSelected
                        ? isZh
                          ? "已选择"
                          : "Selected"
                        : isZh
                          ? "添加"
                          : "Add"}
                    </span>
                    <div className="listing-studio-collection-option-copy">
                      <strong>{item.displayTitle || item.addressLine}</strong>
                      <span>{item.addressLine}</span>
                      {item.locationLine ? <span>{item.locationLine}</span> : null}
                    </div>
                    <span className="listing-studio-collection-option-price">
                      {item.priceLabel}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="listing-studio-empty-state">
                <strong>
                  {isZh
                    ? "没有符合搜索条件的已导入房源。"
                    : "No imported listings match this search."}
                </strong>
                <p>
                  {isZh
                    ? "可以尝试更宽泛的关键词，或清空搜索框。"
                    : "Try a broader keyword or clear the search field."}
                </p>
              </div>
            )}
          </div>

          <div className="listing-studio-shell-actions">
            <button
              className="office-button office-button-primary"
              disabled={!hasSelectionChanges || isSaving}
              onClick={() => void saveSelectionChanges()}
              type="button"
            >
              {isSaving
                ? isZh
                  ? "正在保存..."
                  : "Saving..."
                : isZh
                  ? "保存清单"
                  : "Save collection"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="listing-studio-listed-section">
        <div className="listing-studio-listed-section-head">
          <div>
            <span className="listing-studio-shell-eyebrow">
              {isZh ? "已保存房源" : "Saved listings"}
            </span>
            <h2>
              {detailState.listingCount
                ? isZh
                  ? "当前清单视图"
                  : "Current collection view"
                : isZh
                  ? "还没有房源"
                  : "No listings yet"}
            </h2>
          </div>
          <p>
            {detailState.listingCount
              ? isZh
                ? "房源卡片顺序会与下方地图上的编号标记保持一致。"
                : "Cards stay ordered to match the numbered markers on the map below."
              : isZh
                ? "点击“添加房源”，开始把已导入资料整理进此清单。"
                : "Use Add listings to start grouping imported packets into this collection."}
          </p>
        </div>

        <div className="listing-studio-card-grid">
          {detailState.listings.length ? (
            detailState.listings.map((item) => (
              <ListingStudioCard
                collectionPickerButtonLabel={
                  isZh ? "管理清单" : "Manage collections"
                }
                item={item}
                key={item.packId}
                onRemoveFromCollection={removeListingFromCollection}
                removeFromCollectionLabel={
                  isZh ? "从此清单移除" : "Remove from this collection"
                }
                showCollectionPicker
              />
            ))
          ) : (
            <div className="listing-studio-empty-state">
              <strong>
                {isZh ? "这个清单还是空的。" : "This collection is empty."}
              </strong>
              <p>
                {isZh
                  ? "加入已导入的房源资料，把它整理成可直接发给客户的街区清单。"
                  : "Add imported Listing Studio packets to turn this into a client-ready neighborhood folder."}
              </p>
            </div>
          )}
        </div>
      </section>

      <ListingStudioCollectionMap
        listings={detailState.listings}
        listingsWithoutCoordinates={detailState.listingsWithoutCoordinates}
      />
    </div>
  );
}
