"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type CreateCollectionResponse =
  | {
      collection?: { id: string; name: string };
      error?: string;
    }
  | null;

export function CreateCollectionForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextName = name.trim();
    if (!nextName || isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/listing-studio/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: nextName }),
      });
      const payload = (await response.json().catch(() => null)) as CreateCollectionResponse;

      if (!response.ok || !payload?.collection?.id) {
        throw new Error(
          payload?.error || "Unable to create the collection.",
        );
      }

      router.push(`/listing-studio/collections/${payload.collection.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create the collection.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="listing-studio-create-collection-form" onSubmit={handleSubmit}>
      <label className="listing-studio-shell-search">
        <span>Create a new collection</span>
        <input
          onChange={(event) => setName(event.target.value)}
          placeholder="For Kyung, LIC tour, Waterfront shortlist..."
          value={name}
        />
      </label>

      <button
        className="office-button office-button-primary"
        disabled={!name.trim() || isSaving}
        type="submit"
      >
        {isSaving ? "Creating..." : "Create collection"}
      </button>

      {errorMessage ? (
        <p className="listing-studio-status-message">{errorMessage}</p>
      ) : null}
    </form>
  );
}
