# 分享/签名/邀请 token 熵审计 — 2026-04-19

审计范围：

- `apps/web`
- `packages/db`
- `packages/auth`

搜索结果摘要：

- `apps/web/app/share`, `apps/web/app/sign`, `apps/web/app/api/public` 下的公开 URL token/code 入口已逐一核查。
- 额外发现并纳入审计的公开 token 入口：
  - Front Office listing share code：`/share/listings/[code]`
  - Listing Studio extension challenge token：`/listing-studio/extension/connect/[challengeToken]` 及其轮询 API
- `packages/auth` 仅包含权限定义与判定逻辑，没有额外的 URL token/code 生成或验证实现。

## 1. Listing Studio share code（`/share/packs/[code]`，以及资源读取 `shareCode`）

- **生成位置**：`packages/db/src/studio-listings.ts:2749-2752`
- **首次写入位置**：`packages/db/src/studio-listings.ts:2754-2761`
- **生成函数**：`` `pack_${randomBytes(6).toString("base64url").toLowerCase()}` ``
- **熵**：`<= 48 bit ❌`
  - 原始 RNG 只有 `6 bytes = 48 bit`。
  - 后续 `.toLowerCase()` 会进一步压缩可见输出空间，实际可区分空间比 48 bit 更低。
  - 代码里没有发现其他 `shareCode` 写入路径；现有 `existing.shareCode` 也是由这条路径首次生成后被长期复用。
- **编码**：`base64url + 固定前缀 ✓`，但 `.toLowerCase()` 会进一步降低输出空间。
- **验证位置**：
  - 页面：`apps/web/app/share/packs/[code]/page.tsx:19-20`
  - DB 查找：`packages/db/src/studio-listings.ts:2828-2834`
  - 资源读取：`apps/web/app/api/listing-studio/assets/[assetId]/route.ts:14-37`
  - 资源查找：`packages/db/src/studio-listings.ts:2895-2903`
- **速率限制**：`no ❌`
  - `/share/packs/[code]` 页面没有 `consumeRateLimit(...)`
  - `/api/listing-studio/assets/[assetId]?shareCode=...` 也没有 `consumeRateLimit(...)`
- **过期**：`no ❌`
  - `StudioListingPack` 只有 `shareEnabled` 和 `shareCode`，没有 `expiresAt` / `revokedAt` 字段：`packages/db/prisma/schema.prisma:1455-1456`
  - 当前语义是“启用分享后永久有效，直到人工关闭/替换”
- **枚举防御**：`弱 ❌`
  - 无效 code 返回 `404`
  - 有效 code 直接返回完整公开 listing pack / asset
  - 因为 code 熵不足且没有限流，在线枚举不是纯理论问题
- **结论**：❌ 不合格
- **建议动作**：
  - 新发 code 至少改为 `randomBytes(16)`，更稳妥是 `randomBytes(24)`
  - 不要继续复用历史弱 code；需要显式轮换策略
  - 给 pack 页面和 asset 读取都加 `token+IP` 维度的限流
  - 增加过期或显式撤销能力

## 2. Signature public token（`/sign/[token]`）

- **生成位置**：`apps/web/lib/signature-token.ts:7-12`
- **实际调用位置**：
  - 首次发送：`apps/web/app/api/office/transactions/[transactionId]/signatures/[signatureRequestId]/route.ts:169-171, 234-249, 271-293`
  - 多签下一步重新发 token：`apps/web/app/api/public/signatures/[token]/submit/route.ts:248-279`
- **生成函数**：`randomBytes(32).toString("base64url")`
- **熵**：`256 bit ✓`
- **编码**：`base64url ✓`
- **验证位置**：
  - 页面：`apps/web/app/sign/[token]/page.tsx:12-16`
  - Snapshot API：`apps/web/app/api/public/signatures/[token]/route.ts:10-18`
  - Document API：`apps/web/app/api/public/signatures/[token]/document/route.ts:14-20`
  - Submit API：`apps/web/app/api/public/signatures/[token]/submit/route.ts:123-145`
  - DB lookup：`packages/db/src/transaction-documents/readers.ts:1101-1268`
- **速率限制**：`partial ⚠️`
  - `POST /api/public/signatures/[token]/submit` 有限流：`15 次 / 10 分钟`
  - 配置位置：`apps/web/app/api/public/signatures/[token]/submit/route.ts:26-29, 408-415`
  - key 形态：`scope + client identifier(IP) + hash(token)`，即 `token+IP`
    - `apps/web/app/api/public/signatures/[token]/submit/route.ts:86-91`
    - `apps/web/lib/rate-limit.ts:590-599`
  - 但读取入口 `/sign/[token]`、`GET /api/public/signatures/[token]`、`GET /api/public/signatures/[token]/document` 都没有限流
- **过期**：`partial ⚠️`
  - `SignatureRequest` 有 `expiresAt` / `expiredAt`：`packages/db/prisma/schema.prisma:2280-2294`
  - Snapshot 路径会主动判定过期并回写状态：
    - `packages/db/src/transaction-documents/readers.ts:192-210`
    - `packages/db/src/transaction-documents/readers.ts:1312-1345`
  - 但 document 路径 `getPublicSignatureDocumentStorageRecord(token)` 只校验 token hash，不校验过期：
    - `packages/db/src/transaction-documents/readers.ts:1373-1397`
- **枚举防御**：`partial ⚠️`
  - 无效 token：页面/API 返回 `404`
  - 有效但终态 token：会公开区分 `completed / canceled / expired / declined / acted / pending`
    - `apps/web/app/sign/[token]/public-signature-client.tsx:51-88`
    - `apps/web/app/api/public/signatures/[token]/submit/route.ts:141-150`
- **结论**：⚠️ 有风险
- **建议动作**：
  - 给公开读取入口也加 `token+IP` 限流
  - 明确 document 路径是否应在 `expiresAt` 后继续可读；若不允许，应在读取时复用 snapshot 的过期判断
  - 如果希望更强的匿名枚举防御，统一无效/终态的对外提示

## 3. Invitation accept token（`/invite/[token]`）

- **生成位置**：`packages/db/src/auth.ts:281-286`
- **持久化位置**：`packages/db/src/auth.ts:531-549`
- **生成函数**：`randomBytes(32).toString("base64url")`
- **熵**：`256 bit ✓`
- **编码**：`base64url ✓`
- **验证位置**：
  - 页面：`apps/web/app/invite/[token]/page.tsx:29-31`
  - Snapshot lookup：`packages/db/src/auth.ts:884-959`
  - Accept flow：`packages/db/src/auth.ts:963-1004`
  - POST 入口：`apps/web/app/api/auth/invitations/accept/route.ts:78-99`
- **速率限制**：`partial ⚠️`
  - `POST /api/auth/invitations/accept` 有限流：`10 次 / 15 分钟`
  - 配置位置：`apps/web/app/api/auth/invitations/accept/route.ts:16-19, 133-140`
  - key 形态：`scope + client identifier(IP) + hash(token)`，即 `token+IP`
    - `apps/web/app/api/auth/invitations/accept/route.ts:32-37`
    - `apps/web/lib/rate-limit.ts:590-599`
  - 但 `GET /invite/[token]` 页面本身没有限流
- **过期**：`yes ✓`
  - schema 有 `expiresAt` / `acceptedAt` / `revokedAt`：`packages/db/prisma/schema.prisma:1139-1147`
  - 默认有效期 7 天：`packages/db/src/auth.ts:293-295`
  - 读取时检查：`packages/db/src/auth.ts:937-944`
  - 接受时在事务里再次检查：`packages/db/src/auth.ts:999-1004`
- **枚举防御**：`弱 ⚠️`
  - 页面明确区分：
    - `accepted`：`This invitation has already been used.`
    - `revoked`：`This invitation has been revoked by an administrator.`
    - `expired`：`This invitation has expired.`
    - `not_found`：`This invitation link is invalid.`
    - 位置：`apps/web/app/invite/[token]/page.tsx:91-97`
- **结论**：⚠️ 有风险
- **建议动作**：
  - 给 `GET /invite/[token]` 加读取限流
  - 如果希望更强的匿名枚举防御，把 `accepted / revoked / expired / invalid` 收敛成统一外部提示

## 4. Front-office contract token（公开入口未发现）

- **生成位置**：`packages/db/src/front-office-contracts.ts:368-379`
- **生成函数**：`randomUUID()`
- **熵**：`122 bit ⚠️`
  - UUIDv4 不是 128 bit；严格按“至少 128 bit”标准，它是**低于**阈值的
- **编码**：`UUID 字符串 ✓`
- **验证位置**：
  - 内部 claim/commit/release 校验：`packages/db/src/front-office-contracts.ts:320-379, 704-737, 805-896, 924-940`
  - 当前只看到**已登录内部 API** 使用：
    - `apps/web/app/api/office/transactions/route.ts:317-336, 470-491, 528-537`
- **速率限制**：`n/a`
  - 当前没有匿名公开入口；这是内部 optimistic-concurrency claim token
- **过期**：`yes ✓`
  - TTL 10 分钟：`packages/db/src/front-office-contracts.ts:131, 375-378`
- **枚举防御**：`n/a`
  - 没找到 `/api/public` 或匿名页面对它做公开验证
- **结论**：✅ 当前公开面可接受，但仅因为它**不是公开 URL token**
- **建议动作**：
  - 如果将来要把它暴露到匿名 URL 或公开 API，必须先换成 `randomBytes(16+)`
  - 当前阶段可保留为内部并发 claim token

## 5. Front Office listing share code（`/share/listings/[code]`）

- **生成位置**：`packages/db/src/front-office-listing-output.ts:209-210`
- **持久化位置**：`packages/db/src/front-office-listing-output.ts:1512-1527`
- **生成函数**：`randomBytes(9).toString("base64url")`
- **熵**：`72 bit ❌`
- **编码**：`base64url ✓`
- **验证位置**：
  - 页面：`apps/web/app/share/listings/[code]/page.tsx:15-16`
  - DB 查找：`packages/db/src/front-office-listing-output.ts:1639-1678`
- **速率限制**：`no ❌`
  - 页面和 DB lookup 都没有 `consumeRateLimit(...)`
- **过期**：`no ❌`
  - `ListingShareLink` schema 只有 `code` / `createdAt` / `clickCount`，没有 `expiresAt` / `revokedAt`
  - 位置：`packages/db/prisma/schema.prisma:1297-1308`
- **枚举防御**：`弱 ❌`
  - 无效 code 返回 `404`
  - 有效 code 返回完整公开 listing snapshot
  - 在 72 bit 且无限流的前提下，这不满足本次“至少 128 bit + rate limit + expiry”要求
- **结论**：❌ 不合格
- **建议动作**：
  - 新发 code 至少升到 `randomBytes(16)`；更稳妥可统一到 `24 bytes`
  - 引入过期/撤销语义
  - 给公开读取入口加 `token+IP` 限流

## 6. Listing Studio extension challenge token（额外公开入口）

- **生成位置**：`packages/db/src/studio-listings.ts:301-302, 1140-1155`
- **生成函数**：`createOpaqueToken("ls_chal")` → `${prefix}_${randomBytes(24).toString("base64url")}`
- **熵**：`192 bit ✓`
- **编码**：`base64url + 前缀 ✓`
- **验证位置**：
  - 审批页 URL：`apps/web/app/listing-studio/extension/connect/[challengeToken]/page.tsx:12-13`
  - 批准 API：`apps/web/app/api/listing-studio/extension/connect/approve/route.ts:25-44`
  - 轮询 API：`apps/web/app/api/listing-studio/extension/connect/status/route.ts:6-17`
  - DB 校验：`packages/db/src/studio-listings.ts:1158-1200, 1202-1283`
- **速率限制**：`no ⚠️`
  - `status` 和 `approve` 路径都没有 `consumeRateLimit(...)`
- **过期**：`yes ✓`
  - challenge 有 15 分钟 TTL：`packages/db/src/studio-listings.ts:1143`
  - 并且有 `consumedAt`：`packages/db/prisma/schema.prisma:1547-1565`
- **枚举防御**：`弱 ⚠️`
  - `status` 会公开区分 `not_found / pending / expired / consumed / approved`
  - `approved` 时还会返回 `extensionToken`
  - 由于 challenge token 本身是 192 bit 且短 TTL，这里的主要问题是缺少读取限流，不是熵不足
- **结论**：⚠️ 有风险
- **建议动作**：
  - 给 `status` 轮询和 `approve` 都补 `token+IP` 限流
  - 评估是否需要把 `not_found / expired / consumed` 收敛成更统一的匿名响应

---

## 汇总

| 对象 | 熵 | 速率限制 | 过期 | 总结 |
| --- | --- | --- | --- | --- |
| Listing Studio share code (`/share/packs/[code]`) | ❌ `<=48 bit`，且 lowercasing 进一步缩水 | ❌ 无 | ❌ 无 | ❌ |
| Front Office listing share code (`/share/listings/[code]`) | ❌ `72 bit` | ❌ 无 | ❌ 无 | ❌ |
| Signature public token (`/sign/[token]`) | ✅ `256 bit` | ⚠️ 仅 submit 有，读取入口无 | ⚠️ snapshot 有，document 路径无 | ⚠️ |
| Invitation accept token (`/invite/[token]`) | ✅ `256 bit` | ⚠️ 仅 accept POST 有，GET 页面无 | ✅ `expiresAt/acceptedAt/revokedAt` | ⚠️ |
| Front-office contract token | ⚠️ `122 bit UUIDv4` | n/a（当前内部） | ✅ 10 分钟 | ✅ 当前公开面可接受 |
| Listing Studio extension challenge token | ✅ `192 bit` | ⚠️ 无 | ✅ 15 分钟 + consumed | ⚠️ |

## 需要立即修的风险

- `packages/db/src/studio-listings.ts:2749-2752`
  - Listing Studio public pack share code 只有 `6 bytes`，并且 `.toLowerCase()` 会继续缩小输出空间；同时缺少限流和过期。
- `packages/db/src/front-office-listing-output.ts:209-210`
  - Front Office public listing share code 只有 `9 bytes = 72 bit`，低于本次要求的 `128 bit`；同时缺少限流和过期。

本轮没有直接提交修复 diff，原因是这两项一旦真正修复，会牵涉：

- 是否轮换**现有**已发出的公开链接
- 是否兼容历史短 code
- 是否允许老链接继续访问，还是强制失效

这属于会影响现网公开 URL 的行为决策，不适合在审计轮里静默改掉。

## 建议补强（非紧急）

- 统一建立一个“公开 token/code”基线：
  - 生成统一用 `randomBytes(16+)`
  - 编码统一用 `base64url`
  - 读取/提交统一按 `token+IP` 限流
  - DB 模型统一有 `expiresAt`，必要时加 `revokedAt` / `consumedAt`
- 对匿名 GET 页面和 GET API 明确一个策略：
  - 是继续允许查看“已过期/已使用”状态
  - 还是统一返回同一种匿名错误
- 对历史弱 share code 做一次 inventory：
  - 列出当前活跃 `ListingShareLink.code`
  - 列出当前活跃 `StudioListingPack.shareCode`
  - 决定是原地保留、带兼容窗口轮换，还是强制重发公开链接
