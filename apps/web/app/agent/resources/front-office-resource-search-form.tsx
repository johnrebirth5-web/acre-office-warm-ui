"use client";

import type { FormEvent } from "react";
import { FilterBar, FilterField, SelectInput, TextInput } from "@acre/ui";

const interactionEndpoint = "/api/resources/interactions";

function recordSearch(query: string) {
  const body = JSON.stringify({
    type: "resource_search",
    query,
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
  initialType?: string;
  typeOptions: Array<{
    value: string;
    label: string;
  }>;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const query = `${formData.get("q") ?? ""}`.trim();

    if (!query) {
      return;
    }

    recordSearch(query);
  }

  return (
    <FilterBar as="form" method="GET" onSubmit={handleSubmit}>
      <FilterField className="office-form-grid-span-2" label="Search">
        <TextInput
          defaultValue={props.initialQuery}
          name="q"
          placeholder="Search titles, summaries, tags, YouTube trainings, or vendor names"
          type="search"
        />
      </FilterField>
      <FilterField label="Type">
        <SelectInput defaultValue={props.initialType ?? ""} name="type">
          <option value="">All resources</option>
          {props.typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FilterField>
      <div className="office-filter-actions">
        <button className="office-button" type="submit">
          Search
        </button>
        {props.initialQuery || props.initialType ? (
          <a className="office-button-secondary" href="/agent/resources">
            Clear
          </a>
        ) : null}
      </div>
    </FilterBar>
  );
}
