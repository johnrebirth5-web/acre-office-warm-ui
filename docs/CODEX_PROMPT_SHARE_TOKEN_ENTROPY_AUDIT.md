# Codex Prompt — 分享 / 签名 / 邀请 token 熵审计

> 目的：系统里所有"公开可访问、靠 URL 里的 token/code 做认证"的入口，都必须用 cryptographically random token，并且 token 不短于 128 bit 熵，并且被速率限制 + 有过期策略。
>
> 这次**不需要修 bug**——先**审计**，只有发现明确弱点再修。产出一份审计报告作为主交付。
>
> 范围：`apps/web`、`packages/db`、`packages/auth`。
>
> 时长：预计 30~60 分钟（纯读代码 + 写 markdown）。

---

## 审计对象（必须全部覆盖）

以下 token/code 的**生成位置** + **被验证位置** + **速率限制** + **过期策略**都要查清楚：

1. **Listing Studio share code** — `/share/listings/[code]`, `/share/packs/[code]`
   - 生成：`packages/db/src/studio-listings.ts:2749` 附近（`shareCode = existing.shareCode && existing.shareCode.trim() ? existing.shareCode : ...`）—— 这一条**最可疑**，因为它走的是 fallback 逻辑，需要看清 `...` 到底是什么
   - 验证：`apps/web/app/api/listing-studio/listings/[packId]/share/route.ts`、`apps/web/app/api/listing-studio/assets/[assetId]/route.ts`（`shareCode` query param）

2. **Signature public token** — `/sign/[token]`
   - 生成：`apps/web/lib/signature-token.ts:8`（`randomBytes(32).toString("base64url")` —— 一眼看去是 256 bit，OK，确认没有别的生成路径）
   - 验证：`apps/web/app/api/public/signatures/[token]/submit/route.ts`、`apps/web/app/api/public/signatures/[token]/route.ts` 等

3. **Invitation accept token** — `/invite/[token]`
   - 生成：`packages/db/src/auth.ts:282`（`randomBytes(32).toString("base64url")`—— 看起来 OK）
   - 验证：`apps/web/app/api/auth/invitations/accept/route.ts`

4. **Front-office contract token** — 如果有对应公开入口
   - 生成：`packages/db/src/front-office-contracts.ts:378`（`randomUUID()` —— UUIDv4 是 122 bit，**刚过 128 bit 阈值的线**，需要确认使用场景的风险）
   - 验证：grep `/api/public` 下面有没有用到

5. **其他公开入口**（自己 grep 找，不限于上面列表）
   - 搜索：`apps/web/app/share/`, `apps/web/app/sign/`, `apps/web/app/api/public/` 下的所有路由
   - 搜索：`apps/web/app/api/*/[token]/route.ts` 和 `apps/web/app/api/*/[code]/route.ts`
   - 对每一个都要问："这个 token/code 是怎么生成的？从哪里验证的？"

---

## 对每个对象，审计以下 5 个点

### ① 熵（entropy）

- 生成函数是不是 `node:crypto` 的 `randomBytes(N)` 或 `randomUUID()`？
- 如果是 `randomBytes`，N 是多少？（建议 ≥ 16 bytes → 128 bit）
- 如果是 `randomUUID()`（v4），熵是 122 bit，**临界合格但可以说明理由接受**
- 如果是 `Math.random()` / `Date.now()` / `crypto.randomInt(0, 9999)` / base36 短 token / 自增 ID → ❌ **FAIL**
- 如果是 `existing.shareCode && existing.shareCode.trim() ? existing.shareCode : <???>`（Studio listing 那条），重点跟踪 `???` 里到底是什么，以及"existing code"是何时被第一次写入的

### ② 编码形式

- `base64url` / `hex` / `base32` 都可以
- `base64` 普通版（带 `+` `/` `=`）在 URL 里危险，**需要报**
- 纯数字短 code 就算是 32 位整数也只有 32 bit 熵，**需要报**

### ③ 速率限制

- 验证入口有没有走 `consumeRateLimit(...)`？
- window 和 limit 是多少？（我们当前约定：公开 token 验证 limit ≤ 15 次 / 10 分钟 / token）
- key 是按 `token` 还是按 `IP` 还是按 `token+IP`？（仅 IP 容易被多个攻击者用各自 IP 并行绕过）

### ④ 过期

- token 有没有过期时间？（DB 字段 `expiresAt`、`consumedAt`、`revokedAt` 等）
- 验证路径有没有在读取时主动 check 过期？

### ⑤ 枚举 vs 篡改

- 即使 token 熵够，响应里泄露了多少信息？（一个无效 token 和一个 "token 有效但已消费" 应该返回完全一样的错误——任何区分都可能被用来枚举）

---

## 交付物

### 主交付：`docs/SHARE_TOKEN_ENTROPY_AUDIT_2026_04_19.md`

按下面格式写（每个审计对象一节）：

```markdown
# 分享/签名/邀请 token 熵审计 — 2026-04-19

## 1. Listing Studio share code（`/share/listings/[code]`, `/share/packs/[code]`）

- **生成位置**：`packages/db/src/studio-listings.ts:<行号>`
- **生成函数**：`<例如 randomBytes(32).toString("base64url")>`
- **熵**：`<例如 256 bit ✓ / 32 bit ❌>`
- **编码**：`<base64url ✓>`
- **验证位置**：`<file:line>`
- **速率限制**：`<yes/no, 如果有写 consumer key + limit + window>`
- **过期**：`<yes/no, 哪个字段>`
- **枚举防御**：`<yes/no, 简述>`
- **结论**：✅ 合格 / ⚠️ 有风险 / ❌ 不合格
- **建议动作**：`<一两句>`

## 2. ... (每个对象一节)

---

## 汇总

| 对象 | 熵 | 速率限制 | 过期 | 总结 |
| --- | --- | --- | --- | --- |
| Listing Studio share code | ✓ 256 bit | ✓ | ✗ 永不过期 | ⚠️ |
| Signature public token | ✓ 256 bit | ✓ 10 min / 15 次 | ✓ expiresAt | ✅ |
| Invitation accept token | ✓ 256 bit | ✓ | ✓ expiresAt | ✅ |
| Contract token | ⚠ 122 bit UUIDv4 | ? | ? | ⚠️ |

## 需要立即修的风险（如有）

- `<具体行为和代码 diff>`

## 建议补强（非紧急）

- `<...>`
```

### 次交付（仅在发现 ❌ 或 ⚠️ 需立即修时）

如果发现了明确可利用的漏洞（熵不足 / 无速率限制 / 无过期），**单独开一个 commit** 修复它。提交 message 格式：`<area>: <fix summary>`。

- 如果没有任何 ❌ 或 ⚠️ 紧急项，**不要做代码修改**，只交报告即可。
- 如果有多个 ⚠️，每个独立 commit，不要挤在一个 PR 里。

---

## 禁止项

- ❌ 不要改 schema（任何 migration 都超出本轮范围）
- ❌ 不要引入新依赖
- ❌ 不要"顺手重构"（比如看到 `randomUUID` 就想改成 `randomBytes`，先写进报告让 John 决策）
- ❌ 不要跳过"枚举防御"这一点，它是最容易被忽略的

---

## 提示：加快审计的搜索起点

```bash
# 生成路径的候选
grep -rn "randomBytes\|randomUUID\|nanoid\|shortid\|generateCode" apps packages --include='*.ts'

# 验证路径的候选
find apps/web/app/api/public apps/web/app/share apps/web/app/sign -name 'route.ts'

# 速率限制是否覆盖
grep -rn "consumeRateLimit\|buildRateLimitKey" apps/web/app/api/public apps/web/app/api/auth apps/web/app/api/listing-studio/listings/\[packId\]/share --include='*.ts'

# 过期字段的候选
grep -rn "expiresAt\|consumedAt\|revokedAt\|usedAt" packages/db --include='*.ts'
```
