# Listing Studio Extension Publish Guide

## Goal

把 `Acre Listing Studio` 扩展发布到 `Chrome Web Store`，让 `Listing Studio dashboard` 上的安装入口最终可以变成真正的 `Add to Chrome`。

## Current reality

当前仓库已经支持两条安装路径：

- 开发环境：
  - `chrome://extensions`
  - `Load unpacked`
  - 选择 `apps/extension/dist`
- 未来商店环境：
  - dashboard 安装页读取 `NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL`
  - 若已配置 Chrome Web Store 链接，安装页会显示 `Add to Chrome`

当前还没有真实的 Chrome Web Store 链接，所以 dashboard 里的安装页仍然是说明页，而不是商店直装页。

## Package for Chrome Web Store

从仓库根目录运行：

```bash
npm run package --workspace=@acre/extension
```

结果：

- 先重新生成 `apps/extension/dist`
- 再输出发布 zip：
  - `apps/extension/release/acre-listing-studio-extension-v<version>.zip`

这个 zip 可直接用于 Chrome Web Store 上传。

## Manifest expectations

当前 manifest 已为商店发布做了最小化处理：

- `manifest_version: 3`
- 权限：
  - `storage`
  - `tabs`
- host permissions 仅保留：
  - `StreetEasy`
  - `Zillow`
  - `https://acresystem.us/*`
  - 本地开发 `localhost:3105` / `127.0.0.1:3105`

注意：

- 不要再把 `http://*/*` 或 `https://*/*` 这种过宽权限加回去，Chrome Web Store 审核会更敏感。

## Chrome Web Store setup checklist

### 1. Developer account

- 使用 Acre 的正式 Google 账号开通 `Chrome Web Store Developer Dashboard`

### 2. Upload

- 上传 `apps/extension/release/*.zip`

### 3. Store listing

需要准备：

- extension name
- short description
- long description
- category
- support email
- screenshots
- promo tile / marquee assets（如果需要）

建议直接使用：

- [docs/specs/listing-studio-extension-store-listing.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/listing-studio-extension-store-listing.md)

### 4. Privacy section

需要明确填写：

- 是否收集个人信息
- 是否出售或共享数据
- 数据用途
- 单独的隐私政策 URL（建议正式提供）

当前仓库已提供公开隐私页：

- `https://acresystem.us/legal/listing-studio-extension-privacy`
- 本地开发：
  - `http://localhost:3105/legal/listing-studio-extension-privacy`

### 5. Distribution

建议先用：

- `Unlisted`

这样可以先测试真实商店安装链路，但不会公开搜索曝光。

## Acre dashboard link setup

商店链接到手后，在运行环境里配置：

```env
NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL="https://chromewebstore.google.com/detail/<extension-id>"
```

配置完成后：

- `/listing-studio/extension/install`
- `dashboard` 未安装扩展时的安装入口

都会自动切到真实 `Add to Chrome` 链接。

并且：

- `dashboard` 未安装状态下点击主按钮会直接打开 Chrome Web Store
- Acre 会记住当前 tab 正在等待安装
- 用户安装完成后回到原来的 `Listing Studio dashboard` 标签页，页面会自动刷新并继续浏览器连接流程

## Recommended rollout order

1. 打包发布 zip
2. 先在 Chrome Web Store 建 `Unlisted` 版本
3. 拿到正式商店链接
4. 配置 `NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL`
5. 验证 Acre dashboard -> install page -> Chrome Web Store -> Add to Chrome -> dashboard connect 全链路
6. 确认无误后再决定是否改成 `Public`
