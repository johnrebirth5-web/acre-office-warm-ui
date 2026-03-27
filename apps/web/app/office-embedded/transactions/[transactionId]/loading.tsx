import { PageShell, SectionCard } from "@acre/ui";

function LoadingBlock(props: { tall?: boolean }) {
  return <div className={props.tall ? "office-transaction-embedded-loading-block is-tall" : "office-transaction-embedded-loading-block"} />;
}

export default function EmbeddedTransactionDetailLoading() {
  return (
    <PageShell className="office-transaction-detail-page office-detail-page office-transaction-detail-embedded office-transaction-detail-embedded-loading">
      <SectionCard subtitle="Preparing the transaction facts and accounting review controls." title="Loading transaction review">
        <div className="office-transaction-embedded-loading-grid">
          <LoadingBlock />
          <LoadingBlock />
          <LoadingBlock />
          <LoadingBlock />
          <LoadingBlock />
          <LoadingBlock />
        </div>
      </SectionCard>

      <SectionCard subtitle="Bringing in the current intake and workflow sections." title="Loading workspace">
        <div className="office-transaction-embedded-loading-stack">
          <LoadingBlock tall />
          <LoadingBlock />
          <LoadingBlock tall />
        </div>
      </SectionCard>
    </PageShell>
  );
}
