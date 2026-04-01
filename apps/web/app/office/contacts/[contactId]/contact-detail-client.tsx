"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  FormField,
  SectionCard,
  SelectInput,
  TextInput,
  TextareaInput,
} from "@acre/ui";
import type { OfficeContactDetail, OfficeContactFieldSchema } from "@acre/db";

type ContactDetailClientProps = {
  contact: OfficeContactDetail;
  schema: OfficeContactFieldSchema;
};

type ContactVisibleField =
  | {
      kind: "builtIn";
      field: OfficeContactFieldSchema["builtInFields"][number];
    }
  | { kind: "custom"; field: OfficeContactFieldSchema["customFields"][number] };

function sortSchemaFieldEntries(fields: ContactVisibleField[]) {
  return [...fields].sort((left, right) => {
    if (left.field.sortOrder !== right.field.sortOrder) {
      return left.field.sortOrder - right.field.sortOrder;
    }

    return left.field.label.localeCompare(right.field.label);
  });
}

function buildContactDetailValues(
  schema: OfficeContactFieldSchema,
  contact: OfficeContactDetail,
) {
  const values: Record<string, string> = {
    fullName: contact.fullName,
    email: contact.email,
    phone: contact.phone,
    contactType: contact.contactType,
    source: contact.source,
    stage: contact.stage,
    intent: contact.intent,
    budgetMin: contact.budgetMin,
    budgetMax: contact.budgetMax,
    preferredAreas: contact.areas.join(", "),
    notes: contact.notes,
    lastContactAt: contact.lastContactAt,
    nextFollowUpAt: contact.nextFollowUpAt,
    leaseEndDate: contact.leaseEndDate,
    leaseReminderAt: contact.leaseReminderAt,
  };

  for (const field of schema.customFields) {
    values[field.inputName] = contact.additionalFields[field.fieldKey] ?? "";
  }

  return values;
}

function getContactFieldLabel(label: string, isRequired: boolean) {
  return isRequired ? `${label} *` : label;
}

function getContactDetailFieldClassName(fieldClassName: string) {
  return fieldClassName.includes("is-span-4")
    ? "office-detail-field office-detail-field-wide"
    : "office-detail-field";
}

export function ContactDetailClient({
  contact,
  schema,
}: ContactDetailClientProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<Record<string, string>>(() =>
    buildContactDetailValues(schema, contact),
  );
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [selectedTransactionId, setSelectedTransactionId] = useState(
    contact.availableTransactions[0]?.id ?? "",
  );
  const [saveError, setSaveError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    setFormState(buildContactDetailValues(schema, contact));
    setSelectedTransactionId(contact.availableTransactions[0]?.id ?? "");
  }, [contact, schema]);

  const visibleFields: ContactVisibleField[] = sortSchemaFieldEntries([
    ...schema.builtInFields
      .filter((field) => field.isVisible)
      .map((field) => ({ kind: "builtIn" as const, field })),
    ...schema.customFields
      .filter((field) => field.isVisible)
      .map((field) => ({ kind: "custom" as const, field })),
  ]);

  function updateField(name: string, value: string) {
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setSaveError("");

    try {
      const response = await fetch(`/api/office/contacts/${contact.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formState),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to save contact.");
      }

      router.refresh();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save contact.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingTask(true);
    setTaskError("");

    try {
      const response = await fetch(
        `/api/office/contacts/${contact.id}/follow-up-tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: taskTitle,
            dueAt: taskDueAt,
          }),
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to create follow-up task.");
      }

      setTaskTitle("");
      setTaskDueAt("");
      router.refresh();
    } catch (error) {
      setTaskError(
        error instanceof Error
          ? error.message
          : "Failed to create follow-up task.",
      );
    } finally {
      setIsCreatingTask(false);
    }
  }

  async function handleLinkTransaction() {
    if (!selectedTransactionId) {
      return;
    }

    setIsLinking(true);
    setLinkError("");

    try {
      const response = await fetch(
        `/api/office/contacts/${contact.id}/transactions/${selectedTransactionId}`,
        {
          method: "PATCH",
        },
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to link transaction.");
      }

      router.refresh();
    } catch (error) {
      setLinkError(
        error instanceof Error ? error.message : "Failed to link transaction.",
      );
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <div className="office-list-page-stack">
      <SectionCard
        subtitle="Core profile, lifecycle, and follow-up details for this contact."
        title="Overview"
      >
        <form className="office-detail-grid" onSubmit={handleSave}>
          {visibleFields.map((entry) => {
            const field = entry.field;
            const fieldType =
              entry.kind === "builtIn" ? entry.field.control : entry.field.type;
            const fieldClassName =
              entry.kind === "builtIn" ? entry.field.className : "";

            return (
              <FormField
                className={getContactDetailFieldClassName(fieldClassName)}
                key={`${entry.kind}:${field.fieldKey}`}
                label={getContactFieldLabel(field.label, field.isRequired)}
              >
                {fieldType === "textarea" ? (
                  <TextareaInput
                    onChange={(event) =>
                      updateField(field.inputName, event.target.value)
                    }
                    value={formState[field.inputName] ?? ""}
                  />
                ) : fieldType === "select" ? (
                  <SelectInput
                    onChange={(event) =>
                      updateField(field.inputName, event.target.value)
                    }
                    value={formState[field.inputName] ?? ""}
                  >
                    <option value="">Select...</option>
                    {field.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </SelectInput>
                ) : (
                  <TextInput
                    onChange={(event) =>
                      updateField(field.inputName, event.target.value)
                    }
                    type={
                      fieldType === "date"
                        ? "date"
                        : field.inputName === "email"
                          ? "email"
                          : "text"
                    }
                    value={formState[field.inputName] ?? ""}
                  />
                )}
              </FormField>
            );
          })}
          <div className="office-form-actions">
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save contact"}
            </Button>
            {saveError ? (
              <p className="office-form-error">{saveError}</p>
            ) : null}
          </div>
        </form>
      </SectionCard>

      <SectionCard
        subtitle="Transactions currently linked to this contact."
        title="Linked transactions"
      >
        <div className="office-detail-grid">
          {contact.linkedTransactions.map((transaction) => (
            <div className="office-detail-field" key={transaction.id}>
              <span>
                <Link href={`/office/transactions/${transaction.id}`}>
                  {transaction.label}
                </Link>
              </span>
              <strong>{transaction.status}</strong>
              <span>
                Asking: {transaction.askingPrice || "—"} · Purchased:{" "}
                {transaction.purchasedPrice || "—"}
              </span>
            </div>
          ))}
          {contact.linkedTransactions.length === 0 ? (
            <div className="office-detail-field">
              <span>Transactions</span>
              <strong>No linked transactions yet.</strong>
            </div>
          ) : null}
        </div>

        <div className="office-form-actions">
          <SelectInput
            onChange={(event) => setSelectedTransactionId(event.target.value)}
            value={selectedTransactionId}
          >
            <option value="">Select transaction to link</option>
            {contact.availableTransactions.map((transaction) => (
              <option key={transaction.id} value={transaction.id}>
                {transaction.label}
              </option>
            ))}
          </SelectInput>
          <Button
            disabled={!selectedTransactionId || isLinking}
            onClick={handleLinkTransaction}
            type="button"
          >
            {isLinking ? "Linking..." : "Link transaction"}
          </Button>
          {linkError ? <p className="office-form-error">{linkError}</p> : null}
        </div>
      </SectionCard>

      <SectionCard
        subtitle="Follow-up work attached to this contact."
        title="Follow-up tasks"
      >
        <div className="office-detail-grid">
          {contact.followUpTasks.map((task) => (
            <div className="office-detail-field" key={task.id}>
              <span>{task.title}</span>
              <strong>
                {task.status} · {task.dueAt} · {task.assigneeName}
              </strong>
            </div>
          ))}
          {contact.followUpTasks.length === 0 ? (
            <div className="office-detail-field">
              <span>Tasks</span>
              <strong>No follow-up tasks yet.</strong>
            </div>
          ) : null}
        </div>

        <form className="office-form-actions" onSubmit={handleCreateTask}>
          <TextInput
            onChange={(event) => setTaskTitle(event.target.value)}
            placeholder="New follow-up task"
            type="text"
            value={taskTitle}
          />
          <TextInput
            onChange={(event) => setTaskDueAt(event.target.value)}
            type="date"
            value={taskDueAt}
          />
          <Button disabled={isCreatingTask} type="submit">
            {isCreatingTask ? "Saving..." : "Add task"}
          </Button>
          {taskError ? <p className="office-form-error">{taskError}</p> : null}
        </form>
      </SectionCard>
    </div>
  );
}
