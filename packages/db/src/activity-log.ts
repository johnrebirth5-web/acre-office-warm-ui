import { randomUUID } from "node:crypto";
import {
  IncomingUpdateStatus,
  OfferStatus,
  Prisma,
  SignatureRequestStatus,
  TaskStatus,
  TransactionDocumentStatus,
  TransactionStatus,
  TransactionTaskStatus
} from "@prisma/client";
import { prisma } from "./client";

export const activityLogActions = {
  accountProfileUpdated: "account.profile_updated",
  notificationPreferencesUpdated: "account.notification_preferences_updated",
  agentProfileCreated: "agent.profile_created",
  agentProfileUpdated: "agent.profile_updated",
  teamCreated: "team.created",
  teamUpdated: "team.updated",
  teamDeactivated: "team.deactivated",
  teamDeleted: "team.deleted",
  teamMemberAdded: "team.member_added",
  teamMemberRemoved: "team.member_removed",
  agentOnboardingItemCreated: "agent.onboarding_item_created",
  agentOnboardingItemUpdated: "agent.onboarding_item_updated",
  agentOnboardingItemCompleted: "agent.onboarding_item_completed",
  agentOnboardingItemReopened: "agent.onboarding_item_reopened",
  agentOnboardingTemplateApplied: "agent.onboarding_template_applied",
  agentGoalCreated: "agent.goal_created",
  agentGoalUpdated: "agent.goal_updated",
  authBootstrapAdminCreated: "auth.bootstrap_admin_created",
  settingsUserRoleChanged: "settings.user_role_changed",
  settingsUserInvited: "settings.user_invited",
  settingsUserInvitationRevoked: "settings.user_invitation_revoked",
  settingsUserActivated: "settings.user_activated",
  settingsUserDeactivated: "settings.user_deactivated",
  settingsOfficeAccessChanged: "settings.office_access_changed",
  settingsRoleTemplateUpdated: "settings.role_template_updated",
  settingsUserPermissionsChanged: "settings.user_permissions_changed",
  settingsUserPermissionsReset: "settings.user_permissions_reset",
  settingsTableLayoutUpdated: "settings.table_layout_updated",
  settingsTransactionSearchLayoutUpdated: "settings.transaction_search_layout_updated",
  settingsTransactionReportSearchLayoutUpdated: "settings.transaction_report_search_layout_updated",
  settingsRequiredContactRolesChanged: "settings.required_contact_roles_changed",
  settingsTransactionFieldSettingsChanged: "settings.transaction_field_settings_changed",
  settingsContactFieldSettingsChanged: "settings.contact_field_settings_changed",
  settingsOfferFieldSettingsChanged: "settings.offer_field_settings_changed",
  settingsChecklistTemplateCreated: "settings.checklist_template_created",
  settingsChecklistTemplateUpdated: "settings.checklist_template_updated",
  settingsChecklistTemplateActivated: "settings.checklist_template_activated",
  settingsChecklistTemplateDeactivated: "settings.checklist_template_deactivated",
  transactionCreated: "transaction.created",
  transactionUpdated: "transaction.updated",
  transactionStatusChanged: "transaction.status_changed",
  transactionClosed: "transaction.closed",
  transactionCancelled: "transaction.cancelled",
  transactionContactLinked: "transaction.contact_linked",
  transactionContactUnlinked: "transaction.contact_unlinked",
  transactionPrimaryContactChanged: "transaction.primary_contact_changed",
  transactionFinanceUpdated: "transaction.finance_updated",
  offerCreated: "offer.created",
  offerUpdated: "offer.updated",
  offerSubmitted: "offer.submitted",
  offerReceived: "offer.received",
  offerCountered: "offer.countered",
  offerAccepted: "offer.accepted",
  offerRejected: "offer.rejected",
  offerWithdrawn: "offer.withdrawn",
  offerCommentAdded: "offer.comment_added",
  offerDocumentLinked: "offer.document_linked",
  libraryFolderCreated: "library.folder_created",
  libraryFolderUpdated: "library.folder_updated",
  documentUploaded: "document.uploaded",
  documentUpdated: "document.updated",
  documentDeleted: "document.deleted",
  documentOpened: "document.opened",
  formCreated: "form.created",
  formUpdated: "form.updated",
  signatureRequestSent: "signature_request.sent",
  signatureUpdated: "signature_request.updated",
  signatureCompleted: "signature_request.completed",
  signatureDeclined: "signature_request.declined",
  incomingUpdateReceived: "incoming_update.received",
  incomingUpdateAccepted: "incoming_update.accepted",
  incomingUpdateRejected: "incoming_update.rejected",
  transactionTaskCreated: "transaction.task_created",
  transactionTaskUpdated: "transaction.task_updated",
  transactionTaskReviewRequested: "transaction.task_review_requested",
  transactionTaskFirstApproved: "transaction.task_first_approved",
  transactionTaskSecondApproved: "transaction.task_second_approved",
  transactionTaskApproved: "transaction.task_approved",
  transactionTaskRejected: "transaction.task_rejected",
  transactionTaskCompleted: "transaction.task_completed",
  transactionTaskReopened: "transaction.task_reopened",
  followUpTaskCreated: "follow_up_task.created",
  contactCreated: "contact.created",
  contactUpdated: "contact.updated",
  activityCommentAdded: "activity.comment_added",
  accountingInvoiceCreated: "accounting.invoice_created",
  accountingBillCreated: "accounting.bill_created",
  accountingCreditMemoCreated: "accounting.credit_memo_created",
  accountingDepositCreated: "accounting.deposit_created",
  accountingPaymentReceived: "accounting.payment_received",
  accountingPaymentMade: "accounting.payment_made",
  accountingRefundCreated: "accounting.refund_created",
  accountingTransactionUpdated: "accounting.transaction_updated",
  accountingAgentChargeCreated: "accounting.agent_charge_created",
  accountingRecurringRuleCreated: "accounting.recurring_rule_created",
  accountingRecurringRuleUpdated: "accounting.recurring_rule_updated",
  accountingRecurringRuleDeactivated: "accounting.recurring_rule_deactivated",
  accountingPaymentMethodAdded: "accounting.payment_method_added",
  accountingPaymentMethodUpdated: "accounting.payment_method_updated",
  accountingPaymentMethodRemoved: "accounting.payment_method_removed",
  accountingAgentCreditApplied: "accounting.agent_credit_applied",
  agentPayoutStatementGenerated: "agent_payout_statement.generated",
  agentPayoutStatementAdjusted: "agent_payout_statement.adjusted",
  commissionPlanCreated: "commission.plan_created",
  commissionPlanUpdated: "commission.plan_updated",
  commissionPlanAssigned: "commission.plan_assigned",
  commissionCalculated: "commission.calculated",
  commissionRecalculated: "commission.recalculated",
  commissionStatusUpdated: "commission.status_updated",
  commissionStatementGenerated: "commission.statement_generated",
  emdExpectedCreated: "emd.expected_created",
  emdReceived: "emd.received",
  emdRefunded: "emd.refunded",
  authInvitationAccepted: "auth.invitation_accepted",
  authLogin: "auth.login",
  authLoginFailed: "auth.login_failed",
  authAccountLocked: "auth.account_locked",
  authAccountUnlocked: "auth.account_unlocked",
  authPasswordSetupIssued: "auth.password_setup_issued",
  authPasswordChanged: "auth.password_changed",
  authLogout: "auth.logout"
} as const;

export type ActivityLogAction = (typeof activityLogActions)[keyof typeof activityLogActions];
export type ActivityLogViewMode = "all" | "activity" | "alerts";
export type ActivityLogEntityType =
  | "account_profile"
  | "notification_preference"
  | "agent_profile"
  | "team"
  | "agent_onboarding_item"
  | "agent_goal"
  | "membership"
  | "user_credential"
  | "invitation"
  | "required_contact_role_setting"
  | "transaction_field_setting"
  | "transaction_search_layout"
  | "transaction_report_search_layout"
  | "checklist_template"
  | "organization_table_layout"
  | "organization_role_template"
  | "membership_permission_override"
  | "transaction"
  | "offer"
  | "contact"
  | "transaction_task"
  | "follow_up_task"
  | "activity_comment"
  | "session"
  | "library_folder"
  | "library_document"
  | "transaction_document"
  | "transaction_form"
  | "signature_request"
  | "incoming_update"
  | "accounting_transaction"
  | "commission_plan"
  | "commission_calculation"
  | "commission_statement"
  | "agent_payout_statement"
  | "agent_recurring_charge_rule"
  | "agent_payment_method"
  | "earnest_money";
export type ActivityLogObjectType = "all" | "transaction" | "contact" | "task" | "document" | "comment" | "auth" | "accounting" | "agent";

export type ActivityLogChange = {
  label: string;
  previousValue?: string | null;
  nextValue?: string | null;
};

export type ActivityLogPayload = {
  officeId?: string | null;
  objectLabel?: string;
  transactionId?: string;
  transactionLabel?: string;
  contactId?: string;
  contactName?: string;
  taskId?: string;
  taskTitle?: string;
  commentBody?: string;
  contextHref?: string;
  actionSource?: string;
  workflowReason?: string;
  details?: string[];
  changes?: ActivityLogChange[];
};

export type ActivityLogSectionKey =
  | "all"
  | "agents-teams"
  | "transactions"
  | "contacts"
  | "tasks-checklists"
  | "documents-forms-signatures"
  | "finance-commissions"
  | "authentication"
  | "comments";

export type ActivityAlertSectionKey =
  | "all"
  | "offers-awaiting-review"
  | "offers-expiring-soon"
  | "tasks-awaiting-your-review"
  | "tasks-awaiting-second-review"
  | "rejected-tasks-needing-action"
  | "transaction-closing-soon"
  | "overdue-transaction-tasks"
  | "contacts-follow-up-soon"
  | "overdue-follow-up-tasks"
  | "transaction-finance-incomplete"
  | "missing-required-documents"
  | "signature-pending"
  | "incoming-updates-awaiting-review";

export type OfficeActivityLogSection = {
  key: ActivityLogSectionKey;
  label: string;
  count: number;
};

export type OfficeActivityAlertSection = {
  key: ActivityAlertSectionKey;
  label: string;
  count: number;
};

export type OfficeActivityLogEvent = {
  id: string;
  action: string;
  actionLabel: string;
  actorDisplayName: string;
  summary: string;
  objectType: Exclude<ActivityLogObjectType, "all">;
  isComment: boolean;
  objectLabel: string;
  href: string | null;
  timestampLabel: string;
  detailSummary: string[];
};

export type OfficeOperationalAlertSeverity = "high" | "medium" | "low";

export type OfficeOperationalAlert = {
  id: string;
  type: Exclude<ActivityAlertSectionKey, "all">;
  typeLabel: string;
  severity: OfficeOperationalAlertSeverity;
  severityLabel: string;
  objectType: Exclude<ActivityLogObjectType, "all" | "auth">;
  title: string;
  summary: string;
  objectLabel: string;
  href: string | null;
  referenceLabel: string;
  detailSummary: string[];
};

export type OfficeActivityActorOption = {
  id: string;
  label: string;
};

export type GetOfficeActivityLogInput = {
  organizationId: string;
  officeId?: string | null;
  currentMembershipId?: string | null;
  canReviewTasks?: boolean;
  canSecondaryReviewTasks?: boolean;
  view?: string;
  activitySection?: string;
  alertSection?: string;
  actorMembershipId?: string;
  objectType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export type AddOfficeActivityCommentInput = {
  organizationId: string;
  officeId?: string | null;
  membershipId: string;
  scopeLabel: string;
  body: string;
  contextHref?: string | null;
};

export type OfficeActivityLogSnapshot = {
  latestWindowLabel: string;
  latestWindowCount: number;
  selectedView: ActivityLogViewMode;
  activitySelectedSection: ActivityLogSectionKey;
  activitySelectedSectionLabel: string;
  alertSelectedSection: ActivityAlertSectionKey;
  alertSelectedSectionLabel: string;
  activitySections: OfficeActivityLogSection[];
  alertSections: OfficeActivityAlertSection[];
  activityEvents: OfficeActivityLogEvent[];
  alerts: OfficeOperationalAlert[];
  filters: {
    actorMembershipId: string;
    objectType: ActivityLogObjectType;
    startDate: string;
    endDate: string;
    actorOptions: OfficeActivityActorOption[];
  };
};

type AuditLogWriter = Pick<Prisma.TransactionClient, "auditLog">;

type RecordActivityLogEventInput = {
  organizationId: string;
  membershipId?: string | null;
  entityType: ActivityLogEntityType;
  entityId: string;
  action: ActivityLogAction;
  payload?: ActivityLogPayload;
};

type ActivityLogRecord = {
  id: string;
  membershipId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  payload: Prisma.JsonValue | null;
  createdAt: Date;
  membership: {
    user: {
      firstName: string;
      lastName: string;
    };
  } | null;
};

type ActivityLogSectionDefinition = {
  key: ActivityLogSectionKey;
  label: string;
  matches: (action: string) => boolean;
};

type ActivityAlertSectionDefinition = {
  key: Exclude<ActivityAlertSectionKey, "all">;
  label: string;
  matches: (alert: OfficeOperationalAlert) => boolean;
};

type ParsedActivityPayload = ActivityLogPayload & {
  changes: ActivityLogChange[];
  details: string[];
};

const activityActionLabelMap: Record<ActivityLogAction, string> = {
  "agent.profile_created": "Agent profile created",
  "agent.profile_updated": "Agent profile updated",
  "team.created": "Team created",
  "team.updated": "Team updated",
  "team.deactivated": "Team deactivated",
  "team.deleted": "Team deleted",
  "team.member_added": "Agent added to team",
  "team.member_removed": "Agent removed from team",
  "agent.onboarding_item_created": "Onboarding item created",
  "agent.onboarding_item_updated": "Onboarding item updated",
  "agent.onboarding_item_completed": "Onboarding item completed",
  "agent.onboarding_item_reopened": "Onboarding item reopened",
  "agent.onboarding_template_applied": "Onboarding template applied",
  "agent.goal_created": "Goal created",
  "agent.goal_updated": "Goal updated",
  "settings.user_role_changed": "User role changed",
  "settings.user_activated": "User activated",
  "settings.user_deactivated": "User deactivated",
  "settings.office_access_changed": "Office access changed",
  "settings.table_layout_updated": "Shared table layout updated",
  "settings.transaction_search_layout_updated": "Transaction search layout updated",
  "settings.transaction_report_search_layout_updated": "Reports search layout updated",
  "settings.required_contact_roles_changed": "Required contact roles changed",
  "settings.transaction_field_settings_changed": "Transaction field settings changed",
  "settings.contact_field_settings_changed": "Contact field settings changed",
  "settings.offer_field_settings_changed": "Offer field settings changed",
  "settings.checklist_template_created": "Checklist template created",
  "settings.checklist_template_updated": "Checklist template updated",
  "settings.checklist_template_activated": "Checklist template activated",
  "settings.checklist_template_deactivated": "Checklist template deactivated",
  "transaction.created": "Transaction created",
  "transaction.updated": "Transaction updated",
  "transaction.status_changed": "Transaction status changed",
  "transaction.closed": "Transaction closed",
  "transaction.cancelled": "Transaction cancelled",
  "transaction.contact_linked": "Transaction contact linked",
  "transaction.contact_unlinked": "Transaction contact unlinked",
  "transaction.primary_contact_changed": "Transaction primary contact changed",
  "transaction.finance_updated": "Transaction finance updated",
  "offer.created": "Offer created",
  "offer.updated": "Offer updated",
  "offer.submitted": "Offer submitted",
  "offer.received": "Offer received",
  "offer.countered": "Offer countered",
  "offer.accepted": "Offer accepted",
  "offer.rejected": "Offer rejected",
  "offer.withdrawn": "Offer withdrawn",
  "offer.comment_added": "Offer comment added",
  "offer.document_linked": "Offer document linked",
  "library.folder_created": "Library folder created",
  "library.folder_updated": "Library folder updated",
  "document.uploaded": "Document uploaded",
  "document.updated": "Document updated",
  "document.deleted": "Document deleted",
  "document.opened": "Document opened",
  "form.created": "Form created",
  "form.updated": "Form updated",
  "signature_request.sent": "Signature request sent",
  "signature_request.updated": "Signature request updated",
  "signature_request.completed": "Signature completed",
  "signature_request.declined": "Signature declined",
  "incoming_update.received": "Incoming update received",
  "incoming_update.accepted": "Incoming update accepted",
  "incoming_update.rejected": "Incoming update rejected",
  "transaction.task_created": "Task created",
  "transaction.task_updated": "Task updated",
  "transaction.task_review_requested": "Task review requested",
  "transaction.task_first_approved": "Task first-approved",
  "transaction.task_second_approved": "Task second-approved",
  "transaction.task_approved": "Task approved",
  "transaction.task_rejected": "Task rejected",
  "transaction.task_completed": "Task completed",
  "transaction.task_reopened": "Task reopened",
  "follow_up_task.created": "Follow-up task created",
  "contact.created": "Contact created",
  "contact.updated": "Contact updated",
  "activity.comment_added": "Comment added",
  "accounting.invoice_created": "Invoice created",
  "accounting.bill_created": "Bill created",
  "accounting.credit_memo_created": "Credit memo created",
  "accounting.deposit_created": "Deposit created",
  "accounting.payment_received": "Payment received",
  "accounting.payment_made": "Payment made",
  "accounting.refund_created": "Refund created",
  "accounting.transaction_updated": "Accounting transaction updated",
  "accounting.agent_charge_created": "Agent charge created",
  "accounting.recurring_rule_created": "Recurring rule created",
  "accounting.recurring_rule_updated": "Recurring rule updated",
  "accounting.recurring_rule_deactivated": "Recurring rule deactivated",
  "accounting.payment_method_added": "Payment method added",
  "accounting.payment_method_updated": "Payment method updated",
  "accounting.payment_method_removed": "Payment method removed",
  "accounting.agent_credit_applied": "Credit applied",
  "agent_payout_statement.generated": "Agent payout statement generated",
  "agent_payout_statement.adjusted": "Agent payout statement adjusted",
  "commission.plan_created": "Commission plan created",
  "commission.plan_updated": "Commission plan updated",
  "commission.plan_assigned": "Commission plan assigned",
  "commission.calculated": "Commission calculated",
  "commission.recalculated": "Commission recalculated",
  "commission.status_updated": "Commission status updated",
  "commission.statement_generated": "Commission statement generated",
  "emd.expected_created": "EMD expected",
  "emd.received": "EMD received",
  "emd.refunded": "EMD refunded / distributed",
  "account.profile_updated": "Account profile updated",
  "account.notification_preferences_updated": "Notification preferences updated",
  "auth.bootstrap_admin_created": "Bootstrap admin created",
  "settings.role_template_updated": "Role template updated",
  "settings.user_permissions_changed": "User permissions updated",
  "settings.user_permissions_reset": "User permissions reset",
  "settings.user_invited": "User invited",
  "settings.user_invitation_revoked": "Invitation revoked",
  "auth.invitation_accepted": "Invitation accepted",
  "auth.login": "Sign in",
  "auth.login_failed": "Sign in failed",
  "auth.account_locked": "Account locked",
  "auth.account_unlocked": "Account unlocked",
  "auth.password_setup_issued": "Password setup link issued",
  "auth.password_changed": "Password changed",
  "auth.logout": "Sign out"
};

const activityLogSectionDefinitions: ActivityLogSectionDefinition[] = [
  { key: "all", label: "All events", matches: () => true },
  {
    key: "agents-teams",
    label: "Agents / Teams",
    matches: (action) =>
      action === activityLogActions.accountProfileUpdated ||
      action === activityLogActions.agentProfileCreated ||
      action === activityLogActions.agentProfileUpdated ||
      action === activityLogActions.teamCreated ||
      action === activityLogActions.teamUpdated ||
      action === activityLogActions.teamDeactivated ||
      action === activityLogActions.teamDeleted ||
      action === activityLogActions.teamMemberAdded ||
      action === activityLogActions.teamMemberRemoved ||
      action === activityLogActions.settingsUserRoleChanged ||
      action === activityLogActions.settingsUserActivated ||
      action === activityLogActions.settingsUserDeactivated ||
      action === activityLogActions.settingsOfficeAccessChanged ||
      action === activityLogActions.settingsRoleTemplateUpdated ||
      action === activityLogActions.settingsUserPermissionsChanged ||
      action === activityLogActions.settingsUserPermissionsReset ||
      action === activityLogActions.settingsTableLayoutUpdated ||
      action === activityLogActions.settingsTransactionSearchLayoutUpdated ||
      action === activityLogActions.settingsTransactionReportSearchLayoutUpdated ||
      action === activityLogActions.agentOnboardingItemCreated ||
      action === activityLogActions.agentOnboardingItemUpdated ||
      action === activityLogActions.agentOnboardingItemCompleted ||
      action === activityLogActions.agentOnboardingItemReopened ||
      action === activityLogActions.agentOnboardingTemplateApplied ||
      action === activityLogActions.agentGoalCreated ||
      action === activityLogActions.agentGoalUpdated ||
      action === activityLogActions.authBootstrapAdminCreated ||
      action === activityLogActions.settingsUserInvited ||
      action === activityLogActions.settingsUserInvitationRevoked ||
      action === activityLogActions.settingsContactFieldSettingsChanged ||
      action === activityLogActions.settingsOfferFieldSettingsChanged
  },
  {
    key: "transactions",
    label: "Transactions",
    matches: (action) =>
      action === activityLogActions.transactionCreated ||
      action === activityLogActions.transactionUpdated ||
      action === activityLogActions.transactionStatusChanged ||
      action === activityLogActions.transactionClosed ||
      action === activityLogActions.transactionCancelled ||
      action === activityLogActions.transactionContactLinked ||
      action === activityLogActions.transactionContactUnlinked ||
      action === activityLogActions.transactionPrimaryContactChanged ||
      action === activityLogActions.settingsRequiredContactRolesChanged ||
      action === activityLogActions.settingsTransactionFieldSettingsChanged ||
      action === activityLogActions.settingsTransactionSearchLayoutUpdated ||
      action === activityLogActions.settingsTransactionReportSearchLayoutUpdated ||
      action === activityLogActions.offerCreated ||
      action === activityLogActions.offerUpdated ||
      action === activityLogActions.offerSubmitted ||
      action === activityLogActions.offerReceived ||
      action === activityLogActions.offerCountered ||
      action === activityLogActions.offerAccepted ||
      action === activityLogActions.offerRejected ||
      action === activityLogActions.offerWithdrawn ||
      action === activityLogActions.offerCommentAdded
  },
  {
    key: "contacts",
    label: "Contacts",
    matches: (action) =>
      action === activityLogActions.contactCreated ||
      action === activityLogActions.contactUpdated
  },
  {
    key: "tasks-checklists",
    label: "Tasks / Checklists",
    matches: (action) =>
      action === activityLogActions.transactionTaskCreated ||
      action === activityLogActions.transactionTaskUpdated ||
      action === activityLogActions.transactionTaskReviewRequested ||
      action === activityLogActions.transactionTaskFirstApproved ||
      action === activityLogActions.transactionTaskSecondApproved ||
      action === activityLogActions.transactionTaskApproved ||
      action === activityLogActions.transactionTaskRejected ||
      action === activityLogActions.transactionTaskCompleted ||
      action === activityLogActions.transactionTaskReopened ||
      action === activityLogActions.followUpTaskCreated ||
      action === activityLogActions.settingsChecklistTemplateCreated ||
      action === activityLogActions.settingsChecklistTemplateUpdated ||
      action === activityLogActions.settingsChecklistTemplateActivated ||
      action === activityLogActions.settingsChecklistTemplateDeactivated
  },
  {
    key: "documents-forms-signatures",
    label: "Documents / Forms / Signatures",
    matches: (action) =>
      action === activityLogActions.documentUploaded ||
      action === activityLogActions.libraryFolderCreated ||
      action === activityLogActions.libraryFolderUpdated ||
      action === activityLogActions.documentUpdated ||
      action === activityLogActions.documentDeleted ||
      action === activityLogActions.documentOpened ||
      action === activityLogActions.formCreated ||
      action === activityLogActions.formUpdated ||
      action === activityLogActions.offerDocumentLinked ||
      action === activityLogActions.signatureRequestSent ||
      action === activityLogActions.signatureUpdated ||
      action === activityLogActions.signatureCompleted ||
      action === activityLogActions.signatureDeclined ||
      action === activityLogActions.incomingUpdateReceived ||
      action === activityLogActions.incomingUpdateAccepted ||
      action === activityLogActions.incomingUpdateRejected
  },
  {
    key: "finance-commissions",
    label: "Finance / Commissions",
    matches: (action) =>
      action === activityLogActions.transactionFinanceUpdated ||
      action === activityLogActions.accountingInvoiceCreated ||
      action === activityLogActions.accountingBillCreated ||
      action === activityLogActions.accountingCreditMemoCreated ||
      action === activityLogActions.accountingDepositCreated ||
      action === activityLogActions.accountingPaymentReceived ||
      action === activityLogActions.accountingPaymentMade ||
      action === activityLogActions.accountingRefundCreated ||
      action === activityLogActions.accountingTransactionUpdated ||
      action === activityLogActions.accountingAgentChargeCreated ||
      action === activityLogActions.accountingRecurringRuleCreated ||
      action === activityLogActions.accountingRecurringRuleUpdated ||
      action === activityLogActions.accountingRecurringRuleDeactivated ||
      action === activityLogActions.accountingPaymentMethodAdded ||
      action === activityLogActions.accountingPaymentMethodUpdated ||
      action === activityLogActions.accountingPaymentMethodRemoved ||
      action === activityLogActions.accountingAgentCreditApplied ||
      action === activityLogActions.agentPayoutStatementGenerated ||
      action === activityLogActions.agentPayoutStatementAdjusted ||
      action === activityLogActions.commissionPlanCreated ||
      action === activityLogActions.commissionPlanUpdated ||
      action === activityLogActions.commissionPlanAssigned ||
      action === activityLogActions.commissionCalculated ||
      action === activityLogActions.commissionRecalculated ||
      action === activityLogActions.commissionStatusUpdated ||
      action === activityLogActions.commissionStatementGenerated ||
      action === activityLogActions.emdExpectedCreated ||
      action === activityLogActions.emdReceived ||
      action === activityLogActions.emdRefunded
  },
  {
    key: "authentication",
    label: "Authentication",
    matches: (action) =>
      action === activityLogActions.notificationPreferencesUpdated ||
      action === activityLogActions.authBootstrapAdminCreated ||
      action === activityLogActions.settingsUserInvited ||
      action === activityLogActions.settingsUserInvitationRevoked ||
      action === activityLogActions.authInvitationAccepted ||
      action === activityLogActions.authLogin ||
      action === activityLogActions.authLoginFailed ||
      action === activityLogActions.authAccountLocked ||
      action === activityLogActions.authAccountUnlocked ||
      action === activityLogActions.authPasswordSetupIssued ||
      action === activityLogActions.authPasswordChanged ||
      action === activityLogActions.authLogout
  },
  {
    key: "comments",
    label: "Comments",
    matches: (action) => action === activityLogActions.activityCommentAdded
  }
];

const activityAlertSectionDefinitions: ActivityAlertSectionDefinition[] = [
  { key: "offers-awaiting-review", label: "Offers awaiting review", matches: (alert) => alert.type === "offers-awaiting-review" },
  { key: "offers-expiring-soon", label: "Offers expiring soon", matches: (alert) => alert.type === "offers-expiring-soon" },
  { key: "tasks-awaiting-your-review", label: "Tasks awaiting your review", matches: (alert) => alert.type === "tasks-awaiting-your-review" },
  { key: "tasks-awaiting-second-review", label: "Tasks awaiting second review", matches: (alert) => alert.type === "tasks-awaiting-second-review" },
  { key: "rejected-tasks-needing-action", label: "Rejected tasks needing action", matches: (alert) => alert.type === "rejected-tasks-needing-action" },
  { key: "transaction-closing-soon", label: "Transaction closing soon", matches: (alert) => alert.type === "transaction-closing-soon" },
  { key: "overdue-transaction-tasks", label: "Overdue transaction tasks", matches: (alert) => alert.type === "overdue-transaction-tasks" },
  { key: "contacts-follow-up-soon", label: "Contacts needing follow-up soon", matches: (alert) => alert.type === "contacts-follow-up-soon" },
  { key: "overdue-follow-up-tasks", label: "Overdue follow-up tasks", matches: (alert) => alert.type === "overdue-follow-up-tasks" },
  { key: "transaction-finance-incomplete", label: "Transaction finance incomplete", matches: (alert) => alert.type === "transaction-finance-incomplete" }
  ,
  { key: "missing-required-documents", label: "Missing required documents", matches: (alert) => alert.type === "missing-required-documents" },
  { key: "signature-pending", label: "Signature pending", matches: (alert) => alert.type === "signature-pending" },
  { key: "incoming-updates-awaiting-review", label: "Incoming updates awaiting review", matches: (alert) => alert.type === "incoming-updates-awaiting-review" }
];

function formatTimestamp(date: Date) {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getActorDisplayName(record: ActivityLogRecord) {
  return record.membership ? `${record.membership.user.firstName} ${record.membership.user.lastName}` : "System";
}

function isPayloadObject(payload: Prisma.JsonValue | null): payload is Prisma.JsonObject {
  return Boolean(payload) && typeof payload === "object" && !Array.isArray(payload);
}

function parsePayloadString(payload: Prisma.JsonObject, key: string) {
  return typeof payload[key] === "string" ? payload[key] : undefined;
}

function parsePayloadNullableString(payload: Prisma.JsonObject, key: string) {
  return typeof payload[key] === "string" ? payload[key] : payload[key] === null ? null : undefined;
}

function parsePayloadDetails(payload: Prisma.JsonObject) {
  const value = payload.details;

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function parsePayloadChanges(payload: Prisma.JsonObject) {
  const value = payload.changes;

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const maybeLabel = "label" in entry ? entry.label : undefined;
    const maybePrevious = "previousValue" in entry ? entry.previousValue : undefined;
    const maybeNext = "nextValue" in entry ? entry.nextValue : undefined;

    if (typeof maybeLabel !== "string" || maybeLabel.trim().length === 0) {
      return [];
    }

    return [
      {
        label: maybeLabel,
        previousValue: typeof maybePrevious === "string" ? maybePrevious : maybePrevious === null ? null : undefined,
        nextValue: typeof maybeNext === "string" ? maybeNext : maybeNext === null ? null : undefined
      }
    ];
  });
}

function getActivityPayload(payload: Prisma.JsonValue | null): ParsedActivityPayload {
  if (!isPayloadObject(payload)) {
    return {
      details: [],
      changes: []
    };
  }

  return {
    officeId: parsePayloadNullableString(payload, "officeId"),
    objectLabel: parsePayloadString(payload, "objectLabel"),
    transactionId: parsePayloadString(payload, "transactionId"),
    transactionLabel: parsePayloadString(payload, "transactionLabel"),
    contactId: parsePayloadString(payload, "contactId"),
    contactName: parsePayloadString(payload, "contactName"),
    taskId: parsePayloadString(payload, "taskId"),
    taskTitle: parsePayloadString(payload, "taskTitle"),
    commentBody: parsePayloadString(payload, "commentBody"),
    contextHref: parsePayloadString(payload, "contextHref"),
    actionSource: parsePayloadString(payload, "actionSource"),
    workflowReason: parsePayloadString(payload, "workflowReason"),
    details: parsePayloadDetails(payload),
    changes: parsePayloadChanges(payload)
  };
}

function mapEntityTypeToObjectType(entityType: string): Exclude<ActivityLogObjectType, "all"> {
  switch (entityType) {
    case "account_profile":
      return "agent";
    case "notification_preference":
      return "auth";
    case "agent_profile":
    case "team":
    case "agent_onboarding_item":
    case "agent_goal":
    case "membership":
    case "organization_role_template":
    case "membership_permission_override":
      return "agent";
    case "user_credential":
    case "invitation":
      return "auth";
    case "required_contact_role_setting":
    case "transaction_field_setting":
    case "transaction_search_layout":
    case "transaction_report_search_layout":
      return "transaction";
    case "checklist_template":
      return "task";
    case "transaction":
    case "offer":
      return "transaction";
    case "contact":
      return "contact";
    case "library_folder":
    case "library_document":
    case "transaction_document":
    case "transaction_form":
    case "signature_request":
    case "incoming_update":
      return "document";
    case "transaction_task":
    case "follow_up_task":
      return "task";
    case "activity_comment":
      return "comment";
    case "session":
      return "auth";
    case "accounting_transaction":
    case "commission_plan":
    case "commission_calculation":
    case "commission_statement":
    case "agent_payout_statement":
    case "agent_recurring_charge_rule":
    case "agent_payment_method":
    case "earnest_money":
      return "accounting";
    default:
      return "transaction";
  }
}

function normalizeObjectType(value: string | undefined): ActivityLogObjectType {
  if (
    value === "agent" ||
    value === "transaction" ||
    value === "contact" ||
    value === "task" ||
    value === "document" ||
    value === "comment" ||
    value === "auth" ||
    value === "accounting"
  ) {
    return value;
  }

  return "all";
}

function getActivityHref(record: ActivityLogRecord, payload: ParsedActivityPayload) {
  if (record.entityType === "transaction") {
    const transactionId = payload.transactionId ?? record.entityId;

    if (record.action === activityLogActions.transactionFinanceUpdated) {
      return `/office/transactions/${transactionId}#finance`;
    }

    if (
      record.action === activityLogActions.transactionContactLinked ||
      record.action === activityLogActions.transactionContactUnlinked ||
      record.action === activityLogActions.transactionPrimaryContactChanged
    ) {
      return `/office/transactions/${transactionId}#contacts`;
    }

    return `/office/transactions/${transactionId}`;
  }

  if (record.entityType === "offer") {
    if (payload.contextHref) {
      return payload.contextHref;
    }

    if (payload.transactionId) {
      return `/office/transactions/${payload.transactionId}#offer-${record.entityId}`;
    }

    return null;
  }

  if (record.entityType === "accounting_transaction") {
    return `/office/accounting?entryId=${record.entityId}`;
  }

  if (record.entityType === "commission_plan" || record.entityType === "commission_statement") {
    return payload.contextHref ?? "/office/settings/commission-plans";
  }

  if (record.entityType === "agent_payout_statement") {
    return payload.contextHref ?? "/office/accounting";
  }

  if (record.entityType === "commission_calculation") {
    return payload.contextHref ?? (payload.transactionId ? `/office/transactions/${payload.transactionId}#commission` : "/office/settings/commission-plans");
  }

  if (record.entityType === "agent_profile") {
    return payload.contextHref ?? "/office/agents";
  }

  if (record.entityType === "account_profile" || record.entityType === "notification_preference") {
    return payload.contextHref ?? "/office/account";
  }

  if (record.entityType === "team") {
    return payload.contextHref ?? "/office/agents";
  }

  if (record.entityType === "agent_onboarding_item" || record.entityType === "agent_goal") {
    return payload.contextHref ?? "/office/agents";
  }

  if (record.entityType === "membership") {
    return payload.contextHref ?? "/office/settings/users";
  }

  if (record.entityType === "organization_role_template") {
    return payload.contextHref ?? "/office/settings/roles";
  }

  if (record.entityType === "membership_permission_override") {
    return payload.contextHref ?? "/office/settings/users";
  }

  if (record.entityType === "user_credential" || record.entityType === "invitation") {
    return payload.contextHref ?? "/office/settings/users";
  }

  if (
    record.entityType === "required_contact_role_setting" ||
    record.entityType === "transaction_field_setting" ||
    record.entityType === "transaction_search_layout"
  ) {
    return payload.contextHref ?? "/office/settings/fields";
  }

  if (record.entityType === "transaction_report_search_layout") {
    return payload.contextHref ?? "/office/reports";
  }

  if (record.entityType === "checklist_template") {
    return payload.contextHref ?? "/office/settings/checklists";
  }

  if (record.entityType === "agent_recurring_charge_rule" || record.entityType === "agent_payment_method") {
    return payload.contextHref ?? "/office/accounting#agent-billing";
  }

  if (record.entityType === "library_folder" || record.entityType === "library_document") {
    return payload.contextHref ?? "/office/library";
  }

  if (record.entityType === "transaction_document" && payload.transactionId) {
    return `/office/transactions/${payload.transactionId}#transaction-documents`;
  }

  if (record.entityType === "transaction_form" && payload.transactionId) {
    return `/office/transactions/${payload.transactionId}#transaction-forms-signatures`;
  }

  if (record.entityType === "signature_request" && payload.transactionId) {
    return `/office/transactions/${payload.transactionId}#transaction-forms-signatures`;
  }

  if (record.entityType === "incoming_update") {
    return payload.contextHref ?? (payload.transactionId ? `/office/transactions/${payload.transactionId}#transaction-incoming-updates` : "/office/activity");
  }

  if (record.entityType === "earnest_money") {
    return payload.contextHref ?? "/office/accounting#earnest-money";
  }

  if (record.entityType === "contact") {
    return `/office/contacts/${payload.contactId ?? record.entityId}`;
  }

  if (record.entityType === "transaction_task" && payload.transactionId) {
    return payload.taskId
      ? `/office/transactions/${payload.transactionId}#transaction-task-${payload.taskId}`
      : `/office/transactions/${payload.transactionId}#transaction-tasks`;
  }

  if (record.entityType === "follow_up_task" && payload.contactId) {
    return `/office/contacts/${payload.contactId}#follow-up-tasks`;
  }

  if (record.entityType === "activity_comment") {
    return payload.contextHref ?? null;
  }

  return null;
}

function getObjectLabel(record: ActivityLogRecord, payload: ParsedActivityPayload) {
  return (
    payload.objectLabel ??
    payload.transactionLabel ??
    payload.contactName ??
    payload.taskTitle ??
    `${record.entityType.replaceAll("_", " ")} · ${record.entityId}`
  );
}

function getActionLabel(action: string) {
  return activityActionLabelMap[action as ActivityLogAction] ?? action;
}

function normalizeChangeValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function formatActivityChange(change: ActivityLogChange) {
  const previousValue = normalizeChangeValue(change.previousValue);
  const nextValue = normalizeChangeValue(change.nextValue);

  if (previousValue === nextValue) {
    return null;
  }

  return `${change.label}: ${previousValue} -> ${nextValue}`;
}

function getPayloadChange(payload: ParsedActivityPayload, label: string) {
  return payload.changes.find((change) => change.label === label) ?? null;
}

function formatSummaryChange(change: ActivityLogChange | null) {
  if (!change) {
    return null;
  }

  return `${normalizeChangeValue(change.previousValue)} to ${normalizeChangeValue(change.nextValue)}`;
}

function getActionSourceLabel(actionSource: string | undefined) {
  return actionSource === "approve_docs_queue" ? "Approve Docs queue" : null;
}

function appendActionSourceSummary(baseSummary: string, payload: ParsedActivityPayload) {
  const sourceLabel = getActionSourceLabel(payload.actionSource);
  return sourceLabel ? `${baseSummary} from ${sourceLabel}` : baseSummary;
}

function getSummary(action: string, payload: ParsedActivityPayload) {
  switch (action) {
    case activityLogActions.accountProfileUpdated:
      return payload.changes.length === 1 ? `updated account ${payload.changes[0].label.toLowerCase()}` : "updated an account profile";
    case activityLogActions.notificationPreferencesUpdated:
      return payload.changes.length === 1
        ? `updated notification ${payload.changes[0].label.toLowerCase()}`
        : "updated notification preferences";
    case activityLogActions.agentProfileCreated:
      return "created an agent profile";
    case activityLogActions.agentProfileUpdated:
      return payload.changes.length === 1 ? `updated agent ${payload.changes[0].label.toLowerCase()}` : "updated an agent profile";
    case activityLogActions.teamCreated:
      return "created a team";
    case activityLogActions.teamUpdated:
      return payload.changes.length === 1 ? `updated team ${payload.changes[0].label.toLowerCase()}` : "updated a team";
    case activityLogActions.teamDeactivated:
      return "deactivated a team";
    case activityLogActions.teamDeleted:
      return "deleted a team";
    case activityLogActions.teamMemberAdded:
      return "added an agent to a team";
    case activityLogActions.teamMemberRemoved:
      return "removed an agent from a team";
    case activityLogActions.agentOnboardingItemCreated:
      return "created an onboarding item";
    case activityLogActions.agentOnboardingItemUpdated:
      return payload.changes.length === 1 ? `updated onboarding ${payload.changes[0].label.toLowerCase()}` : "updated an onboarding item";
    case activityLogActions.agentOnboardingItemCompleted:
      return "completed an onboarding item";
    case activityLogActions.agentOnboardingItemReopened:
      return "reopened an onboarding item";
    case activityLogActions.agentOnboardingTemplateApplied:
      return "applied the standard onboarding template";
    case activityLogActions.agentGoalCreated:
      return "created an agent goal";
    case activityLogActions.agentGoalUpdated:
      return payload.changes.length === 1 ? `updated goal ${payload.changes[0].label.toLowerCase()}` : "updated an agent goal";
    case activityLogActions.authBootstrapAdminCreated:
      return "created the bootstrap admin account";
    case activityLogActions.settingsUserRoleChanged:
      return "changed a user role";
    case activityLogActions.settingsRoleTemplateUpdated:
      return "updated a role template";
    case activityLogActions.settingsUserPermissionsChanged:
      return "updated user permission overrides";
    case activityLogActions.settingsUserPermissionsReset:
      return "reset user permission overrides";
    case activityLogActions.settingsUserInvited:
      return "issued a user invitation";
    case activityLogActions.settingsUserInvitationRevoked:
      return "revoked a user invitation";
    case activityLogActions.settingsUserActivated:
      return "activated a user";
    case activityLogActions.settingsUserDeactivated:
      return "deactivated a user";
    case activityLogActions.settingsOfficeAccessChanged:
      return "changed office access";
    case activityLogActions.settingsTableLayoutUpdated:
      return "updated shared table column widths";
    case activityLogActions.settingsTransactionSearchLayoutUpdated:
      return "updated the transaction search layout";
    case activityLogActions.settingsTransactionReportSearchLayoutUpdated:
      return "updated the reports search layout";
    case activityLogActions.settingsRequiredContactRolesChanged:
      return "updated required contact roles";
    case activityLogActions.settingsTransactionFieldSettingsChanged:
      return "updated transaction field settings";
    case activityLogActions.settingsContactFieldSettingsChanged:
      return "updated contact field settings";
    case activityLogActions.settingsOfferFieldSettingsChanged:
      return "updated offer field settings";
    case activityLogActions.settingsChecklistTemplateCreated:
      return "created a checklist template";
    case activityLogActions.settingsChecklistTemplateUpdated:
      return payload.changes.length === 1 ? `updated checklist ${payload.changes[0].label.toLowerCase()}` : "updated a checklist template";
    case activityLogActions.settingsChecklistTemplateActivated:
      return "activated a checklist template";
    case activityLogActions.settingsChecklistTemplateDeactivated:
      return "deactivated a checklist template";
    case activityLogActions.transactionCreated:
      return "created a transaction";
    case activityLogActions.transactionUpdated:
      return payload.changes.length === 1 ? `updated transaction ${payload.changes[0].label.toLowerCase()}` : "updated a transaction";
    case activityLogActions.transactionStatusChanged: {
      const statusChange = getPayloadChange(payload, "Status");
      return statusChange ? `changed transaction status from ${formatSummaryChange(statusChange)}` : "changed transaction status";
    }
    case activityLogActions.transactionClosed:
      return "closed a transaction";
    case activityLogActions.transactionCancelled:
      return "cancelled a transaction";
    case activityLogActions.transactionContactLinked:
      return payload.contactName ? `linked ${payload.contactName} to a transaction` : "linked a contact to a transaction";
    case activityLogActions.transactionContactUnlinked:
      return payload.contactName ? `unlinked ${payload.contactName} from a transaction` : "unlinked a contact from a transaction";
    case activityLogActions.transactionPrimaryContactChanged:
      return "changed the primary transaction contact";
    case activityLogActions.transactionFinanceUpdated:
      return payload.changes.length === 1 ? `updated ${payload.changes[0].label.toLowerCase()}` : "updated transaction finance";
    case activityLogActions.offerCreated:
      return "created an offer";
    case activityLogActions.offerUpdated:
      return payload.changes.length === 1 ? `updated offer ${payload.changes[0].label.toLowerCase()}` : "updated an offer";
    case activityLogActions.offerSubmitted:
      return "submitted an offer";
    case activityLogActions.offerReceived:
      return "marked an offer as received";
    case activityLogActions.offerCountered:
      return "countered an offer";
    case activityLogActions.offerAccepted:
      return "accepted an offer";
    case activityLogActions.offerRejected:
      return "rejected an offer";
    case activityLogActions.offerWithdrawn:
      return "withdrew an offer";
    case activityLogActions.offerCommentAdded:
      return "added an offer comment";
    case activityLogActions.offerDocumentLinked:
      return "linked a document to an offer";
    case activityLogActions.libraryFolderCreated:
      return "created a library folder";
    case activityLogActions.libraryFolderUpdated:
      return payload.changes.length === 1 && payload.changes[0]?.label === "Folder name"
        ? "renamed a library folder"
        : payload.changes.length === 1
          ? `updated library folder ${payload.changes[0].label.toLowerCase()}`
          : "updated a library folder";
    case activityLogActions.documentUploaded:
      return "uploaded a document";
    case activityLogActions.documentUpdated:
      return payload.changes.length === 1 ? `updated document ${payload.changes[0].label.toLowerCase()}` : "updated a document";
    case activityLogActions.documentDeleted:
      return "deleted a document";
    case activityLogActions.documentOpened:
      return "opened a document";
    case activityLogActions.formCreated:
      return "created a form packet";
    case activityLogActions.formUpdated:
      return payload.changes.length === 1 ? `updated form ${payload.changes[0].label.toLowerCase()}` : "updated a form packet";
    case activityLogActions.signatureRequestSent:
      return "sent a signature request";
    case activityLogActions.signatureUpdated:
      return payload.changes.length === 1 ? `updated signature ${payload.changes[0].label.toLowerCase()}` : "updated a signature request";
    case activityLogActions.signatureCompleted:
      return "completed a signature request";
    case activityLogActions.signatureDeclined:
      return "recorded a declined signature request";
    case activityLogActions.incomingUpdateReceived:
      return "received an incoming update";
    case activityLogActions.incomingUpdateAccepted:
      return "accepted an incoming update";
    case activityLogActions.incomingUpdateRejected:
      return "rejected an incoming update";
    case activityLogActions.transactionTaskCreated:
      return "created a transaction task";
    case activityLogActions.transactionTaskUpdated: {
      const statusChange = getPayloadChange(payload, "Workflow status") ?? getPayloadChange(payload, "Status");
      return statusChange ? `updated task status from ${formatSummaryChange(statusChange)}` : "updated a transaction task";
    }
    case activityLogActions.transactionTaskReviewRequested:
      return appendActionSourceSummary("requested review for a transaction task", payload);
    case activityLogActions.transactionTaskFirstApproved:
      return appendActionSourceSummary("recorded first approval for a transaction task", payload);
    case activityLogActions.transactionTaskSecondApproved:
      return appendActionSourceSummary("recorded second approval for a transaction task", payload);
    case activityLogActions.transactionTaskApproved:
      return appendActionSourceSummary("approved a transaction task", payload);
    case activityLogActions.transactionTaskRejected:
      return appendActionSourceSummary("rejected a transaction task", payload);
    case activityLogActions.transactionTaskCompleted:
      return appendActionSourceSummary("completed a transaction task", payload);
    case activityLogActions.transactionTaskReopened:
      return payload.workflowReason === "document_workflow_invalidated"
        ? "reopened a transaction task because document workflow became invalid"
        : appendActionSourceSummary("reopened a transaction task", payload);
    case activityLogActions.followUpTaskCreated:
      return "created a follow-up task";
    case activityLogActions.contactCreated:
      return "created a contact";
    case activityLogActions.contactUpdated:
      return payload.changes.length === 1 ? `updated contact ${payload.changes[0].label.toLowerCase()}` : "updated a contact";
    case activityLogActions.activityCommentAdded:
      return "added an internal comment";
    case activityLogActions.accountingInvoiceCreated:
      return "created an invoice";
    case activityLogActions.accountingBillCreated:
      return "created a bill";
    case activityLogActions.accountingCreditMemoCreated:
      return "created a credit memo";
    case activityLogActions.accountingDepositCreated:
      return "recorded a deposit";
    case activityLogActions.accountingPaymentReceived:
      return "recorded a received payment";
    case activityLogActions.accountingPaymentMade:
      return "recorded a made payment";
    case activityLogActions.accountingRefundCreated:
      return "recorded a refund";
    case activityLogActions.accountingTransactionUpdated:
      return payload.changes.length === 1 ? `updated accounting ${payload.changes[0].label.toLowerCase()}` : "updated an accounting transaction";
    case activityLogActions.accountingAgentChargeCreated:
      return "created an agent billing charge";
    case activityLogActions.accountingRecurringRuleCreated:
      return "created a recurring billing rule";
    case activityLogActions.accountingRecurringRuleUpdated:
      return payload.changes.length === 1 ? `updated recurring rule ${payload.changes[0].label.toLowerCase()}` : "updated a recurring billing rule";
    case activityLogActions.accountingRecurringRuleDeactivated:
      return "deactivated a recurring billing rule";
    case activityLogActions.accountingPaymentMethodAdded:
      return "added a payment method";
    case activityLogActions.accountingPaymentMethodUpdated:
      return payload.changes.length === 1 ? `updated payment method ${payload.changes[0].label.toLowerCase()}` : "updated a payment method";
    case activityLogActions.accountingPaymentMethodRemoved:
      return "removed a payment method";
    case activityLogActions.accountingAgentCreditApplied:
      return "applied a credit memo to an outstanding balance";
    case activityLogActions.agentPayoutStatementGenerated:
      return "generated an agent payout statement";
    case activityLogActions.agentPayoutStatementAdjusted:
      return "updated an agent payout statement";
    case activityLogActions.commissionPlanCreated:
      return "created a commission plan";
    case activityLogActions.commissionPlanUpdated:
      return payload.changes.length === 1 ? `updated commission plan ${payload.changes[0].label.toLowerCase()}` : "updated a commission plan";
    case activityLogActions.commissionPlanAssigned:
      return "assigned a commission plan";
    case activityLogActions.commissionCalculated:
      return "calculated commissions";
    case activityLogActions.commissionRecalculated:
      return "recalculated commissions";
    case activityLogActions.commissionStatusUpdated:
      return payload.changes.length === 1 ? `updated commission status from ${formatSummaryChange(payload.changes[0])}` : "updated commission status";
    case activityLogActions.commissionStatementGenerated:
      return "generated a commission statement snapshot";
    case activityLogActions.emdExpectedCreated:
      return "created an earnest money expectation";
    case activityLogActions.emdReceived:
      return "recorded earnest money received";
    case activityLogActions.emdRefunded:
      return "recorded an earnest money refund or distribution";
    case activityLogActions.authInvitationAccepted:
      return "accepted an invitation";
    case activityLogActions.authLogin:
      return "signed in";
    case activityLogActions.authLoginFailed:
      return "failed a sign-in attempt";
    case activityLogActions.authAccountLocked:
      return "locked an account after repeated sign-in failures";
    case activityLogActions.authAccountUnlocked:
      return "unlocked an account";
    case activityLogActions.authPasswordSetupIssued:
      return "issued a password setup link";
    case activityLogActions.authPasswordChanged:
      return "changed a password";
    case activityLogActions.authLogout:
      return "signed out";
    default:
      return "recorded an activity event";
  }
}

function getActivitySectionDefinition(key: string | undefined) {
  return activityLogSectionDefinitions.find((section) => section.key === key) ?? activityLogSectionDefinitions[0];
}

function getAlertSectionDefinition(key: string | undefined) {
  return activityAlertSectionDefinitions.find((section) => section.key === key) ?? null;
}

function getViewMode(view: string | undefined): ActivityLogViewMode {
  return view === "activity" || view === "alerts" ? view : "all";
}

function getDetailSummary(payload: ParsedActivityPayload) {
  const actionSourceLabel = getActionSourceLabel(payload.actionSource);
  const detailItems = payload.details;
  const changeItems = payload.changes
    .map(formatActivityChange)
    .filter((detail): detail is string => Boolean(detail));
  const commentItems = payload.commentBody?.trim() ? [payload.commentBody.trim()] : [];
  const sourceItems = actionSourceLabel ? [`Source: ${actionSourceLabel}`] : [];

  const seen = new Set<string>();
  const merged: string[] = [];

  for (const detail of [...commentItems, ...sourceItems, ...changeItems, ...detailItems]) {
    if (seen.has(detail)) {
      continue;
    }

    seen.add(detail);
    merged.push(detail);
  }

  return merged;
}

function formatActivityLogRecord(record: ActivityLogRecord): OfficeActivityLogEvent {
  const payload = getActivityPayload(record.payload);

  return {
    id: record.id,
    action: record.action,
    actionLabel: getActionLabel(record.action),
    actorDisplayName: getActorDisplayName(record),
    summary: getSummary(record.action, payload),
    objectType: mapEntityTypeToObjectType(record.entityType),
    isComment: record.action === activityLogActions.activityCommentAdded,
    objectLabel: getObjectLabel(record, payload),
    href: getActivityHref(record, payload),
    timestampLabel: formatTimestamp(record.createdAt),
    detailSummary: getDetailSummary(payload)
  };
}

function parseStartDate(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseEndDate(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clampDateWindow(startDate: Date, endDate: Date, filterStartDate: Date | null, filterEndDate: Date | null) {
  const effectiveStartDate = filterStartDate && filterStartDate > startDate ? filterStartDate : startDate;
  const effectiveEndDate = filterEndDate && filterEndDate < endDate ? filterEndDate : endDate;

  if (effectiveStartDate > effectiveEndDate) {
    return null;
  }

  return {
    startDate: effectiveStartDate,
    endDate: effectiveEndDate
  };
}

function formatCurrency(value: Prisma.Decimal | number | null | undefined) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: numericValue % 1 === 0 ? 0 : 2
  }).format(numericValue);
}

function getSeverityLabel(severity: OfficeOperationalAlertSeverity) {
  switch (severity) {
    case "high":
      return "High";
    case "medium":
      return "Medium";
    default:
      return "Low";
  }
}

function getSeverityRank(severity: OfficeOperationalAlertSeverity) {
  switch (severity) {
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function sortAlerts(alerts: Array<OfficeOperationalAlert & { sortAt: Date }>) {
  return alerts
    .sort((left, right) => {
      const severityDiff = getSeverityRank(right.severity) - getSeverityRank(left.severity);

      if (severityDiff !== 0) {
        return severityDiff;
      }

      return left.sortAt.getTime() - right.sortAt.getTime();
    })
    .map(({ sortAt: _sortAt, ...alert }) => alert);
}

function buildAlertReferenceLabel(label: string, date: Date) {
  return `${label}: ${formatDateLabel(date)}`;
}

async function getActorOptions(records: ActivityLogRecord[]) {
  const seen = new Set<string>();
  const options: OfficeActivityActorOption[] = [];

  for (const record of records) {
    if (!record.membershipId || !record.membership) {
      continue;
    }

    if (seen.has(record.membershipId)) {
      continue;
    }

    seen.add(record.membershipId);
    options.push({
      id: record.membershipId,
      label: `${record.membership.user.firstName} ${record.membership.user.lastName}`
    });
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

async function listOperationalAlerts(input: {
  organizationId: string;
  officeId?: string | null;
  currentMembershipId?: string | null;
  canReviewTasks?: boolean;
  canSecondaryReviewTasks?: boolean;
  objectType: ActivityLogObjectType;
  startDate: Date | null;
  endDate: Date | null;
}): Promise<OfficeOperationalAlert[]> {
  const now = new Date();
  const closingSoonWindow = clampDateWindow(
    now,
    new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    input.startDate,
    input.endDate
  );
  const followUpSoonWindow = clampDateWindow(
    now,
    new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
    input.startDate,
    input.endDate
  );

  const [
    closingSoonTransactions,
    offersAwaitingReview,
    offersExpiringSoon,
    tasksAwaitingReview,
    tasksAwaitingSecondReview,
    rejectedTasksNeedingAction,
    overdueTransactionTasks,
    contactsNeedingFollowUpSoon,
    overdueFollowUpTasks,
    financeIncompleteTransactions,
    missingRequiredDocumentTasks,
    pendingSignatureRequests,
    pendingIncomingUpdates
  ] =
    await Promise.all([
      closingSoonWindow && (input.objectType === "all" || input.objectType === "transaction")
        ? prisma.transaction.findMany({
            where: {
              organizationId: input.organizationId,
              ...(input.officeId ? { officeId: input.officeId } : {}),
              status: {
                in: [TransactionStatus.active, TransactionStatus.pending]
              },
              closingDate: {
                gte: closingSoonWindow.startDate,
                lte: closingSoonWindow.endDate
              }
            },
            include: {
              ownerMembership: {
                include: {
                  user: true
                }
              }
            },
            orderBy: [{ closingDate: "asc" }]
          })
        : Promise.resolve([]),
      input.objectType === "all" || input.objectType === "transaction"
        ? prisma.offer.findMany({
            where: {
              organizationId: input.organizationId,
              ...(input.officeId ? { officeId: input.officeId } : {}),
              status: {
                in: [OfferStatus.received, OfferStatus.under_review, OfferStatus.countered]
              }
            },
            include: {
              transaction: true,
              createdByMembership: {
                include: {
                  user: true
                }
              }
            },
            orderBy: [{ updatedAt: "desc" }]
          })
        : Promise.resolve([]),
      input.objectType === "all" || input.objectType === "transaction"
        ? prisma.offer.findMany({
            where: {
              organizationId: input.organizationId,
              ...(input.officeId ? { officeId: input.officeId } : {}),
              status: {
                in: [OfferStatus.submitted, OfferStatus.received, OfferStatus.under_review, OfferStatus.countered]
              },
              expirationAt: {
                gte: now,
                lte: new Date(now.getTime() + 72 * 60 * 60 * 1000),
                ...(input.startDate ? { gte: input.startDate > now ? input.startDate : now } : {}),
                ...(input.endDate ? { lte: input.endDate < new Date(now.getTime() + 72 * 60 * 60 * 1000) ? input.endDate : new Date(now.getTime() + 72 * 60 * 60 * 1000) } : {})
              }
            },
            include: {
              transaction: true,
              createdByMembership: {
                include: {
                  user: true
                }
              }
            },
            orderBy: [{ expirationAt: "asc" }]
          })
        : Promise.resolve([]),
      input.canReviewTasks && input.currentMembershipId && (input.objectType === "all" || input.objectType === "task")
        ? prisma.transactionTask.findMany({
            where: {
              organizationId: input.organizationId,
              reviewStatus: "review_requested",
              status: {
                not: TransactionTaskStatus.completed
              },
              transaction: input.officeId
                ? {
                    officeId: input.officeId
                  }
                : undefined
            },
            include: {
              assigneeMembership: {
                include: {
                  user: true
                }
              },
              transaction: true,
              submittedForReviewByMembership: {
                include: {
                  user: true
                }
              }
            },
            orderBy: [{ submittedForReviewAt: "asc" }, { updatedAt: "asc" }]
          })
        : Promise.resolve([]),
      input.canSecondaryReviewTasks && input.currentMembershipId && (input.objectType === "all" || input.objectType === "task")
        ? prisma.transactionTask.findMany({
            where: {
              organizationId: input.organizationId,
              reviewStatus: "second_review",
              status: {
                not: TransactionTaskStatus.completed
              },
              NOT: {
                firstApprovedByMembershipId: input.currentMembershipId
              },
              transaction: input.officeId
                ? {
                    officeId: input.officeId
                  }
                : undefined
            },
            include: {
              assigneeMembership: {
                include: {
                  user: true
                }
              },
              transaction: true,
              firstApprovedByMembership: {
                include: {
                  user: true
                }
              }
            },
            orderBy: [{ firstApprovedAt: "asc" }, { updatedAt: "asc" }]
          })
        : Promise.resolve([]),
      input.currentMembershipId && (input.objectType === "all" || input.objectType === "task")
        ? prisma.transactionTask.findMany({
            where: {
              organizationId: input.organizationId,
              reviewStatus: "rejected",
              status: {
                not: TransactionTaskStatus.completed
              },
              OR: [
                { assigneeMembershipId: input.currentMembershipId },
                { submittedForReviewByMembershipId: input.currentMembershipId }
              ],
              transaction: input.officeId
                ? {
                    officeId: input.officeId
                  }
                : undefined
            },
            include: {
              assigneeMembership: {
                include: {
                  user: true
                }
              },
              transaction: true,
              rejectedByMembership: {
                include: {
                  user: true
                }
              }
            },
            orderBy: [{ rejectedAt: "desc" }, { updatedAt: "desc" }]
          })
        : Promise.resolve([]),
      input.objectType === "all" || input.objectType === "task"
        ? prisma.transactionTask.findMany({
            where: {
              organizationId: input.organizationId,
              status: {
                in: [
                  TransactionTaskStatus.todo,
                  TransactionTaskStatus.in_progress,
                  TransactionTaskStatus.review_requested,
                  TransactionTaskStatus.reopened
                ]
              },
              dueAt: {
                lt: now,
                ...(input.startDate ? { gte: input.startDate } : {}),
                ...(input.endDate ? { lte: input.endDate } : {})
              },
              transaction: input.officeId
                ? {
                    officeId: input.officeId
                  }
                : undefined
            },
            include: {
              assigneeMembership: {
                include: {
                  user: true
                }
              },
              transaction: true
            },
            orderBy: [{ dueAt: "asc" }]
          })
        : Promise.resolve([]),
      followUpSoonWindow && (input.objectType === "all" || input.objectType === "contact")
        ? prisma.client.findMany({
            where: {
              organizationId: input.organizationId,
              nextFollowUpAt: {
                gte: followUpSoonWindow.startDate,
                lte: followUpSoonWindow.endDate
              },
              ...(input.officeId
                ? {
                    ownerMembership: {
                      officeId: input.officeId
                    }
                  }
                : {})
            },
            include: {
              ownerMembership: {
                include: {
                  user: true
                }
              }
            },
            orderBy: [{ nextFollowUpAt: "asc" }]
          })
        : Promise.resolve([]),
      input.objectType === "all" || input.objectType === "task"
        ? prisma.followUpTask.findMany({
            where: {
              organizationId: input.organizationId,
              status: {
                in: [TaskStatus.queued, TaskStatus.in_progress]
              },
              dueAt: {
                lt: now,
                ...(input.startDate ? { gte: input.startDate } : {}),
                ...(input.endDate ? { lte: input.endDate } : {})
              },
              ...(input.officeId
                ? {
                    OR: [
                      {
                        assigneeMembership: {
                          officeId: input.officeId
                        }
                      },
                      {
                        client: {
                          ownerMembership: {
                            officeId: input.officeId
                          }
                        }
                      }
                    ]
                  }
                : {})
            },
            include: {
              assigneeMembership: {
                include: {
                  user: true
                }
              },
              client: {
                include: {
                  ownerMembership: {
                    include: {
                      user: true
                    }
                  }
                }
              }
            },
            orderBy: [{ dueAt: "asc" }]
          })
        : Promise.resolve([]),
      input.objectType === "all" || input.objectType === "transaction"
        ? prisma.transaction.findMany({
            where: {
              organizationId: input.organizationId,
              ...(input.officeId ? { officeId: input.officeId } : {}),
              status: {
                not: TransactionStatus.cancelled
              },
              OR: [{ grossCommission: null }, { officeNet: null }, { agentNet: null }],
              ...(input.startDate || input.endDate
                ? {
                    updatedAt: {
                      ...(input.startDate ? { gte: input.startDate } : {}),
                      ...(input.endDate ? { lte: input.endDate } : {})
                    }
                  }
                : {})
            },
            include: {
              ownerMembership: {
                include: {
                  user: true
                }
              }
            },
            orderBy: [{ updatedAt: "desc" }]
          })
        : Promise.resolve([]),
      input.objectType === "all" || input.objectType === "document"
        ? prisma.transactionTask.findMany({
            where: {
              organizationId: input.organizationId,
              requiresDocument: true,
              status: {
                in: [
                  TransactionTaskStatus.todo,
                  TransactionTaskStatus.in_progress,
                  TransactionTaskStatus.review_requested,
                  TransactionTaskStatus.reopened
                ]
              },
              documents: {
                none: {
                  status: {
                    in: [TransactionDocumentStatus.uploaded, TransactionDocumentStatus.submitted, TransactionDocumentStatus.approved, TransactionDocumentStatus.signed]
                  }
                }
              },
              transaction: input.officeId
                ? {
                    officeId: input.officeId
                  }
                : undefined
            },
            include: {
              transaction: true
            },
            orderBy: [{ updatedAt: "desc" }]
          })
        : Promise.resolve([]),
      input.objectType === "all" || input.objectType === "document"
        ? prisma.signatureRequest.findMany({
            where: {
              organizationId: input.organizationId,
              status: {
                in: [SignatureRequestStatus.sent, SignatureRequestStatus.viewed]
              },
              transaction: input.officeId
                ? {
                    officeId: input.officeId
                  }
                : undefined
            },
            include: {
              transaction: true,
              form: {
                select: {
                  id: true,
                  name: true
                }
              },
              document: {
                select: {
                  id: true,
                  title: true
                }
              }
            },
            orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }]
          })
        : Promise.resolve([]),
      input.objectType === "all" || input.objectType === "document"
        ? prisma.incomingUpdate.findMany({
            where: {
              organizationId: input.organizationId,
              status: IncomingUpdateStatus.pending_review,
              ...(input.officeId ? { officeId: input.officeId } : {})
            },
            include: {
              transaction: true
            },
            orderBy: [{ receivedAt: "asc" }]
          })
        : Promise.resolve([])
    ]);

  const getPurchasedPriceValue = (transaction: { purchasedPrice: Prisma.Decimal | null; price: Prisma.Decimal | null }) =>
    transaction.purchasedPrice ?? transaction.price;

  const alerts: Array<OfficeOperationalAlert & { sortAt: Date }> = [];

  for (const offer of offersAwaitingReview) {
    alerts.push({
      id: `alert-offer-review-${offer.id}`,
      type: "offers-awaiting-review",
      typeLabel: "Offers awaiting review",
      severity: "medium",
      severityLabel: getSeverityLabel("medium"),
      objectType: "transaction",
      title: "Offer awaiting review",
      summary: `${offer.title} needs offer review attention.`,
      objectLabel: `${offer.transaction.title} · ${offer.transaction.address}, ${offer.transaction.city}, ${offer.transaction.state}`,
      href: `/office/transactions/${offer.transactionId}#offer-${offer.id}`,
      referenceLabel: buildAlertReferenceLabel("Updated", offer.updatedAt),
      detailSummary: [
        `Status: ${offer.status.replaceAll("_", " ")}`,
        `Buyer / party: ${offer.buyerName?.trim() || offer.offeringPartyName}`,
        ...(offer.price ? [`Price: ${formatCurrency(offer.price)}`] : []),
        `Created by: ${offer.createdByMembership.user.firstName} ${offer.createdByMembership.user.lastName}`
      ],
      sortAt: offer.updatedAt
    });
  }

  for (const offer of offersExpiringSoon) {
    if (!offer.expirationAt) {
      continue;
    }

    const hoursRemaining = Math.ceil((offer.expirationAt.getTime() - now.getTime()) / (60 * 60 * 1000));
    const severity: OfficeOperationalAlertSeverity = hoursRemaining <= 24 ? "high" : "medium";

    alerts.push({
      id: `alert-offer-expiring-${offer.id}`,
      type: "offers-expiring-soon",
      typeLabel: "Offers expiring soon",
      severity,
      severityLabel: getSeverityLabel(severity),
      objectType: "transaction",
      title: "Offer expiring soon",
      summary: `${offer.title} is close to expiration.`,
      objectLabel: `${offer.transaction.title} · ${offer.transaction.address}, ${offer.transaction.city}, ${offer.transaction.state}`,
      href: `/office/transactions/${offer.transactionId}#offer-${offer.id}`,
      referenceLabel: buildAlertReferenceLabel("Expiration", offer.expirationAt),
      detailSummary: [
        `Status: ${offer.status.replaceAll("_", " ")}`,
        `Buyer / party: ${offer.buyerName?.trim() || offer.offeringPartyName}`,
        ...(offer.price ? [`Price: ${formatCurrency(offer.price)}`] : [])
      ],
      sortAt: offer.expirationAt
    });
  }

  for (const task of tasksAwaitingReview) {
    const referenceDate = task.submittedForReviewAt ?? task.updatedAt;

    alerts.push({
      id: `alert-awaiting-review-${task.id}`,
      type: "tasks-awaiting-your-review",
      typeLabel: "Tasks awaiting your review",
      severity: "high",
      severityLabel: getSeverityLabel("high"),
      objectType: "task",
      title: "Task awaiting review",
      summary: `${task.title} is waiting for first approval.`,
      objectLabel: `${task.transaction.title} · ${task.transaction.address}, ${task.transaction.city}, ${task.transaction.state}`,
      href: `/office/transactions/${task.transactionId}#transaction-task-${task.id}`,
      referenceLabel: buildAlertReferenceLabel("Submitted", referenceDate),
      detailSummary: [
        `Checklist group: ${task.checklistGroup}`,
        `Submitted by: ${task.submittedForReviewByMembership ? `${task.submittedForReviewByMembership.user.firstName} ${task.submittedForReviewByMembership.user.lastName}` : "Unknown"}`,
        `Assignee: ${task.assigneeMembership ? `${task.assigneeMembership.user.firstName} ${task.assigneeMembership.user.lastName}` : "Unassigned"}`
      ],
      sortAt: referenceDate
    });
  }

  for (const task of tasksAwaitingSecondReview) {
    const referenceDate = task.firstApprovedAt ?? task.updatedAt;

    alerts.push({
      id: `alert-awaiting-second-review-${task.id}`,
      type: "tasks-awaiting-second-review",
      typeLabel: "Tasks awaiting second review",
      severity: "high",
      severityLabel: getSeverityLabel("high"),
      objectType: "task",
      title: "Task awaiting second review",
      summary: `${task.title} is waiting for second approval.`,
      objectLabel: `${task.transaction.title} · ${task.transaction.address}, ${task.transaction.city}, ${task.transaction.state}`,
      href: `/office/transactions/${task.transactionId}#transaction-task-${task.id}`,
      referenceLabel: buildAlertReferenceLabel("First approved", referenceDate),
      detailSummary: [
        `Checklist group: ${task.checklistGroup}`,
        `First approver: ${task.firstApprovedByMembership ? `${task.firstApprovedByMembership.user.firstName} ${task.firstApprovedByMembership.user.lastName}` : "Unknown"}`,
        `Assignee: ${task.assigneeMembership ? `${task.assigneeMembership.user.firstName} ${task.assigneeMembership.user.lastName}` : "Unassigned"}`
      ],
      sortAt: referenceDate
    });
  }

  for (const task of rejectedTasksNeedingAction) {
    const referenceDate = task.rejectedAt ?? task.updatedAt;

    alerts.push({
      id: `alert-rejected-task-${task.id}`,
      type: "rejected-tasks-needing-action",
      typeLabel: "Rejected tasks needing action",
      severity: "medium",
      severityLabel: getSeverityLabel("medium"),
      objectType: "task",
      title: "Rejected task needs follow-up",
      summary: `${task.title} was rejected and needs updates before review can continue.`,
      objectLabel: `${task.transaction.title} · ${task.transaction.address}, ${task.transaction.city}, ${task.transaction.state}`,
      href: `/office/transactions/${task.transactionId}#transaction-task-${task.id}`,
      referenceLabel: buildAlertReferenceLabel("Rejected", referenceDate),
      detailSummary: [
        `Checklist group: ${task.checklistGroup}`,
        `Rejected by: ${task.rejectedByMembership ? `${task.rejectedByMembership.user.firstName} ${task.rejectedByMembership.user.lastName}` : "Unknown"}`,
        `Reason: ${task.rejectionReason ?? "No reason provided"}`
      ],
      sortAt: referenceDate
    });
  }

  for (const transaction of closingSoonTransactions) {
    if (!transaction.closingDate) {
      continue;
    }

    const daysUntilClosing = Math.ceil((transaction.closingDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const severity: OfficeOperationalAlertSeverity = daysUntilClosing <= 3 ? "high" : "medium";

    alerts.push({
      id: `alert-closing-${transaction.id}`,
      type: "transaction-closing-soon",
      typeLabel: "Transaction closing soon",
      severity,
      severityLabel: getSeverityLabel(severity),
      objectType: "transaction",
      title: "Closing date approaching",
      summary: `${transaction.title} is scheduled to close soon.`,
      objectLabel: `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`,
      href: `/office/transactions/${transaction.id}`,
      referenceLabel: buildAlertReferenceLabel("Closing date", transaction.closingDate),
      detailSummary: [
        `Status: ${transaction.status}`,
        `Price: ${formatCurrency(getPurchasedPriceValue(transaction))}`,
        `Owner: ${transaction.ownerMembership ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}` : "Unassigned"}`
      ],
      sortAt: transaction.closingDate
    });
  }

  for (const task of overdueTransactionTasks) {
    if (!task.dueAt) {
      continue;
    }

    alerts.push({
      id: `alert-transaction-task-${task.id}`,
      type: "overdue-transaction-tasks",
      typeLabel: "Overdue transaction task",
      severity: "high",
      severityLabel: getSeverityLabel("high"),
      objectType: "task",
      title: "Transaction task overdue",
      summary: `${task.title} is overdue and still open.`,
      objectLabel: `${task.transaction.title} · ${task.transaction.address}, ${task.transaction.city}, ${task.transaction.state}`,
      href: `/office/transactions/${task.transactionId}`,
      referenceLabel: buildAlertReferenceLabel("Due date", task.dueAt),
      detailSummary: [
        `Checklist group: ${task.checklistGroup}`,
        `Assignee: ${task.assigneeMembership ? `${task.assigneeMembership.user.firstName} ${task.assigneeMembership.user.lastName}` : "Unassigned"}`,
        `Status: ${task.status === "in_progress" ? "In progress" : "Todo"}`
      ],
      sortAt: task.dueAt
    });
  }

  for (const client of contactsNeedingFollowUpSoon) {
    if (!client.nextFollowUpAt) {
      continue;
    }

    alerts.push({
      id: `alert-client-follow-up-${client.id}`,
      type: "contacts-follow-up-soon",
      typeLabel: "Contact follow-up soon",
      severity: "medium",
      severityLabel: getSeverityLabel("medium"),
      objectType: "contact",
      title: "Contact follow-up due soon",
      summary: `${client.fullName} needs follow-up soon.`,
      objectLabel: client.email ? `${client.fullName} · ${client.email}` : client.fullName,
      href: `/office/contacts/${client.id}`,
      referenceLabel: buildAlertReferenceLabel("Next follow-up", client.nextFollowUpAt),
      detailSummary: [
        `Stage: ${client.stage}`,
        `Intent: ${client.intent}`,
        `Owner: ${client.ownerMembership ? `${client.ownerMembership.user.firstName} ${client.ownerMembership.user.lastName}` : "Unassigned"}`
      ],
      sortAt: client.nextFollowUpAt
    });
  }

  for (const task of overdueFollowUpTasks) {
    if (!task.dueAt) {
      continue;
    }

    alerts.push({
      id: `alert-follow-up-task-${task.id}`,
      type: "overdue-follow-up-tasks",
      typeLabel: "Overdue follow-up task",
      severity: "high",
      severityLabel: getSeverityLabel("high"),
      objectType: "task",
      title: "Follow-up task overdue",
      summary: `${task.title} is overdue and still assigned.`,
      objectLabel: task.client?.fullName ?? task.title,
      href: task.clientId ? `/office/contacts/${task.clientId}` : null,
      referenceLabel: buildAlertReferenceLabel("Due date", task.dueAt),
      detailSummary: [
        `Client: ${task.client?.fullName ?? "Unknown"}`,
        `Assignee: ${task.assigneeMembership ? `${task.assigneeMembership.user.firstName} ${task.assigneeMembership.user.lastName}` : "Unassigned"}`,
        `Status: ${task.status === "in_progress" ? "In progress" : "Queued"}`
      ],
      sortAt: task.dueAt
    });
  }

  for (const transaction of financeIncompleteTransactions) {
    const missingFields = [
      transaction.grossCommission === null ? "gross commission" : null,
      transaction.officeNet === null ? "office net" : null,
      transaction.agentNet === null ? "agent net" : null
    ].filter((field): field is string => Boolean(field));

    const severity: OfficeOperationalAlertSeverity =
      transaction.status === TransactionStatus.pending || transaction.status === TransactionStatus.closed ? "high" : "medium";

    alerts.push({
      id: `alert-finance-${transaction.id}`,
      type: "transaction-finance-incomplete",
      typeLabel: "Transaction finance incomplete",
      severity,
      severityLabel: getSeverityLabel(severity),
      objectType: "transaction",
      title: "Transaction finance is incomplete",
      summary: `${transaction.title} is missing key finance values.`,
      objectLabel: `${transaction.title} · ${transaction.address}, ${transaction.city}, ${transaction.state}`,
      href: `/office/transactions/${transaction.id}`,
      referenceLabel: buildAlertReferenceLabel("Last updated", transaction.updatedAt),
      detailSummary: [
        `Missing: ${missingFields.join(", ")}`,
        `Status: ${transaction.status}`,
        `Owner: ${transaction.ownerMembership ? `${transaction.ownerMembership.user.firstName} ${transaction.ownerMembership.user.lastName}` : "Unassigned"}`
      ],
      sortAt: transaction.updatedAt
    });
  }

  for (const task of missingRequiredDocumentTasks) {
    alerts.push({
      id: `alert-missing-required-document-${task.id}`,
      type: "missing-required-documents",
      typeLabel: "Missing required document",
      severity: "high",
      severityLabel: getSeverityLabel("high"),
      objectType: "document",
      title: "Required document is still missing",
      summary: `${task.title} still needs a document before the workflow can move forward.`,
      objectLabel: `${task.transaction.title} · ${task.transaction.address}, ${task.transaction.city}, ${task.transaction.state}`,
      href: `/office/transactions/${task.transactionId}#transaction-documents`,
      referenceLabel: task.dueAt ? buildAlertReferenceLabel("Due date", task.dueAt) : "No due date",
      detailSummary: [
        `Checklist group: ${task.checklistGroup}`,
        `Requires approval: ${task.requiresDocumentApproval ? "Yes" : "No"}`
      ],
      sortAt: task.dueAt ?? task.updatedAt
    });
  }

  for (const request of pendingSignatureRequests) {
    const referenceDate = request.sentAt ?? request.createdAt;

    alerts.push({
      id: `alert-signature-pending-${request.id}`,
      type: "signature-pending",
      typeLabel: "Signature pending",
      severity: request.status === SignatureRequestStatus.viewed ? "medium" : "high",
      severityLabel: getSeverityLabel(request.status === SignatureRequestStatus.viewed ? "medium" : "high"),
      objectType: "document",
      title: "Signature request is still pending",
      summary: `${request.recipientName} has not completed signature yet.`,
      objectLabel: request.document?.title ?? request.form?.name ?? request.transaction.title,
      href: `/office/transactions/${request.transactionId}#transaction-forms-signatures`,
      referenceLabel: buildAlertReferenceLabel("Sent", referenceDate),
      detailSummary: [
        `Recipient: ${request.recipientName}`,
        `Email: ${request.recipientEmail}`,
        `Status: ${request.status === SignatureRequestStatus.viewed ? "Viewed" : "Sent"}`
      ],
      sortAt: referenceDate
    });
  }

  for (const incomingUpdate of pendingIncomingUpdates) {
    alerts.push({
      id: `alert-incoming-update-${incomingUpdate.id}`,
      type: "incoming-updates-awaiting-review",
      typeLabel: "Incoming update awaiting review",
      severity: "medium",
      severityLabel: getSeverityLabel("medium"),
      objectType: "document",
      title: "Incoming update needs review",
      summary: incomingUpdate.summary,
      objectLabel: incomingUpdate.transaction
        ? `${incomingUpdate.transaction.title} · ${incomingUpdate.transaction.address}, ${incomingUpdate.transaction.city}, ${incomingUpdate.transaction.state}`
        : `${incomingUpdate.sourceSystem} · ${incomingUpdate.sourceReference}`,
      href: incomingUpdate.transactionId
        ? `/office/transactions/${incomingUpdate.transactionId}#transaction-incoming-updates`
        : "/office/activity?view=alerts&alertSection=incoming-updates-awaiting-review",
      referenceLabel: buildAlertReferenceLabel("Received", incomingUpdate.receivedAt),
      detailSummary: [
        `Source system: ${incomingUpdate.sourceSystem}`,
        `Reference: ${incomingUpdate.sourceReference}`
      ],
      sortAt: incomingUpdate.receivedAt
    });
  }

  return sortAlerts(alerts);
}

export async function recordActivityLogEvent(writer: AuditLogWriter, input: RecordActivityLogEventInput) {
  const payload = input.payload ? (JSON.parse(JSON.stringify(input.payload)) as Prisma.InputJsonValue) : Prisma.JsonNull;

  await writer.auditLog.create({
    data: {
      organizationId: input.organizationId,
      membershipId: input.membershipId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      payload
    }
  });
}

export async function addOfficeActivityComment(input: AddOfficeActivityCommentInput) {
  const body = input.body.trim();

  if (!body) {
    throw new Error("Comment body is required.");
  }

  await recordActivityLogEvent(prisma, {
    organizationId: input.organizationId,
    membershipId: input.membershipId,
    entityType: "activity_comment",
    entityId: randomUUID(),
    action: activityLogActions.activityCommentAdded,
    payload: {
      officeId: input.officeId ?? null,
      objectLabel: `${input.scopeLabel} · Internal comment`,
      commentBody: body,
      contextHref: input.contextHref ?? undefined,
      details: []
    }
  });
}

export async function getOfficeActivityLogSnapshot(input: GetOfficeActivityLogInput): Promise<OfficeActivityLogSnapshot> {
  const limit = input.limit ?? 200;
  const selectedView = getViewMode(input.view);
  const selectedActivitySection = getActivitySectionDefinition(input.activitySection);
  const selectedAlertSection = getAlertSectionDefinition(input.alertSection);
  const selectedObjectType = normalizeObjectType(input.objectType);
  const startDate = parseStartDate(input.startDate);
  const endDate = parseEndDate(input.endDate);
  const fetchWindow = Math.max(limit * 5, 1000);

  const rawEvents = await prisma.auditLog.findMany({
    where: {
      organizationId: input.organizationId,
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {})
            }
          }
        : {})
    },
    include: {
      membership: {
        include: {
          user: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }],
    take: fetchWindow
  });

  const officeScopedEvents = rawEvents.filter((record) => {
    if (!input.officeId) {
      return true;
    }

    return getActivityPayload(record.payload).officeId === input.officeId;
  });

  const objectScopedEvents =
    selectedObjectType === "all"
      ? officeScopedEvents
      : officeScopedEvents.filter((record) => mapEntityTypeToObjectType(record.entityType) === selectedObjectType);

  const actorOptions = await getActorOptions(objectScopedEvents);
  const actorScopedEvents = input.actorMembershipId
    ? objectScopedEvents.filter((record) => record.membershipId === input.actorMembershipId)
    : objectScopedEvents;
  const latestActivityWindow = actorScopedEvents.slice(0, limit).map(formatActivityLogRecord);

  const activitySections = activityLogSectionDefinitions.map((section) => ({
    key: section.key,
    label: section.label,
    count: latestActivityWindow.filter((event) => section.matches(event.action)).length
  }));

  const activityEvents =
    selectedView === "alerts"
      ? []
      : selectedActivitySection.key === "all"
        ? latestActivityWindow
        : latestActivityWindow.filter((event) => selectedActivitySection.matches(event.action));

  const derivedAlerts = await listOperationalAlerts({
    organizationId: input.organizationId,
    officeId: input.officeId,
    currentMembershipId: input.currentMembershipId,
    canReviewTasks: input.canReviewTasks,
    canSecondaryReviewTasks: input.canSecondaryReviewTasks,
    objectType: selectedObjectType,
    startDate,
    endDate
  });

  const alertSections: OfficeActivityAlertSection[] = [
    {
      key: "all",
      label: "All alerts",
      count: derivedAlerts.length
    },
    ...activityAlertSectionDefinitions.map((section) => ({
      key: section.key,
      label: section.label,
      count: derivedAlerts.filter((alert) => section.matches(alert)).length
    }))
  ];

  const alerts =
    selectedView === "activity"
      ? []
      : selectedAlertSection
        ? derivedAlerts.filter((alert) => selectedAlertSection.matches(alert))
        : derivedAlerts;

  return {
    latestWindowLabel: `Latest ${limit} activity records`,
    latestWindowCount: latestActivityWindow.length,
    selectedView,
    activitySelectedSection: selectedActivitySection.key,
    activitySelectedSectionLabel: selectedActivitySection.label,
    alertSelectedSection: selectedAlertSection?.key ?? "all",
    alertSelectedSectionLabel: selectedAlertSection?.label ?? "All alerts",
    activitySections,
    alertSections,
    activityEvents,
    alerts,
    filters: {
      actorMembershipId: input.actorMembershipId ?? "",
      objectType: selectedObjectType,
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      actorOptions
    }
  };
}
