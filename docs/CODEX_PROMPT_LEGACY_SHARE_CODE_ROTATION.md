# Codex Prompt F — 弱 share code 定向轮换（60 天兼容窗口）+ 签名 document 过期校验补漏

> **背景**：
>
> - `8e00c9b` 已经把**新生成**的 share code 升到 192 bit。但**已经发出去的老链接仍然活着**——其中 Listing Studio 的 `StudioListingPack.shareCode` 还有 **3 条**弱码（`<= 15` 字符 base64url，约 ≤ 48 bit），全部最近 30 天还在被打开。Front-office `ListingShareLink` 那边是 0 条，不需要处理。
> - 同一个审计里还有一条 ⚠️ 漏了：`getPublicSignatureDocumentStorageRecord` 不校验过期。这条很小，捎在一起。
>
> **决策（John 已拍板）**：
> - 选项 (b)：**带兼容窗口的定向轮换**。立即给这 3 条 pack 生成新强 code 作为正式 `shareCode`；老 code 移到 `legacyShareCode` 列，60 天内仍然可读，期满后自然失效。
> - 不发邮件 / 不动其他 pack；老 owner 由 John 操作侧通知。
>
> **范围**：
> - `packages/db/prisma/schema.prisma`、`packages/db/src/studio-listings.ts`、`packages/db/src/transaction-documents/readers.ts`
> - `apps/web/app/share/packs/[code]/page.tsx`
> - 一份新 Prisma migration
> - 对应测试
>
> **不在范围**：
> - 不动 Front-office `ListingShareLink`（已是 0 条弱码）
> - 不动 ListingStudio detail UI 的 owner-facing 通知（Owner 由 John 离线通知）
> - 不发任何邮件/Slack/通知，share link 是匿名的，我们也不知道谁有老链接
> - 不撤销新 9c5b1da/8e00c9b 那一系列限流和熵升级（继续保持）

---

## Task 1 — 补漏：Signature document 路径加过期校验（**先做，独立 commit**）

### 现状

`packages/db/src/transaction-documents/readers.ts:1373-1397`：

```ts
export async function getPublicSignatureDocumentStorageRecord(token: string) {
  const access = await getPublicSignatureRequestRecord(token);
  const request = access?.request ?? null;

  if (!request?.document) {
    return null;
  }

  return { …不校验过期就直接返回 };
}
```

snapshot 路径在 `readers.ts:192-210` 已经有过期判断（`expiredAt` 或 `expiresAt <= now`），document 路径没有。

### 改成

在 `if (!request?.document) return null;` 后面、`return { … }` 前面，**加 4 行**：

```ts
if (
  request.expiredAt ||
  (request.expiresAt && request.expiresAt.getTime() <= Date.now())
) {
  return null;
}
```

### 测试

在 `packages/db/src/transaction-documents/readers.test.ts`（如果不存在则建）加一个用例：
- Setup：建一个 SignatureRequest，`expiresAt` 设成过去
- Action：调用 `getPublicSignatureDocumentStorageRecord(token)`
- Assert：返回 `null`

如果已经有 snapshot 路径过期的测试，照那个测试写就好。

### Commit

`fix(signatures): enforce expiry check on public document downloads`

---

## Task 2 — Schema：加两个列到 `StudioListingPack`（**第二个 commit**）

### 改 `packages/db/prisma/schema.prisma`

在 `StudioListingPack` 里加：

```prisma
model StudioListingPack {
  // …existing fields…
  shareCode               String?   @unique
  shareEnabled            Boolean   @default(false)

  // 新增：兼容窗口期间被替换出去的老弱 code
  legacyShareCode         String?   @unique
  legacyShareCodeExpiresAt DateTime?

  // …existing fields…
}
```

### 生成 migration

```bash
cd packages/db
npx prisma migrate dev --name add_studio_listing_pack_legacy_share_code --create-only
```

打开生成的 SQL，确认它只 `ADD COLUMN` 两列 + `CREATE UNIQUE INDEX` 一个，**没有任何 DROP**。如果 Prisma 试图重建表或动其他列，停下来 grep 找原因。

### 在同一个 migration 文件末尾追加 data migration SQL

不另开 script，直接写进 migration：

```sql
-- Rotate weak Studio listing pack share codes into legacy column with 60-day grace period.
-- Sanity gate: this is expected to touch a small handful of rows (audit identified 3
-- as of 2026-04-19). Abort if we see substantially more — something else is wrong.
DO $$
DECLARE
  weak_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO weak_count
  FROM "StudioListingPack"
  WHERE "shareCode" IS NOT NULL
    AND LENGTH("shareCode") <= 15;

  IF weak_count > 25 THEN
    RAISE EXCEPTION 'Refusing to rotate % weak share codes; expected <= 25. Investigate before re-running.', weak_count;
  END IF;
END $$;

-- Move weak codes to legacy column; mint a new strong code in shareCode.
-- New code format matches createStudioListingPackShareCode() in studio-listings.ts:
--   pack_ + base64url(24 random bytes) = pack_ + 32 chars
UPDATE "StudioListingPack"
SET
  "legacyShareCode"          = "shareCode",
  "legacyShareCodeExpiresAt" = NOW() + INTERVAL '60 days',
  "shareCode"                = 'pack_' || translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_')
WHERE
  "shareCode" IS NOT NULL
  AND LENGTH("shareCode") <= 15;
```

注意：
- `gen_random_bytes` 来自 `pgcrypto`。先 grep 一下当前 schema 有没有 `extension pgcrypto`；如果没有，在 migration 前面加 `CREATE EXTENSION IF NOT EXISTS pgcrypto;`。
- `translate` 把标准 base64 的 `+/=` 转成 base64url 的 `-_`（去掉 `=`）。结果长度 = `ceil(24*4/3) = 32` 字符（去掉 padding 之后 32）。
- DO `RAISE EXCEPTION` 会让整条 migration 回滚。production 上跑 `migrate deploy` 时数量异常会**直接失败**，不会写一半。

### Commit

`feat(db): add legacyShareCode for studio listing pack rotation window`

**这一步只动 schema + 数据迁移，不动 read path。这是为了让 PR 可以分块 review。**

---

## Task 3 — Read path 兼容老 code（**第三个 commit**）

### 改 `packages/db/src/studio-listings.ts`

定位现有的公开读取函数 `getStudioListingPublicPack`（约 `studio-listings.ts:2828-2834`，spec 之前给过位置）。

当前应该是：

```ts
const pack = await prisma.studioListingPack.findFirst({
  where: { shareCode: input.shareCode, shareEnabled: true },
  …
});
```

改成两步查找：

```ts
let pack = await prisma.studioListingPack.findFirst({
  where: { shareCode: input.shareCode, shareEnabled: true },
  …
});

let usesLegacyShareCode = false;
let legacyShareCodeExpiresAt: Date | null = null;

if (!pack) {
  const legacyMatch = await prisma.studioListingPack.findFirst({
    where: {
      legacyShareCode: input.shareCode,
      shareEnabled: true,
      legacyShareCodeExpiresAt: { gt: new Date() },
    },
    …
  });

  if (legacyMatch) {
    pack = legacyMatch;
    usesLegacyShareCode = true;
    legacyShareCodeExpiresAt = legacyMatch.legacyShareCodeExpiresAt;
  }
}

if (!pack) return null;

return {
  …existing fields,
  usesLegacyShareCode,
  legacyShareCodeExpiresAt,
};
```

返回类型也要相应扩字段（`usesLegacyShareCode: boolean`、`legacyShareCodeExpiresAt: Date | null`），让上层模板能消费。

### 改 `apps/web/app/share/packs/[code]/page.tsx`

当 `snapshot.usesLegacyShareCode === true` 时，在页面顶部渲染一条简洁横幅：

```tsx
{snapshot.usesLegacyShareCode && snapshot.legacyShareCodeExpiresAt ? (
  <div className="public-share-legacy-notice" role="status">
    <p>
      This link will be retired on{" "}
      <strong>{formatDate(snapshot.legacyShareCodeExpiresAt)}</strong>.
      Please ask the sender for an updated link.
    </p>
  </div>
) : null}
```

CSS 加到 globals.css 的 share 区块附近：浅黄底 + 1px 边 + 12px padding + 不要 modal、不要 motion。**不要把新 URL 显示在公开页**——recipient 不需要知道新 URL，应该让 sender 主动重发。

### 测试

1. `packages/db/src/studio-listings.test.ts` 加：
   - **legacy code 命中**：建一个 pack，设 `shareCode = "newstrongcode"`、`legacyShareCode = "oldweak"`、`legacyShareCodeExpiresAt = now + 30d`。用 `oldweak` 查 → 应返回 pack 且 `usesLegacyShareCode === true`。
   - **legacy code 过期**：同上但 `legacyShareCodeExpiresAt = now - 1d`。查 → 应返回 `null`。
   - **shareCode 优先于 legacy**：同时设两个都指向 pack，用新 code 查 → `usesLegacyShareCode === false`。
2. 公开页面的 banner 渲染（如果当前已有 share-pack 页面的渲染测试就扩展，没有的话 skip——不强求引入新 test infra）。

### Commit

`feat(studio): support legacy share codes during rotation window`

---

## 跑命令（你本机验证）

```bash
# typecheck
cd apps/web && npx tsc --noEmit
cd ../../packages/db && npx tsc --noEmit

# 单测（如果本机 tsx 能跑起来）
npx tsx --test packages/db/src/studio-listings.test.ts
npx tsx --test packages/db/src/transaction-documents/readers.test.ts

# 不要本机连 prod DB 跑 migrate；只本地验证 migration SQL 语法：
cd packages/db && npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script | head -100
```

**不要**在你本机跑 `prisma migrate deploy`——这个会真的连数据库。生产部署是 John 那边的步骤。

---

## 部署后验证（部署时让 John 跑，不在 Codex 范围内）

```bash
# 1. 部署前先快照 DB（DigitalOcean 控制台一键）

# 2. 部署
npm run deploy:digitalocean -- <commit_sha>

# 3. 验证 migration 跑过了，正好 3 条被轮换
ssh root@45.55.247.137 'cd /opt/acre-ui-rebuild/app && DATABASE_URL=... npx prisma db execute --stdin <<<"
  SELECT id, shareCode, legacyShareCode, legacyShareCodeExpiresAt
  FROM \"StudioListingPack\"
  WHERE \"legacyShareCode\" IS NOT NULL;
"'
# 期望：3 行；shareCode 长度 = 37（pack_ + 32），legacyShareCode 长度 <= 15

# 4. 拿其中一条的 legacyShareCode（老链接）和 shareCode（新链接），分别 curl
curl -sI https://acresystem.us/share/packs/<legacy_code>  # 期望 200，HTML 里有 "will be retired"
curl -sI https://acresystem.us/share/packs/<new_strong_code>  # 期望 200，无 banner

# 5. 把新强 URL 通知给 3 条 pack 的 owner（Slack/邮件，操作侧）
```

---

## 禁止项

- ❌ 不要在 migration 里引 `pgcrypto` 而不先 `CREATE EXTENSION IF NOT EXISTS`
- ❌ 不要把 data migration 拆成单独 script（一定要在 Prisma migration 文件里，这样 `migrate deploy` 一条命令搞定，不会出现"schema 升了但数据没轮换"的中间态）
- ❌ 不要顺手清理"老的 weak code"——保留它们在 `legacyShareCode` 列，60 天后再决定是否做清理 migration（那是另一件事）
- ❌ 不要在公开 share 页面**显示新 URL**（recipient 不应该绕过 sender 拿到新链接）
- ❌ 不要碰 `apps/web/app/listing-studio/listings/[packId]/listing-studio-detail-client.tsx`（2616 行的怪兽）——owner-facing 通知 John 离线做
- ❌ 不要改 `shareEnabled` 的语义（继续作为"是否启用 share"的开关，和 legacy 列正交）
- ❌ 不要在 `getStudioListingPublicPack` 之外的内部读路径里加 legacy fallback——只有公开匿名读取需要兼容
- ❌ 不要扩大 sanity gate 阈值（25 是上限；如果你看到要轮换更多，**不要硬上**，先回报 John）

---

## 交付清单

- [ ] Commit 1: `fix(signatures): enforce expiry check on public document downloads` —— Task 1
- [ ] Commit 2: `feat(db): add legacyShareCode for studio listing pack rotation window` —— Task 2 (schema + migration with data migration SQL)
- [ ] Commit 3: `feat(studio): support legacy share codes during rotation window` —— Task 3 (read path + page banner + tests)
- [ ] `cd apps/web && npx tsc --noEmit` 通过
- [ ] `cd packages/db && npx tsc --noEmit` 通过
- [ ] Migration SQL 在 DO block 里 `RAISE EXCEPTION` 阈值是 25（不是 3——给点 headroom）
- [ ] 公开页面 banner 不显示新 URL，只说"ask sender"
- [ ] PR description 里贴出 migration SQL 完整内容（review 的关键点）

---

## 60 天后的 follow-up（不在本轮）

- 跑一条清理 SQL 把所有 `legacyShareCodeExpiresAt < now()` 的行的 `legacyShareCode` 设成 `NULL`（让索引保持稀疏）
- 或者下下轮再决定要不要 drop 这两个列（drop 列要再开一个 migration）

把这条记到 John 的 calendar：**2026-06-18 检查 legacyShareCode 状态**。
