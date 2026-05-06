"use client";

import type { FormEvent } from "react";
import { FilterBar, FilterField, TextInput } from "@acre/ui";
import { useI18n } from "../../../lib/i18n/client";

const interactionEndpoint = "/api/resources/interactions";

export type FrontOfficeResourceSearchTab = "documents" | "vendors" | "training";

function buildResourcesHref(tab: FrontOfficeResourceSearchTab) {
  return `/agent/resources?tab=${tab}`;
}

function recordSearch(query: string, contextTab: FrontOfficeResourceSearchTab) {
  const body = JSON.stringify({
    type: "resource_search",
    query,
    contextTab,
  });

  if (
    typeof navigator !== "undefined" &&
    typeof navigator.sendBeacon === "function"
  ) {
    try {
      const payload = new Blob([body], { type: "application/json" });

      if (navigator.sendBeacon(interactionEndpoint, payload)) {
        return;
      }
    } catch {
      // Fall through to keepalive fetch.
    }
  }

  void fetch(interactionEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {
    // Search tracking should never block navigation.
  });
}

export function FrontOfficeResourceSearchForm(props: {
  initialQuery: string;
  tab: FrontOfficeResourceSearchTab;
  placeholder?: string;
}) {
  const { locale } = useI18n();
  const isZh = locale === "zh-CN";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const query = `${formData.get("q") ?? ""}`.trim();

    if (!query) {
      return;
    }

    recordSearch(query, props.tab);
  }

  return (
    <FilterBar as="form" method="GET" onSubmit={handleSubmit}>
      <input name="tab" type="hidden" value={props.tab} />
      <FilterField className="office-form-grid-span-2" label={isZh ? "搜索" : "Search"}>
        <TextInput
          defaultValue={props.initialQuery}
          name="q"
          placeholder={
            props.placeholder ??
            (isZh
              ? "搜索标题、摘要、标签或供应商名称"
              : "Search titles, summaries, tags, or vendor names")
          }
          type="search"
        />
      </FilterField>
      <div className="office-filter-actions">
        <button className="office-button" type="submit">
          {isZh ? "搜索" : "Search"}
        </button>
        {props.initialQuery ? (
          <a
            className="office-button-secondary"
            href={buildResourcesHref(props.tab)}
          >
            {isZh ? "清除" : "Clear"}
          </a>
        ) : null}
      </div>
    </FilterBar>
  );
}
