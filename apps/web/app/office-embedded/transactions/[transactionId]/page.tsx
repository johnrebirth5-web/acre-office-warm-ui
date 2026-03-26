import { requireOfficeSession } from "../../../../lib/auth-session";
import { TransactionDetailWorkspace } from "../../../office/transactions/[transactionId]/transaction-detail-workspace";

type EmbeddedTransactionDetailPageProps = {
  params: Promise<{
    transactionId: string;
  }>;
};

export default async function EmbeddedTransactionDetailPage({ params }: EmbeddedTransactionDetailPageProps) {
  const context = await requireOfficeSession();
  const { transactionId } = await params;

  return <TransactionDetailWorkspace chrome="embedded" context={context} transactionId={transactionId} />;
}
