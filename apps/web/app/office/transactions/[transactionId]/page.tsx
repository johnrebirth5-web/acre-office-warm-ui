import { requireOfficeSession } from "../../../../lib/auth-session";
import { TransactionDetailWorkspace } from "./transaction-detail-workspace";

type TransactionDetailPageProps = {
  params: Promise<{
    transactionId: string;
  }>;
};

export default async function OfficeTransactionDetailPage({ params }: TransactionDetailPageProps) {
  const context = await requireOfficeSession();
  const { transactionId } = await params;

  return <TransactionDetailWorkspace context={context} transactionId={transactionId} />;
}
