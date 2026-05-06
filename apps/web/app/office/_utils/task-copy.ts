export function translateOfficeTaskCopy(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  const copyMap: Record<string, string> = {
    All: "全部",
    "All statuses": "全部状态",
    "All transactions": "全部交易",
    "Requires attention": "需要处理",
    Opportunity: "机会",
    Active: "进行中",
    Pending: "待处理",
    "Pending upload": "等待上传",
    "Uploaded / not submitted": "已上传，待提交",
    Closed: "已成交",
    Cancelled: "已取消",
    "System Anchor": "系统锚点",
    Todo: "待办",
    "In progress": "进行中",
    "Review requested": "等待审核",
    Completed: "已完成",
    Complete: "已完成",
    Reopened: "已重新打开",
    Approved: "已通过",
    Rejected: "已退回",
    "Not required": "无需审核",
    "First approved": "一审通过",
    "Second review": "二级审核",
    "Second review requested": "等待二级审核",
    "In review": "审核中",
    "Not applicable": "不适用",
    Draft: "草稿",
    Prepared: "已准备",
    "Sent for signature": "已发送签署",
    "Partially signed": "部分已签",
    "Fully signed": "已全部签署",
    Voided: "已作废",
    "Pending send": "待发送",
    Sent: "已发送",
    Viewed: "已查看",
    Signed: "已签署",
    Declined: "已拒签",
    Canceled: "已取消",
    "Void / Cancelled": "已作废/取消",
    Expired: "已过期",
    "Waiting for signatures": "等待签署",
    "No due date": "无到期时间",
    "Task rows": "任务行",
    System: "系统",
    General: "通用",
    Compliance: "合规",
    "Broker Review": "经纪审核",
    "Closing Prep": "成交准备",
    "Listing Prep": "挂牌准备"
  };

  return copyMap[value] ?? value;
}

export function translateOfficeTaskWindowLabel(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  const windowMatch = value.match(/^Showing up to (\d+) tasks$/);
  if (windowMatch) {
    return `最多显示 ${windowMatch[1]} 项任务`;
  }

  return translateOfficeTaskCopy(value, isZh);
}

export function formatOfficeDateTimeLabel(value: string, locale: string) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
