export const commissionStatusOptions = [
  { value: "", label: "All statuses", zhLabel: "全部状态" },
  { value: "draft", label: "Draft", zhLabel: "草稿" },
  { value: "calculated", label: "Calculated", zhLabel: "已计算" },
  { value: "reviewed", label: "Reviewed", zhLabel: "已审核" },
  { value: "statement_ready", label: "Statement ready", zhLabel: "付款单就绪" },
  { value: "payable", label: "Payable", zhLabel: "可付款" },
  { value: "paid", label: "Paid", zhLabel: "已付款" }
];

export const commissionStatusUpdateOptions = commissionStatusOptions.filter((option) => option.value);

export function translateCommissionCopy(value: string, isZh: boolean): string {
  if (!isZh) {
    return value;
  }

  const copyMap: Record<string, string> = {
    "All statuses": "全部状态",
    Draft: "草稿",
    Calculated: "已计算",
    Reviewed: "已审核",
    "Statement ready": "付款单就绪",
    Payable: "可付款",
    Paid: "已付款",
    Pending: "待处理",
    Approved: "已批准",
    Rejected: "已拒绝",
    Current: "当前",
    Historical: "历史版本",
    Restricted: "受限",
    Active: "启用",
    Inactive: "停用",
    Template: "模板",
    Custom: "自定义",
    "Custom split": "自定义拆分",
    Agent: "经纪人",
    Brokerage: "公司",
    Referral: "推荐方",
    Team: "团队",
    "Team Leader": "团队负责人",
    "Junior Team Leader": "初级团队负责人",
    Member: "成员",
    Owner: "所有者",
    "Office Admin": "办公室管理员",
    Accountant: "会计",
    "Human Resources": "人事",
    "Team Lead": "团队主管",
    "Office Manager": "办公室经理",
    "Office User": "办公室用户",
    "Split & fees": "拆分和费用",
    "Flat net": "固定净额",
    Flat: "固定金额",
    Percentage: "百分比",
    "Open-ended": "长期有效",
    Review: "待复核",
    "Legacy commission item": "旧佣金项目",
    "Company residual": "公司留存",
    "Default split chain": "默认拆分链",
    "No default split configured": "尚未配置默认拆分",
    "Not configured": "未配置",
    "Used for latest calculation": "用于最近一次计算",
    "Manual override": "手动调整",
    "Manual override participant": "手动调整参与方",
    "Manual participant": "手动参与方",
    "Manual / transaction finance": "手动 / 交易财务",
    "Pre-Split": "拆分前",
    "Post-Split": "拆分后",
    Reimbursement: "报销调整",
    "Failed to save commission plan.": "无法保存佣金计划。",
    "Failed to assign commission plan.": "无法分配佣金计划。",
    "Failed to remove commission assignment.": "无法移除佣金分配。",
    "Failed to save split template.": "无法保存拆分模板。",
    "Failed to delete split template.": "无法删除拆分模板。",
    "Failed to calculate commissions.": "无法计算佣金。",
    "Failed to apply override.": "无法应用手动调整。",
    "Failed to update calculation status.": "无法更新计算状态。",
    "Failed to update commission status.": "无法更新佣金状态。",
    "Failed to generate statement snapshot.": "无法生成付款单快照。",
    "This transaction has manual override participants. Continue using Override instead of Recalculate.": "此交易已有手动调整参与方。请继续使用手动调整，不要重新计算。",
    "Override not saved. Review the highlighted fields and try again.": "手动调整未保存。请检查标出的字段后重试。",
    "Override reason is required.": "必须填写调整原因。",
    "Each override amount must be a valid number that is zero or greater.": "每个调整金额都必须是大于或等于 0 的有效数字。",
    "Each override row must include a stable key.": "每一行调整都必须包含稳定键值。",
    "Duplicate override rows are not allowed.": "不允许重复的调整行。",
    "Every override row must include a valid amount.": "每一行调整都必须填写有效金额。",
    "Override amounts must be zero or greater.": "调整金额必须大于或等于 0。",
    "Every participant row must include a valid membership.": "每个参与方行都必须包含有效成员。",
    "Manual participant keys must match the selected membership.": "手动参与方键值必须与所选成员一致。",
    "Duplicate participant memberships are not allowed.": "不允许重复的参与方成员。",
    "Manual override must include exactly one company row.": "手动调整必须且只能包含一条公司行。",
    "Only manually added participants can be removed from an override.": "只有手动添加的参与方可以从调整中移除。",
    "Only Office Admin can add or remove override participants.": "只有办公室管理员可以添加或移除调整参与方。",
    "Override amounts must keep the total allocated payout unchanged.": "调整金额必须保持已分配付款总额不变。",
    "Manual override must retain the company payout row.": "手动调整必须保留公司付款行。",
    "Enter a valid identifier.": "请输入有效标识。",
    "Enter at least one stakeholder override row.": "请至少输入一行参与方调整。",
    "Some internal allocations are hidden for your current commission access level.": "按你当前的佣金访问权限，部分内部分配已隐藏。",
    "Post-split fees require a transaction owner and split chain before calculation.": "拆分后费用需要先有交易负责人和拆分链，才能计算。",
    "Post-split deductions exceed the owner agent share for this transaction.": "拆分后扣减已超过此交易负责人经纪人的份额。"
  };

  const exact = copyMap[value] ?? value;

  return exact
    .replace(/^Template: /, "模板：")
    .replace(/^Locked on /, "锁定于 ")
    .replace(/^Post-Split fee/, "拆分后费用")
    .replace(/^Version (\d+)$/, "版本 $1")
    .replace(/^Mode: (.+)$/, (_match, mode: string): string => `模式：${translateCommissionCopy(mode, true)}`)
    .replace(/^Reference: (.+)$/, (_match, reference: string): string => `参考：${translateCommissionCopy(reference, true)}`)
    .replace(/^Reason: (.+)$/, "原因：$1")
    .replace(/ default split$/i, " 默认拆分")
    .replace(/ split$/i, " 拆分")
    .replace(/% actual share$/i, "% 实际份额")
    .replace(/% company residual$/i, "% 公司留存")
    .replace(
      /^(.+) \((.+)\) is missing a default split\. Configure the member default split before calculating commission\.$/,
      (_match, member: string, role: string): string => `${member}（${translateCommissionCopy(role, true)}）缺少默认拆分。请先配置该成员的默认拆分，再计算佣金。`
    )
    .replace(
      /^(\d+) legacy plan\(s\) still use fee or sliding-scale rules and should be reviewed in Advanced settings\.$/,
      "$1 个旧佣金计划仍在使用费用或阶梯拆分规则，请在高级设置中复核。"
    )
    .replace(
      /^(\d+) legacy team assignment\(s\) remain active and are not used by the new default split chain\.$/,
      "$1 个旧团队佣金分配仍处于启用状态，但不会被新的默认拆分链使用。"
    );
}

export function commissionStatusOptionLabel(option: { label: string; zhLabel: string }, isZh: boolean) {
  return isZh ? option.zhLabel : option.label;
}

export function formatCommissionCount(count: number, singular: string, plural: string, zhUnit: string, isZh: boolean) {
  return isZh ? `${count} ${zhUnit}` : `${count} ${count === 1 ? singular : plural}`;
}

export function getCommissionErrorMessage(error: unknown, fallback: string, isZh: boolean) {
  const message = error instanceof Error ? error.message : fallback;
  return translateCommissionCopy(message, isZh);
}
