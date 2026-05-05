"use client";

import {
  ProjectSigningExperience,
  type ProjectSigningDocument,
  type ProjectSigningSubmitValue,
} from "../../_components/project-signing-experience";

export function ProjectRemoteSignClient(props: {
  token: string;
  recipientName: string;
  documents: ProjectSigningDocument[];
}) {
  async function submitSignature(values: ProjectSigningSubmitValue[]) {
    const response = await fetch(`/api/public/project-signatures/${encodeURIComponent(props.token)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      throw new Error(payload.error || "Signature could not be submitted.");
    }
  }

  return (
    <ProjectSigningExperience
      completeMessage="Signed. Acre is finalizing and distributing your secure copies."
      description="Review the full PDF, complete each highlighted field, save the fields, then confirm your signature."
      documents={props.documents}
      eyebrow="Acre project signing"
      onSubmit={submitSignature}
      recipientName={props.recipientName}
      title="Project signing"
    />
  );
}
