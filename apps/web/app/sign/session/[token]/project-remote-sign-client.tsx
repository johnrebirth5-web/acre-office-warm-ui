"use client";

import { useMemo, useState } from "react";
import { Button } from "@acre/ui";
import { usePdfPreview } from "../../../../components/signature/use-pdf-preview";

type ProjectSigningField = {
  id: string;
  fieldType: string;
  label: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  defaultValue: string;
};

type ProjectSigningDocument = {
  id: string;
  title: string;
  documentUrl: string;
  fields: ProjectSigningField[];
};

type ProjectSigningValueMap = Record<
  string,
  {
    textValue: string;
    signatureMode?: "type";
  }
>;

function buildInitialValues(input: {
  documents: ProjectSigningDocument[];
  recipientName: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const initials = input.recipientName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const values: ProjectSigningValueMap = {};

  for (const field of input.documents.flatMap((document) => document.fields)) {
    if (field.fieldType === "signature") {
      values[field.id] = {
        textValue: field.defaultValue || input.recipientName,
        signatureMode: "type",
      };
      continue;
    }

    if (field.fieldType === "initials") {
      values[field.id] = {
        textValue: field.defaultValue || initials || input.recipientName,
      };
      continue;
    }

    if (field.fieldType === "date") {
      values[field.id] = {
        textValue: field.defaultValue || today,
      };
      continue;
    }

    values[field.id] = {
      textValue: field.defaultValue,
    };
  }

  return values;
}

function ProjectSigningDocumentPreview(props: {
  document: ProjectSigningDocument;
  isComplete: boolean;
  values: ProjectSigningValueMap;
  onChange: (fieldId: string, value: string) => void;
}) {
  const { pages, isLoading, error } = usePdfPreview(props.document.documentUrl);

  return (
    <section className="public-signature-document">
      <div className="public-signature-document-heading">
        <p className="public-signature-eyebrow">Project document</p>
        <h2>{props.document.title}</h2>
      </div>
      {isLoading ? <p className="public-signature-helper">Loading document preview...</p> : null}
      {error ? <p className="office-inline-alert office-inline-alert-danger">{error}</p> : null}
      <div className="public-signature-pages">
        {pages.map((page) => (
          <section className="public-signature-page" key={page.pageNumber}>
            <div className="public-signature-page-label">Page {page.pageNumber}</div>
            <div className="public-signature-page-frame">
              <img alt={`${props.document.title} page ${page.pageNumber}`} height={page.height} src={page.imageUrl} width={page.width} />
              {props.document.fields
                .filter((field) => field.page === page.pageNumber)
                .map((field) => {
                  const value = props.values[field.id]?.textValue ?? "";
                  const inputClassName =
                    field.fieldType === "signature"
                      ? "public-signature-input public-signature-typed-preview"
                      : "public-signature-input";

                  return (
                    <div
                      className={`public-signature-field public-signature-field-${field.fieldType}`}
                      key={field.id}
                      style={{
                        left: `${field.x * 100}%`,
                        top: `${field.y * 100}%`,
                        width: `${field.width * 100}%`,
                        height: `${field.height * 100}%`,
                      }}
                    >
                      {field.fieldType === "text" ? (
                        <textarea
                          aria-label={field.label}
                          className="public-signature-textarea"
                          disabled={props.isComplete}
                          onChange={(event) => props.onChange(field.id, event.target.value)}
                          placeholder={field.label}
                          value={value}
                        />
                      ) : (
                        <input
                          aria-label={field.label}
                          className={inputClassName}
                          disabled={props.isComplete}
                          onChange={(event) => props.onChange(field.id, event.target.value)}
                          placeholder={field.label}
                          value={value}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

export function ProjectRemoteSignClient(props: {
  token: string;
  recipientName: string;
  documents: ProjectSigningDocument[];
}) {
  const assignedFields = useMemo(() => props.documents.flatMap((document) => document.fields), [props.documents]);
  const [values, setValues] = useState<ProjectSigningValueMap>(() =>
    buildInitialValues({
      documents: props.documents,
      recipientName: props.recipientName,
    }),
  );
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const hasAssignedFields = assignedFields.length > 0;

  function updateFieldValue(fieldId: string, textValue: string) {
    setValues((current) => ({
      ...current,
      [fieldId]: {
        ...current[fieldId],
        textValue,
      },
    }));
  }

  async function submitSignature() {
    if (!hasAssignedFields) {
      setMessage("This signing link has no fields assigned. Ask Acre to add signing fields to the template and send a new link.");
      return;
    }

    setIsBusy(true);
    setMessage("");
    const payloadValues = assignedFields.map((field) => ({
      fieldId: field.id,
      fieldType: field.fieldType,
      textValue: values[field.id]?.textValue ?? "",
      signatureMode: field.fieldType === "signature" ? "type" : undefined,
    }));

    try {
      const response = await fetch(`/api/public/project-signatures/${encodeURIComponent(props.token)}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: payloadValues,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Signature could not be submitted.");
      }

      setMessage("Signed. Acre is finalizing and distributing your secure copies.");
      setIsComplete(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Signature could not be submitted.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="public-signature-shell">
      <aside className="public-signature-sidebar">
        <div className="public-signature-sidebar-summary">
          <p className="public-signature-eyebrow">Acre project signing</p>
          <h1>Project signing</h1>
          <p className="public-signature-sidebar-description">
            {isComplete ? "Your signing step is complete." : "Review each highlighted field, then submit your project documents."}
          </p>
        </div>

        <div className="public-signature-meta">
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>Recipient</strong>
            <span>{props.recipientName}</span>
          </p>
          <p className="public-signature-meta-item public-signature-meta-item-primary">
            <strong>Assigned fields</strong>
            <span>{assignedFields.length}</span>
          </p>
        </div>

        {message ? (
          <p className={`office-inline-alert ${isComplete ? "office-inline-alert-info" : "office-inline-alert-danger"}`}>
            {message}
          </p>
        ) : null}
        {!hasAssignedFields ? (
          <p className="office-inline-alert office-inline-alert-danger">
            This link has no signing fields assigned. The sender needs to edit the template fields and send a new link.
          </p>
        ) : null}

        <Button disabled={isBusy || isComplete || !hasAssignedFields} onClick={submitSignature} type="button">
          {isComplete ? "Signed" : isBusy ? "Submitting..." : "Submit signature"}
        </Button>
      </aside>

      <main className="public-signature-main">
        {props.documents.map((document) => (
          <ProjectSigningDocumentPreview
            document={document}
            isComplete={isComplete}
            key={document.id}
            onChange={updateFieldValue}
            values={values}
          />
        ))}
      </main>
    </main>
  );
}
