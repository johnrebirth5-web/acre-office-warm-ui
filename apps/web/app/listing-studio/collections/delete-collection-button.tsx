"use client";

import { ConfirmActionDialog } from "@acre/ui";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { useI18n } from "../../../lib/i18n/client";

type DeleteCollectionButtonProps = {
  collectionId: string;
  collectionName: string;
  redirectHref?: string;
  buttonClassName?: string;
  buttonLabel?: string;
  iconOnly?: boolean;
  onError?: ((message: string) => void) | null;
};

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

export function DeleteCollectionButton({
  collectionId,
  collectionName,
  redirectHref = "/listing-studio/collections?deleted=1",
  buttonClassName,
  buttonLabel = "Delete collection",
  iconOnly = false,
  onError = null,
}: DeleteCollectionButtonProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const resolvedButtonLabel =
    buttonLabel === "Delete collection" && isZh ? "删除清单" : buttonLabel;

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/listing-studio/collections/${collectionId}`,
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
            ? "无法删除清单。"
            : payload?.error || "Unable to delete the collection.",
        );
      }

      setIsDialogOpen(false);
      startTransition(() => {
        router.replace(redirectHref);
        router.refresh();
      });
    } catch (error) {
      const message =
        isZh
          ? "无法删除清单。"
          : error instanceof Error
            ? error.message
            : "Unable to delete the collection.";

      if (onError) {
        onError(message);
      } else {
        window.alert(message);
      }
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <button
        aria-label={isZh ? `删除 ${collectionName}` : `Delete ${collectionName}`}
        className={buttonClassName ?? "office-button office-button-danger"}
        disabled={isDeleting}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDialogOpen(true);
        }}
        title={isZh ? "删除清单" : "Delete collection"}
        type="button"
      >
        {iconOnly ? <IconTrash /> : resolvedButtonLabel}
      </button>

      <ConfirmActionDialog
        cancelLabel={isZh ? "保留清单" : "Keep collection"}
        confirmLabel={
          isDeleting
            ? isZh
              ? "正在删除..."
              : "Deleting..."
            : isZh
              ? "删除清单"
              : "Delete collection"
        }
        confirmVariant="danger"
        description={
          isZh
            ? "这会移除该清单以及其中保存的房源关联，原始房源资料仍会保留在房源工作室。"
            : "This removes the collection and all of its saved listing memberships. The underlying listing packets will stay in Listing Studio."
        }
        isOpen={isDialogOpen}
        onCancel={() => {
          if (!isDeleting) {
            setIsDialogOpen(false);
          }
        }}
        onConfirm={() => {
          void handleDelete();
        }}
        title={isZh ? `删除 ${collectionName}？` : `Delete ${collectionName}?`}
      >
        <p>{isZh ? "此操作无法撤销。" : "This action cannot be undone."}</p>
      </ConfirmActionDialog>
    </>
  );
}
