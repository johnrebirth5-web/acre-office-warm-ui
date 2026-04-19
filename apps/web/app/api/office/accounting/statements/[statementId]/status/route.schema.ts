import { AgentPayoutStatementReviewStatus } from "@prisma/client";
import { z } from "zod";

export const validAgentPayoutStatementReviewStatuses = [
  AgentPayoutStatementReviewStatus.draft,
  AgentPayoutStatementReviewStatus.awaiting_agent,
  AgentPayoutStatementReviewStatus.revision_requested,
  AgentPayoutStatementReviewStatus.confirmed,
  AgentPayoutStatementReviewStatus.paid
] as const;

export const updateAgentPayoutStatementStatusBodySchema = z.object({
  reviewStatus: z.enum(validAgentPayoutStatementReviewStatuses)
});
