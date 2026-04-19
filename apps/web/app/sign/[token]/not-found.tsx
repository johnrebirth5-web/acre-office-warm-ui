import { SignatureStatusCallout } from "./signature-status-callout";

export default function PublicSignatureNotFound() {
  return (
    <main className="public-signature-empty-shell">
      <section className="public-signature-empty-card">
        <p className="public-signature-eyebrow">Acre signature request</p>
        <h1>We couldn&apos;t open this signing link.</h1>
        <SignatureStatusCallout
          description="Check the full link from the sender or ask them to send a fresh signing request."
          icon="question"
          title="This link isn't valid."
          tone="info"
        />
      </section>
    </main>
  );
}
