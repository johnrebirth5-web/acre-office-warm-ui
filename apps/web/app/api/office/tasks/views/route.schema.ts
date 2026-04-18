import { z } from "zod";

const taskDueWindowSchema = z.enum(["", "past_due", "today", "current_week", "next_week", "next_2_weeks"]);
const taskReviewFilterSchema = z.enum(["", "Pending", "Review requested", "Second review", "Approved", "Rejected"]);
const taskComplianceStatusSchema = z.enum(["Not applicable", "Pending", "In review", "Approved", "Rejected"]);
const taskVisibleColumnSchema = z.enum([
  "task",
  "transaction",
  "checklistGroup",
  "assignee",
  "dueDate",
  "taskStatus",
  "transactionStatus",
  "owner"
]);

const taskListFiltersSchema = z.object({
  transactionStatus: z.string(),
  assigneeMembershipId: z.string(),
  dueWindow: taskDueWindowSchema,
  noDueDate: z.boolean(),
  reviewStatus: taskReviewFilterSchema,
  requiresSecondaryApproval: z.boolean(),
  complianceStatuses: z.array(taskComplianceStatusSchema),
  transactionId: z.string(),
  q: z.string(),
  includeCompleted: z.boolean()
});

const taskListSortSchema = z.object({
  field: z.literal("dueAt"),
  direction: z.literal("asc"),
  nulls: z.literal("last")
});

export const createTaskListViewBodySchema = z.object({
  name: z.string().trim().min(1, "View name is required."),
  isShared: z.boolean().optional(),
  filters: taskListFiltersSchema.optional(),
  visibleColumns: z.array(taskVisibleColumnSchema).optional(),
  sort: taskListSortSchema.optional()
});
