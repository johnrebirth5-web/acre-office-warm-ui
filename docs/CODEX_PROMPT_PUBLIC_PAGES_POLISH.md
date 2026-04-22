# Codex Prompt E — 公开页面（share / sign / invite / login）抛光

> 目的：公开页面（share / sign / invite）是**客户和外部签名人**第一次也可能是唯一一次接触这个系统的地方；当前错误状态是黑白纯文本、mobile 侧栏挤占主内容、复刻了后台的"卡片阵列"视觉。这一轮只做**公开页面的 UX polish**，不改业务逻辑、不改鉴权流程。
>
> 范围：
> - `apps/web/app/share/listings/[code]/`
> - `apps/web/app/share/packs/[code]/`
> - `apps/web/app/sign/[token]/`（包括 public-signature-client）
> - `apps/web/app/invite/[token]/`
> - `apps/web/app/login/`、`apps/web/app/change-password/`
>
> 风险：中等（动态 UI 文本 + mobile 布局）。**必须**在移动 viewport（375×812 iPhone 12 尺寸）和桌面（1440×900）各手动测一次。
>
> 验收：`apps/web` typecheck 通过；附 4 张截图（桌面+移动 × share+sign）。

---

## 任务 1 — 签名页错误状态从"纯文本段落"改成"带图标的 inline callout"

### 现状

`apps/web/app/sign/[token]/public-signature-client.tsx` 约 60-89 行的状态消息（"This signing link has expired"、"You already completed your signing step"）是扁平 `<p>` 文本，没有图标、没有颜色分级、没有后续操作。对外部签名人（通常不熟悉系统）来说，看起来像页面出错。

### 目标

为 5 类状态各设计一个简洁 callout：
1. **expired**：橙色 / clock 图标 / 文案"This link expired on {date}." / CTA "Request a new link"（mailto 联系发件人）
2. **consumed**：绿色 / check 图标 / 文案"You already signed this on {date}." / 无 CTA（只提供"Download your signed copy"如果有）
3. **revoked**：灰色 / x 图标 / "The sender cancelled this signing request." / CTA "Contact sender"
4. **not-found**：灰色 / question 图标 / "This link isn't valid." / 无 CTA
5. **rate-limited**：灰色 / timer 图标 / "Too many attempts. Try again in a few minutes."

### 实现

新增 `apps/web/app/sign/[token]/signature-status-callout.tsx`：

```tsx
type Tone = "info" | "success" | "warning" | "error";
type Props = {
  tone: Tone;
  title: string;
  description?: string;
  action?: { label: string; href: string };
};

export function SignatureStatusCallout({ tone, title, description, action }: Props) {
  return (
    <div className={`public-signature-callout public-signature-callout-${tone}`} role="status">
      <SignatureStatusIcon tone={tone} />
      <div className="public-signature-callout-body">
        <strong>{title}</strong>
        {description ? <p>{description}</p> : null}
        {action ? <a className="public-signature-callout-action" href={action.href}>{action.label}</a> : null}
      </div>
    </div>
  );
}
```

`SignatureStatusIcon` 用 inline SVG 或 `lucide-react` 的 `Clock / CheckCircle / XCircle / HelpCircle / Timer`（grep 下当前项目已经在用的 icon 库，跟着用）。

CSS 加到 `public-signature.css` 或就近模块。配色用 token：
- warning: 橙色边 + 浅橙底
- success: 绿色边 + 浅绿底
- error: 红色边 + 浅红底
- info: 蓝/灰边 + 浅灰底

### 在 public-signature-client.tsx 里集成

把原来的那些状态 `<p>` / alert div 替换为 `<SignatureStatusCallout tone={...} title={...} ... />`。状态分支判断逻辑**不动**，只换渲染。

---

## 任务 2 — Sign 页 mobile 侧栏合并进主体

### 现状

`public-signature-client.tsx` 约 320-357 行：侧栏包含 eyebrow + 大标题 + 一段 context 段落 + 4 行 metadata + 3 个可能的状态消息。桌面 OK，mobile (< 768px) 挤占主文档视觉。

### 目标

在 `max-width: 768px` 媒体查询下：
- 侧栏折叠为顶部的一个"Summary"卡：只显示 title + 关键 metadata（签名人、发件人、截止日期），其他内容进入"Details"折叠
- 状态 callout（任务 1 里的 Callout）**只在文档区顶部显示一次**，不要同时在侧栏和文档区都出现

### 实现

改 CSS，不大改 JSX 结构。在侧栏组件外层加 `.public-signature-sidebar-mobile-collapse` 相关样式：

```css
@media (max-width: 767px) {
  .public-signature-sidebar {
    order: -1;
  }
  .public-signature-sidebar-description,
  .public-signature-sidebar-helper {
    display: none; /* 或 折叠到 <details> */
  }
}
```

或者（更稳）：在 JSX 里根据 `useMediaQuery` / `matchMedia` 条件渲染简化版 —— 但这会引入 client state，先用 CSS 方案即可。

---

## 任务 3 — Share listings 页视觉层级

### 现状

`apps/web/app/share/listings/[code]/page.tsx` 约 38-63 行：6 个等宽的 fact card（Area / Price / Layout / Shared by / Channel / Availability），读起来没有优先级。

另外 94-95 行有句 `"Use the contact buttons above if you want to talk through the listing"` —— 按钮就在那，这句话删。

### 目标

- **Top row**（大）：Price、Area、Layout —— 用更大的字号（28-32px value + 13px label），每个占约 1/3 宽
- **Secondary row**（小）：Shared by、Channel、Availability —— 小字号（15px value + 12px label），水平排列，视觉权重明显降一级
- 删 line 94-95 的 "Use the contact buttons" 废话（按钮自解释）
- 96 行开始如果有 footer 隐私/followup 的长文案，保留但移到 `<footer>` 容器，视觉和内容区隔开

### 实现

CSS grid 改成：
```css
.share-listing-facts-primary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.share-listing-facts-primary .value { font-size: 28px; font-weight: 700; }
.share-listing-facts-secondary { display: flex; gap: 24px; margin-top: 16px; font-size: 14px; }
.share-listing-facts-secondary .value { font-weight: 600; }
.share-listing-facts-secondary .label { color: var(--text-muted); margin-right: 4px; }
```

JSX 把原来的 6 张等宽 card 拆成两组：primary 3 个，secondary 3 个。

---

## 任务 4 — Invite 页错误状态统一

### 现状

`apps/web/app/invite/[token]/page.tsx` 大约 43-49 行：4 种错误（invalid / expired / already-accepted / org-disabled）都渲染到同一个 `.auth-error` 盒子，视觉无差异，文案平铺。

### 目标

复用任务 1 的 `SignatureStatusCallout` 组件（或另起一个 `AuthStatusCallout` —— **二选一**，别两个都建）：
- invalid / not-found → info tone
- expired → warning tone + "Ask your inviter to send a fresh link" CTA
- already-accepted → success tone + "Sign in" CTA 跳 /login
- org-disabled → error tone

成功路径（token 有效 → 渲染 accept form）不变。

---

## 任务 5 — Login 页去掉 readOnly + 手动解锁的怪异 UX

### 现状

`apps/web/app/login/login-form.tsx` 约 14-46 行：输入框以 `readOnly` 开头，需要用户手动点击才 `enableManualEntry()` 解锁。这是一个防 autofill 的 workaround，但普通用户会误以为页面坏了。

### 目标

删掉 `readOnly` + `enableManualEntry` 这套逻辑。保留 `autoComplete="off"`（或 `"current-password"` —— 按实际诉求）。如果真的有防 autofill 的安全诉求，改用服务端渲染 + `<input autocomplete="new-password">` 或 honeypot 字段，但**这一步不做**，只是删掉当前的怪异状态机。

### 实现

```tsx
// 删掉：
const [manualEntry, setManualEntry] = useState(false);
const enableManualEntry = () => setManualEntry(true);
<input readOnly={!manualEntry} onFocus={enableManualEntry} … />

// 改成：
<input autoComplete="off" … />
```

加一条代码注释：`// We intentionally disable browser autofill here; see /docs/env.md for rationale.`

### ⚠️ 安全回归风险

如果"禁止 autofill"是合规/审计要求，**先查**：
- `git log -p apps/web/app/login/login-form.tsx | grep -i 'autofill\|readOnly\|manual'` 看当初引入时的 commit message
- `grep -ri 'autofill' docs/ apps/web/README.md` 看是否有文档理由

如果找到明确的合规理由 → **不改这一项**，在 PR 里说明并保留现状；其他任务照常做。

---

## 任务 6 — change-password 页密码规则挪到输入之后

### 现状

`apps/web/app/change-password/page.tsx` 约 123-126 行：密码要求以多段文字形式出现在输入框**上方**（forced-change 状态描述 + 规则段落 + 动态长度提示）。用户在看规则时还没开始输入，注意力被切到规则上。

### 目标

- 把"rules 段落"挪到输入框**下方**的一个 `<ul>`
- 改成动态勾选状态（✓ 已满足 / · 未满足）
- 用最短的句子（"At least 10 characters" / "One uppercase letter" / "One number" / "One symbol"）
- forced-change 的 context paragraph 保留在顶部

### 实现

建 `apps/web/app/change-password/password-rules.tsx`：

```tsx
export function PasswordRules({ value }: { value: string }) {
  const rules = [
    { label: "At least 10 characters", ok: value.length >= 10 },
    { label: "One uppercase letter", ok: /[A-Z]/.test(value) },
    { label: "One lowercase letter", ok: /[a-z]/.test(value) },
    { label: "One number", ok: /\d/.test(value) },
    { label: "One symbol", ok: /[^A-Za-z0-9]/.test(value) },
  ];
  return (
    <ul className="password-rules">
      {rules.map((rule) => (
        <li key={rule.label} className={rule.ok ? "password-rule-ok" : "password-rule-pending"}>
          <span>{rule.ok ? "✓" : "·"}</span> {rule.label}
        </li>
      ))}
    </ul>
  );
}
```

⚠️ 客户端的校验规则**必须**跟服务端保持一致。grep `apps/web/app/api/auth/change-password/route.ts` 以及 `packages/auth` 里的 `validatePassword` 函数，把这 5 条规则对齐到同一个来源（建议把 rules 定义放到 `packages/auth` 里，客户端和服务端都引用）。如果 grep 下来发现规则参数不一致，**先写进报告**让 John 决策，这一步就先不做。

---

## 禁止项

- ❌ 不要改 `/api/public/signatures/` 任何服务端逻辑
- ❌ 不要改邀请/签名 token 的验证流程
- ❌ 不要为了视觉一致性把后台的 SectionCard 搬到公开页面（公开页面该极简）
- ❌ 不要加动画（transition 超过 150ms 都不要）、不要加营销 CTA、不要加"Powered by Acre" footer badge
- ❌ 不要在 public 页面 track analytics / 加 Sentry / 加 `fetch` 调用（除了已有的）
- ❌ 不要把任务 5（login readOnly）和其他任务混在一个 commit 里（它可能要回滚）

---

## 交付清单（分 commit）

- [ ] Commit 1: `ui(sign): replace status paragraphs with iconed callouts` — 任务 1
- [ ] Commit 2: `ui(sign): collapse sidebar on mobile` — 任务 2
- [ ] Commit 3: `ui(share): emphasize price/area/layout, demote secondary facts` — 任务 3
- [ ] Commit 4: `ui(invite): unify error callouts with sign page style` — 任务 4
- [ ] Commit 5: `ui(login): remove readOnly+manual-entry workaround` — 任务 5（仅在安全回归风险确认无误后做）
- [ ] Commit 6: `ui(change-password): move rules below input with live checks` — 任务 6（仅在规则源对齐后做）
- [ ] `cd apps/web && npx tsc --noEmit` 通过
- [ ] **必须**截图：桌面 share listing / 桌面 sign / mobile sign / mobile invite 各一张，before/after 对比，贴在对应 PR description

---

## 延后的（这一轮不做）

- 整站 i18n — 需要 product 决策（目前是 en-US hardcoded）
- share/packs 页面和 share/listings 页面的 component 复用 — 现在它们是 80% 相似的两个文件，一起重构风险大
- mobile navigation for /office — public 页面做完再看
