export function isChineseLocale(locale: string) {
  return locale === "zh-CN";
}

export function copyForLocale(isZh: boolean, english: string, chinese: string) {
  return isZh ? chinese : english;
}

const frontOfficeLabelZh: Record<string, string> = {
  "Active follow-up": "跟进中",
  "Archived": "已归档",
  "Auto reminder": "自动提醒",
  "Budget not set": "预算未设置",
  "Missing PDF": "缺少 PDF",
  "Manual reminder": "手动提醒",
  "New lead": "新线索",
  "No buyer email saved": "未保存买方邮箱",
  "No buyer snapshot": "没有买方快照",
  "No description": "没有描述",
  "No file selected": "未选择文件",
  "No project yet": "还没有项目",
  "No signing fields yet": "还没有签署字段",
  "No template selected": "未选择模板",
  "No templates selected": "未选择模板",
  "Not followed up yet": "尚未跟进",
  "Not set": "未设置",
  "Paused": "已暂停",
  "PDF ready": "PDF 已就绪",
  "Ready for sessions": "可创建签署会话",
  "Ready to upload": "可上传",
  "Remote": "远程",
  "Selected project": "已选项目",
  "Target area not set": "目标区域未设置",
  "Waiting reply": "等待回复",
  "Appointment booked": "已预约",
  "signed": "已签署",
  "active": "启用中",
  "archived": "已归档",
  "completed": "已完成",
  "draft": "草稿",
  "remote": "远程",
  "sent": "已发送",
  "unused": "未使用",
};

export function translateFrontOfficeLabel(value: string, isZh: boolean) {
  if (!isZh) {
    return value;
  }

  return frontOfficeLabelZh[value] ?? value;
}

export function formatFrontOfficeCount(
  count: number,
  isZh: boolean,
  englishSingular: string,
  englishPlural: string,
  chineseUnit: string,
) {
  if (isZh) {
    return `${count} ${chineseUnit}`;
  }

  return `${count} ${count === 1 ? englishSingular : englishPlural}`;
}
