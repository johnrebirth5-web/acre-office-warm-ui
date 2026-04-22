# 验收行动清单 — 2026-04-19

> 配套报告：`docs/SITE_ACCEPTANCE_REPORT_2026_04_19.md`
> 这份是"只看 TODO"版，方便你逐项打勾或贴给 Codex。

---

## P0 — 本周内（阻塞 Phase 0 上线 / 高紧迫）

- [ ] **P0-1**：按 `docs/RUNBOOK_DEPLOY_PHASE_0_AND_0_5.md` 执行 Phase 0 + 0.5 部署（步骤 1～5）
- [ ] **P0-2**：在 droplet 上 `grep ACRE_RATE_LIMIT_BACKEND /etc/acre/acre-ui-rebuild.env`，确认是否 `upstash`。如果不是，先别水平扩容
- [ ] **P0-3**：跑 `bash scripts/ops/verify-branch-protection.sh --repo johnrebirth5-web/acre-office-warm-ui --branch main`，全 PASS 才能放心继续直推 main
- [ ] **P0-4**：确认 `acresystem.us` 前面是否挂了 CDN/LB —— Phase 0 之后 `/api/health` 会在 db 慢的时候返回 503，LB 健康检查策略要兼容

---

## P1 — 2 周内（HIGH 安全/可靠性）

### P1-1 改密后 session 轮换
**文件**：`apps/web/app/api/auth/change-password/route.ts`

在 `await changeInternalPassword(...)` 成功之后、`return NextResponse.redirect(...)` 之前，做：
1. 调用 session 创建函数（参考 `apps/web/app/api/auth/login/route.ts` 里登录成功后写 cookie 的方式），重新生成 session token
2. 在 response 上 set 新 cookie
3. 把当前 session ID 在 DB 里标记 `revokedAt = now()`（如果 schema 有这个字段；否则插一个新 session 行并刷新 cookie 即可）

验收：改密后用旧 cookie 请求 `/api/office/dashboard`，应返回 401。

### P1-2 文件上传统一 size 上限
**3 处需要加上**：
- `apps/web/app/api/listing-studio/listings/[packId]/assets/route.ts`
- `apps/web/app/api/office/transactions/[transactionId]/documents/route.ts`
- `apps/web/app/api/office/mail/_helpers.ts`（mail 附件保存路径）

每处加：
```ts
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB
const tooLarge = files.find((file) => file.size > MAX_UPLOAD_BYTES);
if (tooLarge) {
  return NextResponse.json(
    { error: `File too large: ${tooLarge.name} (${tooLarge.size} bytes)` },
    { status: 413 },
  );
}
```

验收：用 `dd if=/dev/zero of=big.bin bs=1M count=50` 造一个 50MB 文件 upload，应当 413。

### P1-3 listing-studio MIME 短路 bug
**文件**：`apps/web/app/api/listing-studio/listings/[packId]/assets/route.ts:38-51`

当前：
```ts
const invalidFile = files.find(
  (file) =>
    file.type &&
    !file.type.startsWith("image/") &&
    !file.type.startsWith("video/"),
);
```
`file.type` 为空串时短路，相当于通过校验。改成：
```ts
const invalidFile = files.find(
  (file) =>
    !file.type ||
    (!file.type.startsWith("image/") && !file.type.startsWith("video/")),
);
```

验收：上传一个 `Content-Type: ""` 的请求，应当 400。

### P1-4 Sentry beforeSend 脱敏
**文件**：`apps/web/sentry.shared.ts`

在 `getSentryInitOptions()` 返回的对象里加：
```ts
sendDefaultPii: false,
beforeSend(event) {
  if (event.request?.cookies) event.request.cookies = undefined;
  if (event.request?.headers) {
    delete event.request.headers["cookie"];
    delete event.request.headers["authorization"];
    delete event.request.headers["x-metrics-token"];
  }
  return event;
},
```

验收：本地造一个 throw，确认 Sentry event 里没有 cookie / authorization 字样。

---

## P2 — 1 个月内（性能 / 可维护性 MEDIUM）

### P2-1 Phase 1.1 落地：Prisma 连接池调优
**前置**：Phase 0 部署后跑 1～3 天，收集：
- `/api/health` 返回的 `db.pool_max`（DigitalOcean managed PG 默认 100）
- `/api/health` 返回的 `db.pool_in_use` 在峰值时的最大值
- journalctl 里 `slow_query` 最常见的 SQL

然后在 `/etc/acre/acre-ui-rebuild.env` 设：
```
PRISMA_CONNECTION_LIMIT=<约 pool_in_use 峰值的 1.5 倍，且 < 0.5*pool_max>
PRISMA_POOL_TIMEOUT=10
```
重启 service 验证 `/api/health` 没有出现 503。

### P2-2 消除 `getMembershipEffectivePermissions` 的 N+1
**文件**：`packages/db/src/settings.ts:2148-2158`

把：
```ts
await Promise.all(
  membershipOfficeScope.accessibleOffices.map(async (office) => {
    const eff = await getMembershipEffectivePermissions({...});
    ...
  }),
);
```
重构成一次性查所有 office 的 effective permissions（`findMany({ where: { officeId: { in: officeIds } } })`），然后在 JS 里 group by。

### P2-3 消除 `roster-profile` 按 goal 的 N+1
**文件**：`packages/db/src/agents/roster-profile.ts:845-866`

类似 P2-2：一次拉所有 transaction，按 dateRange in-memory 分桶到对应 goal。

### P2-4 密码重置流程（产品决策）
**仓库现状**：login 页没有"忘记密码"链接，UI 文案明确"no reset flow"

可选实现路径（任选其一）：
1. **管理员重置**：`/office/settings/users/[membershipId]/reset-password` 让管理员触发，邮件发一次性链接
2. **自助重置**：login 页加链接 → 输入邮箱 → 邮件发一次性 token → 跳改密页

实现需要：邮件模板 + 一次性 token 表 + token 速率限制。

---

## P3 — 规划期（产品 / 大动作）

- [ ] **P3-1**：Listing Studio 缩略图管线（Phase 1.5）—— 上传时 sharp 生成 256/1024 变体
- [ ] **P3-2**：拆分 `apps/web/app/listing-studio/listings/[packId]/listing-studio-detail-client.tsx`（2557 行）
- [ ] **P3-3**：MFA / 2FA（产品决策）
- [ ] **P3-4**：线上支付执行（Stripe / ACH，目前 UI 已明示 "not implemented"）
- [ ] **P3-5**：分享 token 熵审计 —— 验证 `/share/listings/[code]`、`/sign/[token]`、`/share/packs/[code]` 的 token 是否 cryptographically random，是否够长（建议 ≥ 22 base64 chars / 128 bit）

---

## 配套数据需要你回贴

执行完 P0-1 后，把下列 4 个数据贴给我，我下一轮就能给 P2-1 的具体 `PRISMA_CONNECTION_LIMIT` 值：

1. `/api/health` JSON 的 `db.pool_max`
2. `/api/health` JSON 的 `db.pool_in_use`（开 5 分钟看峰值）
3. `journalctl -u acre-ui-rebuild-web.service --since "1 hour ago" | grep slow_query | head -10`
4. 浏览器主观感受：图片切换是否瞬时（Phase 0.5 的 UX 验收）

