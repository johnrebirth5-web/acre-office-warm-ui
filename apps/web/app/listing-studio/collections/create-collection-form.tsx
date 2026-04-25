"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { useI18n } from "../../../lib/i18n/client";

type CreateCollectionResponse =
  | {
      collection?: { id: string; name: string };
      error?: string;
    }
  | null;

export function CreateCollectionForm() {
  const router = useRouter();
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";
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
          isZh
            ? "无法创建清单。"
            : payload?.error || "Unable to create the collection.",
        );
      }

      router.push(`/listing-studio/collections/${payload.collection.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        isZh
          ? "无法创建清单。"
          : error instanceof Error
            ? error.message
            : "Unable to create the collection.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="listing-studio-create-collection-form" onSubmit={handleSubmit}>
      <label className="listing-studio-shell-search">
        <span>{isZh ? "创建新清单" : "Create a new collection"}</span>
        <input
          onChange={(event) => setName(event.target.value)}
          placeholder={
            isZh
              ? "例如：Kyung 客户、LIC 看房、滨水候选..."
              : "For Kyung, LIC tour, Waterfront shortlist..."
          }
          value={name}
        />
      </label>

      <button
        className="office-button office-button-primary"
        disabled={!name.trim() || isSaving}
        type="submit"
      >
        {isSaving
          ? isZh
            ? "正在创建..."
            : "Creating..."
          : isZh
            ? "创建清单"
            : "Create collection"}
      </button>

      {errorMessage ? (
        <p className="listing-studio-status-message">{errorMessage}</p>
      ) : null}
    </form>
  );
}
