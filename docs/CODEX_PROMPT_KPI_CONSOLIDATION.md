# Codex Prompt D — KPI 条 + Settings 信息架构合并

> 目的：当前多处 page 用"一排 StatCard + 同数据的表格/表单"的冗余布局，用户视觉被切片成几十个小盒子，核心数据反而被挤到 fold 下方。这一轮**合并 KPI 表达**，不改数据语义。
>
> 范围：`apps/web/app/office/dashboard/`、`apps/web/app/office/settings/`、`apps/web/app/office/tasks/`。
>
> 前置：建议 **Prompt C（UI 文案瘦身）已合入**，这样 settings/page.tsx 干净了之后再动布局。如果 Prompt C 没合，这个任务里**不要顺手改任何文案**，只改布局。
>
> 风险：中等（动 JSX 结构 + CSS grid）。需要一份部署前截图对比（dev server 本地截图即可）。
>
> 验收：`apps/web` typecheck 通过；视觉对比截图附在 PR 里。

---

## 任务 1 — `/office/dashboard` 的 9 张 StatCard → 2 条紧凑 KPI 带

### 现状

`apps/web/app/office/dashboard/page.tsx` 大约 137-147 行渲染 transaction status 的 5 张 StatCard（Opportunity / Active / Pending / Closed / Cancelled），再在 292-297 行渲染 4 张 commission StatCard（Total / This Month / Payable / Paid）。合计 9 张，占据首屏将近一半垂直空间。

### 目标

- **第一条 KPI 带**（transaction counts）：改成一个**水平紧凑条**，每个状态一个"label · value"的 chip，而不是每个独占一个 Card。chip 之间用 `·` 分隔或用 `Badge` 组件。单行显示，高度 ≤ 40px。
- **第二条 KPI 带**（commission）：同上，单行，4 个数字一排。

### 实现

新增（或复用现有的）一个 `<KpiStrip>` 组件：

```tsx
// apps/web/app/_components/kpi-strip.tsx （如果不存在则新增）
type KpiStripItem = { label: string; value: string | number; tone?: "accent" | "muted" };

export function KpiStrip({ items }: { items: KpiStripItem[] }) {
  return (
    <div className="office-kpi-strip">
      {items.map((item, index) => (
        <span key={item.label} className={`office-kpi-strip-item office-kpi-strip-item-${item.tone ?? "default"}`}>
          <span className="office-kpi-strip-label">{item.label}</span>
          <strong className="office-kpi-strip-value">{item.value}</strong>
        </span>
      ))}
    </div>
  );
}
```

CSS（加到 `globals.css` 或就近 css 模块）：

```css
.office-kpi-strip {
  display: flex;
  gap: 18px;
  align-items: baseline;
  padding: 8px 12px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: var(--surface-subtle);
  flex-wrap: wrap;
}
.office-kpi-strip-item {
  display: flex;
  gap: 6px;
  align-items: baseline;
  font-size: 13px;
}
.office-kpi-strip-label { color: var(--text-muted); }
.office-kpi-strip-value { font-size: 15px; font-weight: 600; }
.office-kpi-strip-item-accent .office-kpi-strip-value { color: var(--accent-primary); }
```

在 dashboard page 里把 9 张 StatCard 的 JSX 换成两个 `<KpiStrip>` 调用。**不要删除数据源**，只改渲染。

### 验收

- 两条 KPI 带加起来高度 ≤ 100px（原来 9 张 Card 大约占 300-400px）
- 数字仍然对得上原 StatCard 的值
- Screen reader 能读出 label+value（用 `<span>` + aria-label 或 `<dl>/<dt>/<dd>` 都可以）

---

## 任务 2 — `/office/settings` 干掉"概览卡片网格"（信息架构三重冗余）

### 现状

`apps/web/app/office/settings/page.tsx` 当前是：

1. 顶部 `<OfficeSettingsNav>`（line 41）——9 个链接的横向导航
2. `<section className="office-settings-summary-grid">`（line 43-48）——4 张 StatCard (Users/Teams/Required roles/Checklists)
3. `<section className="office-settings-section-grid">`（line 50-130）——8 张 SectionCard，每张是 Users / Roles / Email delivery / Teams / Fields / Checklists / Signature Drive / Commission plans，每张有 title + subtitle + （Prompt C 已删的）paragraph + 一个"Open xxx" 链接

**问题**：导航第 1 块已经告诉用户去哪点；概览第 3 块再把同一批链接以卡片形式列一遍——同样的信息架构在同一个页面出现 2 次。4 张 StatCard 则和第 3 块重复（Users / Teams / Checklists 都在第 3 块的卡片名里）。

### 目标

改成：**1 条 KPI 带（保留所有 StatCard 但用 Strip）+ 1 个 nav**。删掉整个 `office-settings-section-grid` 段。

### 实现

1. 用任务 1 里的 `<KpiStrip>` 替换 `office-settings-summary-grid`。
2. **整个删掉** `<section className="office-settings-section-grid">` 块（line 50-130 附近）——这 8 张 SectionCard 的 Link 目标已经在 `<OfficeSettingsNav>` 里存在了。
3. 如果 `OfficeSettingsNav` 里缺 Email delivery / Signature Drive / Commission plans 的入口（因为它们是带权限 gating 的），**只补齐 nav**——而不是保留这些概览卡片。

### 验收

- Settings 页面首屏打开只看到：Title + summary chips + KpiStrip + Nav + 空白（或一个小 hint："Pick a section above to start"）
- 把 9 个 link 过一遍，全部仍然可达（从 nav）
- 页面总高度从~ 900px 降到 ~300px

---

## 任务 3 — `/office/tasks` 的过滤器 + KPI 区块收紧

### 现状

`apps/web/app/office/tasks/tasks-client.tsx`：

- line 332-447：一张大 SectionCard "Filters" 包着 8+ 个 FilterField
- line 449-456：`office-kpi-grid office-kpi-grid-compact` 渲染 attentionSummary 的一排小卡
- line 458-475：一张 SectionCard "Saved views" 有输入框 + 按钮
- line 477-xxxxx：一张 SectionCard "New task"

### 目标

- 把过滤器 Card 的 SectionCard **外壳去掉**（保留 FilterBar 本身），让过滤器直接贴着页头，占用少
- `attentionSummary` 小卡阵改成 `<KpiStrip>`（与任务 1 同一个组件）

### 实现

```tsx
// 原
<SectionCard className="office-list-card office-task-filter-form" title="Filters">
  <FilterBar as="form" …>
    …
  </FilterBar>
</SectionCard>

// 改成
<FilterBar as="form" className="office-task-filter-form" method="get">
  …
</FilterBar>
```

把 `attentionSummary` 那段 `<article className="office-kpi-card">` 的 map 改成 `<KpiStrip items={attentionSummary.map(...)}>`。**"Saved views" 和 "New task" 两张 Card 保留**（它们是真正的交互 Card，不是 KPI）。

### 验收

- 过滤器从"卡片内的表单"变成"页头下的直接表单"，视觉层级降一层
- `attentionSummary` 从卡阵变成一条 Strip

---

## 禁止项

- ❌ 不要改 StatCard / SectionCard 组件本身（它们在其他页面还在用）
- ❌ 不要动任何数据源、API 调用、permission 检查
- ❌ 不要顺手改 CSS 变量名（`--surface-subtle` 那些）——只加新 class，不改老 class
- ❌ 不要把 KpiStrip 做得比 StatCard 更花哨（不要 icon、不要 hover、不要 motion）——越轻越好
- ❌ 不要把 settings 页的 "section-grid" 保留"以防有用户靠它找入口"——如果担心，加一行 hint 到 nav 下面就够了
- ❌ 不要改 `OfficeSettingsNav` 的 layout，只补齐遗漏的链接条目

---

## 交付清单

- [ ] 新增 `apps/web/app/_components/kpi-strip.tsx`（或复用已有同等组件，grep 一下 `KpiStrip\|kpi-strip` 看有没有）
- [ ] 对应 CSS 加到 `globals.css` 或就近模块
- [ ] `apps/web/app/office/dashboard/page.tsx` — 9 张 StatCard → 2 条 KpiStrip
- [ ] `apps/web/app/office/settings/page.tsx` — KpiStrip 替换 StatCard grid，删 section-grid
- [ ] `apps/web/app/office/tasks/tasks-client.tsx` — 过滤器去壳 + attentionSummary 换 Strip
- [ ] `cd apps/web && npx tsc --noEmit` 通过
- [ ] dev server 跑起来各截一张图（before/after），贴在 commit message 或 PR description 里
- [ ] **一个独立 commit**，message: `ui: consolidate stat card grids into compact KPI strips`

---

## 延后的（这一轮不做）

- `office/accounting/accounting-client.tsx` 里的 12 张 StatCard → 合并为动态 summary 的任务单独放，因为那涉及 filter state 联动，比这一轮复杂
- Listings 卡片 grid、agents 列表的密度问题 → 下一轮
- Monster component 拆分（listing-studio-detail-client 2616 行 / agent-notifications-client 2886 行 / accounting-client 1654 行）→ P3-2，独立 roadmap
