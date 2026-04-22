# Codex Prompt — Phase 0.5: Listing Studio image gallery quick fixes

> 目的：消除用户切换房源图片时的"顿挫感"。只做 3 个小改动，不动 Prisma schema、不动上传流程、不引入新依赖、不改 UI 布局。
>
> 前提：当前 `/api/listing-studio/assets/{assetId}` 返回的就是原图，没有缩略图版本，改这个是 Phase 1.5 的事，这次**不做**。本次只优化已有资源的加载体验。
>
> 验收：`pnpm -w typecheck` / `npm run typecheck` 通过；本地开一个房源详情页，切换缩略图时大图**没有明显白屏或延迟**。

---

## 改动文件（就这两个）

1. `apps/web/app/listing-studio/listings/[packId]/listing-studio-detail-client.tsx`
2. `apps/web/app/api/listing-studio/assets/[assetId]/route.ts`

---

## 任务 0.5.1 — 图片预加载（最大收益项）

**文件：** `apps/web/app/listing-studio/listings/[packId]/listing-studio-detail-client.tsx`

**现状：** `handleSelectPhoto`（约第 1498 行）和 `handleCyclePhoto`（约第 1503 行）只做 state 切换，浏览器在点击那一刻才开始下载新图。

**改成：**

### 1. 新增一个模块级辅助函数（不放在组件内部，避免每次 render 重建）

在文件顶部的 import 之后，组件定义之前，加：

```ts
const preloadedAssetIds = new Set<string>();

function preloadAssetImage(assetId: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (preloadedAssetIds.has(assetId)) {
    return;
  }

  preloadedAssetIds.add(assetId);

  const image = new window.Image();

  image.decoding = "async";
  image.src = `/api/listing-studio/assets/${assetId}`;
}
```

### 2. 修改 `handleSelectPhoto`

当前：
```ts
function handleSelectPhoto(assetId: string) {
  setMediaMode("photo");
  setActivePhotoId(assetId);
}
```

改成：
```ts
function handleSelectPhoto(assetId: string) {
  setMediaMode("photo");
  setActivePhotoId(assetId);

  const index = photoAssets.findIndex((asset) => asset.id === assetId);
  if (index !== -1 && photoAssets.length > 1) {
    const nextAsset = photoAssets[(index + 1) % photoAssets.length];
    const prevAsset =
      photoAssets[(index - 1 + photoAssets.length) % photoAssets.length];
    if (nextAsset) {
      preloadAssetImage(nextAsset.id);
    }
    if (prevAsset && prevAsset.id !== nextAsset?.id) {
      preloadAssetImage(prevAsset.id);
    }
  }
}
```

### 3. 新增一个 `useEffect` 做首屏预热

在组件内其他 `useEffect` 附近加：

```ts
useEffect(() => {
  if (!activePhoto || photoAssets.length < 2) {
    return;
  }

  const index = photoAssets.findIndex((asset) => asset.id === activePhoto.id);
  if (index === -1) {
    return;
  }

  const nextAsset = photoAssets[(index + 1) % photoAssets.length];
  const prevAsset =
    photoAssets[(index - 1 + photoAssets.length) % photoAssets.length];

  if (nextAsset) {
    preloadAssetImage(nextAsset.id);
  }
  if (prevAsset && prevAsset.id !== nextAsset?.id) {
    preloadAssetImage(prevAsset.id);
  }
}, [activePhoto?.id, photoAssets]);
```

**效果：** 用户看到当前图时，下一张和上一张已经在浏览器 HTTP cache 里了。点下一张几乎是瞬时。

**约束：**
- 只做 next + prev 两张，不要全量预加载（16 张图一次性下载反而会堵网络）
- `preloadedAssetIds` 这个 Set 是跨组件实例的去重缓存，避免多次挂载/重渲染时重复请求

---

## 任务 0.5.2 — `<img>` 标签加解码/懒加载属性

**文件：** 同上。

### 大图（约第 1848 行）

当前：
```tsx
<img
  alt={activePhoto.label ?? detailState.title}
  className="listing-studio-view-stage-image"
  src={`/api/listing-studio/assets/${activePhoto.id}`}
/>
```

改成：
```tsx
<img
  alt={activePhoto.label ?? detailState.title}
  className="listing-studio-view-stage-image"
  decoding="async"
  fetchPriority="high"
  src={`/api/listing-studio/assets/${activePhoto.id}`}
/>
```

### 缩略图（约第 1876 行，在 `.listing-studio-view-thumbnail-row` 的 map 里）

当前：
```tsx
<img
  alt={asset.label ?? detailState.title}
  src={`/api/listing-studio/assets/${asset.id}`}
/>
```

改成：
```tsx
<img
  alt={asset.label ?? detailState.title}
  decoding="async"
  loading="lazy"
  src={`/api/listing-studio/assets/${asset.id}`}
/>
```

**注意：** React 19 里 `fetchPriority` 是驼峰命名，不要写成 `fetchpriority`。如果 TypeScript 报错，在该 `<img>` 上先 `{...({ fetchPriority: "high" } as { fetchPriority: "high" })}`，或者直接用 `<img suppressHydrationWarning ...>` 加内联的 React 类型兜底——优先选前者。

---

## 任务 0.5.3 — 延长资源缓存 TTL

**文件：** `apps/web/app/api/listing-studio/assets/[assetId]/route.ts`（约第 49 行）

**现状：**
```ts
"Cache-Control": shareCode ? "public, max-age=300" : "private, max-age=120",
```

**分析：** `assetId` 是 Prisma 行主键，一旦记录创建，`storageKey` 和文件内容就不会变（Acre 的上传流程是"新增记录"不是"覆盖"，如果有覆盖逻辑请先确认再改）。所以同一个 `assetId` 对应的字节流是**不可变**的，可以安全地长期缓存。

**改成：**
```ts
"Cache-Control": shareCode
  ? "public, max-age=86400, stale-while-revalidate=86400"
  : "private, max-age=604800, immutable",
```

- 登录用户的私有缓存：1 周 + `immutable`，让浏览器不再重复请求
- 公共分享链接：1 天 + stale-while-revalidate，比原来的 300 秒长 288 倍，但仍然给分享权限撤销留了每日刷新窗口

**前置确认（提示词执行前必须检查）：**

在修改这个文件前，Codex **先** grep 整个仓库确认：
- `storageKey` 字段在资源创建之后**不会被 update**（只在 create 时赋值）
- 如果存在"重新上传覆盖同一个 asset"的代码路径，把 Cache-Control 里的 `immutable` 去掉，只保留 `max-age=604800`

搜索命令：
```
grep -rn 'storageKey' apps packages --include='*.ts' --include='*.tsx' | grep -iE 'update|upsert|set'
```

如果找到 update 路径，告诉我，不要强行加 `immutable`。

---

## 交付清单

- [ ] `preloadAssetImage` 模块级函数 + `preloadedAssetIds` Set 已加
- [ ] `handleSelectPhoto` 会触发 next/prev 预加载
- [ ] 首屏 `useEffect` 会预热 next/prev
- [ ] 大图 `<img>` 加了 `decoding="async"` + `fetchPriority="high"`
- [ ] 缩略图 `<img>` 加了 `decoding="async"` + `loading="lazy"`
- [ ] `/api/listing-studio/assets/[assetId]/route.ts` 的 `Cache-Control` 已延长
- [ ] 已 grep 确认 `storageKey` 不会被 update；或者报告发现了 update 路径，去掉 `immutable`
- [ ] `typecheck` 通过
- [ ] 本地 `next dev` 启动后，打开任一房源详情页，DevTools Network 面板里：
  - 首次加载时，当前大图 + next/prev 缩略图会自动请求
  - 点击 next 缩略图时，大图 URL 显示 `(disk cache)` 或 `(memory cache)`

## 禁止项

- 不要换 `<img>` 为 `next/image`（这是 Phase 1.5 的事，需要配 loader / domain / responsive breakpoint，改动范围大）
- 不要生成缩略图版本或改 schema
- 不要改 `readStoredFile` 的流式/非流式行为
- 不要动认证、权限、shareCode 逻辑
- 不要全量预加载 16 张图（带宽浪费）
- 不要把 Cache-Control 改成 `public, immutable` 给登录用户（会泄露到代理缓存里）

## 回滚策略

三条改动彼此独立，可以分别回滚：
- 预加载出问题 → 删掉 `preloadAssetImage` 调用即可，不影响主流程
- `img` 属性出问题 → 移除新增属性即可
- 缓存 header 出问题 → 只改回 route.ts 那一行，不影响前端

所以哪怕其中一条上线后有问题，不需要整体回滚，单独 revert 对应 commit 即可。建议 Codex **做成三个独立 commit**，不要挤在一个 PR 里。
