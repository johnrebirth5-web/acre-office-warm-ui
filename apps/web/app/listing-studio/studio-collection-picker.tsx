"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { StudioListingCollectionPickerItem } from "@acre/db";

import { useI18n } from "../../lib/i18n/client";

type StudioCollectionPickerProps = {
  packId: string;
  variant?: "icon" | "button";
  buttonLabel?: string;
  className?: string;
  onUpdated?: (items: StudioListingCollectionPickerItem[]) => void;
};

type CollectionPickerResponse =
  | {
      items?: StudioListingCollectionPickerItem[];
      error?: string;
    }
  | null;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function IconPlus() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

export function StudioCollectionPicker({
  packId,
  variant = "button",
  buttonLabel = "Add to collection",
  className,
  onUpdated,
}: StudioCollectionPickerProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<StudioListingCollectionPickerItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const resolvedButtonLabel =
    buttonLabel === "Add to collection" && isZh ? "加入清单" : buttonLabel;

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) {
      return items;
    }

    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [deferredSearch, items]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    const card = rootRef.current?.closest(".listing-studio-card");
    if (!(card instanceof HTMLElement)) {
      return undefined;
    }

    if (isOpen) {
      card.dataset.collectionPickerOpen = "true";
    } else {
      delete card.dataset.collectionPickerOpen;
    }

    return () => {
      delete card.dataset.collectionPickerOpen;
    };
  }, [isOpen]);

  async function loadItems() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        `/api/listing-studio/collections?packId=${encodeURIComponent(packId)}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => null)) as CollectionPickerResponse;

      if (!response.ok) {
        throw new Error(
          isZh
            ? "无法加载清单。"
            : payload?.error || "Unable to load collections.",
        );
      }

      startTransition(() => {
        const nextItems = Array.isArray(payload?.items) ? payload.items : [];
        setItems(nextItems);
        onUpdated?.(nextItems);
      });
      setHasLoaded(true);
    } catch (error) {
      setErrorMessage(
        isZh
          ? "无法加载清单。"
          : error instanceof Error
            ? error.message
            : "Unable to load collections.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function openPicker() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen && !hasLoaded) {
      await loadItems();
    }
  }

  async function toggleMembership(item: StudioListingCollectionPickerItem) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setErrorMessage("");

    try {
      const response = await fetch(
        item.includesPack
          ? `/api/listing-studio/collections/${item.id}/items/${packId}`
          : `/api/listing-studio/collections/${item.id}/items`,
        item.includesPack
          ? {
              method: "DELETE",
            }
          : {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ packId }),
            },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          isZh
            ? "无法更新清单。"
            : payload?.error || "Unable to update the collection.",
        );
      }

      await loadItems();
    } catch (error) {
      setErrorMessage(
        isZh
          ? "无法更新清单。"
          : error instanceof Error
            ? error.message
            : "Unable to update the collection.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function createCollection() {
    const nextName = search.trim();
    if (!nextName || isMutating) {
      return;
    }

    setIsMutating(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/listing-studio/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: nextName,
          packId,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          isZh
            ? "无法创建清单。"
            : payload?.error || "Unable to create the collection.",
        );
      }

      setSearch("");
      await loadItems();
    } catch (error) {
      setErrorMessage(
        isZh
          ? "无法创建清单。"
          : error instanceof Error
            ? error.message
            : "Unable to create the collection.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div
      className={cx(
        "studio-collection-picker",
        isOpen && "is-open",
        variant === "icon" && "is-icon",
        className,
      )}
      ref={rootRef}
    >
      <button
        aria-label={resolvedButtonLabel}
        aria-expanded={isOpen}
        className={cx(
          variant === "icon"
            ? "listing-studio-view-stage-action"
            : "studio-collection-picker-trigger",
        )}
        onClick={() => void openPicker()}
        type="button"
      >
        <IconPlus />
        {variant === "button" ? <span>{resolvedButtonLabel}</span> : null}
      </button>

      {isOpen ? (
        <div className="listing-studio-view-collection-popover">
          <div className="listing-studio-view-collection-head">
            <strong>{isZh ? "加入清单" : "Add to collection"}</strong>
          </div>

          <label className="listing-studio-view-collection-search">
            <IconSearch />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isZh ? "搜索或新建..." : "Search or create..."}
              value={search}
            />
          </label>

          {errorMessage ? (
            <p className="listing-studio-view-collection-empty is-error">
              {errorMessage}
            </p>
          ) : null}

          <div className="listing-studio-view-collection-list">
            {isLoading ? (
              <p className="listing-studio-view-collection-empty">
                {isZh ? "正在加载清单..." : "Loading collections..."}
              </p>
            ) : filteredItems.length ? (
              filteredItems.map((item) => (
                <button
                  className="listing-studio-view-collection-item"
                  key={item.id}
                  onClick={() => void toggleMembership(item)}
                  type="button"
                >
                  <span className="listing-studio-view-collection-check">
                    {item.includesPack ? <IconCheck /> : null}
                  </span>
                  <strong>{item.name}</strong>
                  <span className="listing-studio-view-collection-count">
                    ({item.listingCount})
                  </span>
                </button>
              ))
            ) : (
              <p className="listing-studio-view-collection-empty">
                {isZh
                  ? "还没有清单，可以在下方新建。"
                  : "No collections yet. Create one below."}
              </p>
            )}
          </div>

          <button
            className="listing-studio-view-collection-create"
            disabled={!search.trim() || isMutating}
            onClick={() => void createCollection()}
            type="button"
          >
            <IconPlus />
            <span>
              {isMutating
                ? isZh
                  ? "正在保存..."
                  : "Saving..."
                : isZh
                  ? "新建清单"
                  : "Create New"}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
