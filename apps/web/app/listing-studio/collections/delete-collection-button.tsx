"use client";

import { ConfirmActionDialog } from "@acre/ui";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

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
        d="M9 4.75h6m-8 3h10m-8.5 0 .55 9.2a1 1 0 0 0 1 .94h3.9a1 1 0 0 0 1-.94l.55-9.2M10 11.25v4.5m4-4.5v4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
        throw new Error(payload?.error || "Unable to delete the collection.");
      }

      setIsDialogOpen(false);
      startTransition(() => {
        router.replace(redirectHref);
        router.refresh();
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete the collection.";

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
        aria-label={`Delete ${collectionName}`}
        className={buttonClassName ?? "office-button office-button-danger"}
        disabled={isDeleting}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDialogOpen(true);
        }}
        title="Delete collection"
        type="button"
      >
        {iconOnly ? <IconTrash /> : buttonLabel}
      </button>

      <ConfirmActionDialog
        cancelLabel="Keep collection"
        confirmLabel={isDeleting ? "Deleting..." : "Delete collection"}
        confirmVariant="danger"
        description="This removes the collection and all of its saved listing memberships. The underlying listing packets will stay in Listing Studio."
        isOpen={isDialogOpen}
        onCancel={() => {
          if (!isDeleting) {
            setIsDialogOpen(false);
          }
        }}
        onConfirm={() => {
          void handleDelete();
        }}
        title={`Delete ${collectionName}?`}
      >
        <p>This action cannot be undone.</p>
      </ConfirmActionDialog>
    </>
  );
}
