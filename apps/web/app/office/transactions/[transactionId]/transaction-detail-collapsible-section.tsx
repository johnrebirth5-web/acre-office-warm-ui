"use client";

import { useEffect, useState, type ReactNode } from "react";

type TransactionDetailCollapsibleSectionProps = {
  storageScope: string;
  sectionKey: string;
  title: string;
  subtitle?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
};

function buildStorageKey(storageScope: string, sectionKey: string) {
  return `office:transaction-detail:section:${storageScope}:${sectionKey}`;
}

export function TransactionDetailCollapsibleSection({
  storageScope,
  sectionKey,
  title,
  subtitle,
  defaultExpanded = false,
  children
}: TransactionDetailCollapsibleSectionProps) {
  const storageKey = buildStorageKey(storageScope, sectionKey);
  const panelId = `transaction-detail-section-${sectionKey}`;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(storageKey);

      if (storedValue === "expanded") {
        setIsExpanded(true);
        return;
      }

      if (storedValue === "collapsed") {
        setIsExpanded(false);
      }
    } catch {
      setIsExpanded(defaultExpanded);
    }
  }, [defaultExpanded, storageKey]);

  function handleToggle() {
    setIsExpanded((current) => {
      const nextValue = !current;

      try {
        window.localStorage.setItem(storageKey, nextValue ? "expanded" : "collapsed");
      } catch {
        // Ignore storage failures and keep the in-memory toggle responsive.
      }

      return nextValue;
    });
  }

  return (
    <section className={`office-section-card office-transaction-collapsible-card${isExpanded ? " is-expanded" : ""}`}>
      <button
        aria-controls={panelId}
        aria-expanded={isExpanded}
        className="office-transaction-collapsible-trigger"
        onClick={handleToggle}
        type="button"
      >
        <div className="office-section-copy">
          <h3>{title}</h3>
          {isExpanded && subtitle ? <p>{subtitle}</p> : null}
        </div>
        <span aria-hidden="true" className="office-transaction-collapsible-indicator">
          {isExpanded ? "-" : "+"}
        </span>
      </button>

      {isExpanded ? (
        <div className="office-transaction-collapsible-panel" id={panelId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
