# Listing Studio Spec

## Purpose

`Listing Studio` 是 Acre 的第三个 workspace，面向 agent 处理“外部房源采集 -> 客户材料整理 -> 分享 / PDF / 海报模板导出”的链路。

它不是现有 FO curated listing，也不是 BO internal listing admin。它的真源来自 `StreetEasy / Zillow` 等外部房源详情页，以及 Chrome Extension 在页面内发起的一键保存动作。

## Scope

### Included in v1

- 独立 workspace：
  - `/listing-studio/dashboard`
  - `/listing-studio/listings`
  - `/listing-studio/listings/[packId]`
- Chrome Extension `apps/extension`
- 支持站点：
  - `StreetEasy`
  - `Zillow`
- 房源页右下角浮层 `Save to Acre`
- 扩展 challenge + token 连接流程
- 原始页面快照保存：
  - raw HTML
  - raw parsed JSON
  - canonical fields
  - downloaded assets
- 客户版 pack 编辑：
  - contact name
  - contact title
  - contact phone
  - contact email
  - headline
  - summary
  - bullet points
  - selected assets
  - cover asset
  - agent note
  - packet distribution summary for share / PDF / poster review
  - manual marketing kit sections for caption / blurb / follow-up copy
  - copy-ready campaign bundles built from the same marketing kit
  - campaign delivery plan with send-ready packages, manual sequence, and readiness checklist
  - delete saved packet
- 客户分享页：
  - `/share/packs/[code]`
- PDF 导出：
  - `/api/listing-studio/listings/[packId]/pdf`
- 海报 / 模板导出：
  - `/api/listing-studio/listings/[packId]/poster`
  - editorial / open-house / social-square / factsheet 模板切换
  - preview / print / downloadable HTML export
  - agent info block + scan-ready packet path in the generated poster
  - copy-ready marketing kit variants derived from the same saved packet and poster draft
  - reusable campaign bundles such as social / listing / follow-up copy packs
  - a delivery-plan layer that organizes those bundles into send-ready package sets, a manual sequence, and readiness checks

### Explicitly not included in v1

- collections
- share management center
- Canva sync / PNG render pipeline
- batch import
- scheduled re-crawl
- background queue / worker
- browser-cookie-based extension auth
- unsupported-site generic scraping

## Current manual contract notes

- campaign bundles and delivery-plan package sets remain derived from the same saved packet and current poster draft
- the delivery-plan layer is still manual and review-first; it does not imply Canva sync, PNG render, scheduled campaigns, or auto-send

## Core user flow

1. agent 打开 `StreetEasy` 或 `Zillow` 房源详情页
2. extension content script 识别当前页面属于支持站点
3. 页面右下角显示 Acre 浮层卡片
4. 浮层展示当前房源的标题、地址、价格、facts 和缩略图
5. agent 点击 `Save to Acre`
6. extension 直接在当前页面采集：
   - source URL
   - raw HTML
   - canonical fields
   - image urls
   - floor plan / transit / amenities 等结构化信息
   - source facts：
     - rooms
     - availability
     - common charges / HOA / taxes
     - price per foot
     - lease term
     - listed by / broker / property type
   - additional detail sections：
     - policies
     - property details
     - building details
     - property history / listing history
7. background worker 使用 Acre extension token 调用 `/api/listing-studio/imports`
8. 服务端同步创建 import、snapshot、assets、pack
9. 浮层进入 success 状态，显示 `Saved to Listing Studio` 和 `Open in Acre`
10. agent 回到 `/listing-studio/listings` 时，可立即看到新的 listing card

## Workspace structure

### Dashboard

- extension connected 状态
- connect Chrome extension 按钮
- install Chrome extension 入口
- 最近导入 listing
- ready-to-share 数量
- public share views
- 返回最近导入 packet 的快捷入口

### Listings

- card grid
- 搜索
- source site 筛选
- listing type 筛选
- imported-at 时间排序

### Listing detail

- hero image
- gallery
- price / address / facts
- source facts
- amenities
- transit
- property history
- additional captured sections
- floor plans
- source attribution
- client-copy edit panel
- share action
- PDF export action
- poster preview / export action
- delete listing action

## Data model

- `StudioListingImport`
  - 记录一次扩展保存动作和导入状态
- `StudioListingSnapshot`
  - 原始事实层，只读
  - 保存归一化后的标题、价格、地址、户型、描述、amenities、transit、floor plans、property history 等
- `StudioListingAsset`
  - 下载后的图片 / floor plan / map 资产
- `StudioListingPack`
  - 客户版整理层，可编辑
  - 保存 headline、summary、bullet points、selected assets、share settings、agent contact
- `StudioListingShareEvent`
  - public share 的打开事件
- `StudioListingExtensionToken`
  - 扩展长期 token
- `StudioListingExtensionChallenge`
  - 一次性连接挑战

## Auth model

### Web session

用于：

- 打开 `Listing Studio` 页面
- 编辑 pack
- 发布 share
- 下载 PDF
- 批准 extension challenge

### Extension token

用于：

- 扩展 background worker 直接调用导入 API
- 可选查询导入状态

连接流程：

1. 如果当前浏览器尚未检测到扩展，dashboard 会先引导用户进入 `/listing-studio/extension/install`
2. 安装页会直接显示正式 `Add to Chrome`，并允许用 `NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL` 覆盖到别的商店条目
3. 当前浏览器检测到扩展后，用户可从 dashboard 点击 `Connect Chrome extension`
4. dashboard 通过扩展 bridge 把当前 Acre base URL 发给扩展
5. 扩展请求 `/api/listing-studio/extension/connect/start`
6. 服务端生成 challenge token
7. 扩展打开已登录 Acre 的批准页并自动批准 challenge
8. dashboard 轮询扩展状态，扩展拿到长期 token 后完成绑定

## Permissions

- `listing_studio:view`
  - 允许进入 Listing Studio 页面和读取 pack/detail
- `listing_studio:create`
  - 允许批准扩展连接并接收导入
- `listing_studio:edit`
  - 允许编辑 pack
- `listing_studio:share`
  - 允许发布 share 和导出 PDF

## API surface

- `POST /api/listing-studio/extension/connect/start`
- `GET /api/listing-studio/extension/connect/status`
- `POST /api/listing-studio/extension/connect/approve`
- `POST /api/listing-studio/imports`
- `GET /api/listing-studio/imports/[importId]`
- `GET /api/listing-studio/listings`
- `GET /api/listing-studio/listings/[packId]`
- `PATCH /api/listing-studio/listings/[packId]`
- `DELETE /api/listing-studio/listings/[packId]`
- `POST /api/listing-studio/listings/[packId]/share`
- `GET /api/listing-studio/listings/[packId]/pdf`
- `GET /api/listing-studio/listings/[packId]/poster`
- `GET /api/listing-studio/assets/[assetId]`

## Storage rules

- raw files 与下载后的 assets 使用现有 document storage adapter
- 当前 scope：
  - `organization/listing-studio/import-{id}/raw`
  - `organization/listing-studio/import-{id}/assets`
- 原始 snapshot 与客户版 pack 必须分层保存
- 不允许直接修改 snapshot 来实现客户版编辑
- 删除 saved packet 时，需要同时清理：
  - `StudioListingImport -> Snapshot -> Pack -> Asset -> ShareEvent` 关联记录
  - raw source files
  - downloaded assets
  - generated PDF cache

## UI contract

- 视觉语言跟随 Acre BO / FO，而不是另起品牌
- `Listing Studio` 是独立 workspace，但仍复用 Acre shell、button、card、stat、input 体系
- 详情页可以比 BO 更图片驱动，但 spacing、radius、标题层级和交互反馈保持 Acre 一致
- public share 页和 PDF 可以更偏展示，但不能和后台彻底脱节
- poster output should keep the agent contact block and scan path readable in preview, print, and downloaded HTML, not only inside the editor shell
- the saved packet contact block should act as the shared manual source for share, PDF, and poster outputs instead of drifting per export surface
- marketing-kit copy should stay manual and review-first, using the saved packet plus current poster draft as its source instead of pretending there is an external campaign service
- campaign bundles should remain derivations of the same local marketing kit; they are copy helpers, not background campaign orchestration or auto-send

## Known limitations

- 只有 `StreetEasy / Zillow` adapter
- 导入是同步 route-handler 处理，暂时没有后台 job queue
- PDF 每次按当前 pack 实时生成
- 海报模板当前是手动 HTML 预览 / 打印 / 下载导出，并带本地生成的 scan-ready code；它还不是服务端 PNG 渲染或 Canva 工作流
- 联系人信息现在可在 packet editor 里直接修改，并会流入 share / PDF / poster，但它仍然是手动维护的 packet 字段，不是独立 CRM 同步或外部模板同步
- 如果 packet share 尚未发布，scan path 会回退到原始 source listing，而不是假装始终存在 Acre public packet
- public asset 访问当前通过 `shareCode` 参数做分享态校验，还不是签名 URL 模式
- dashboard 还不能静默安装未发布的 Chrome 扩展；真正的 `Add to Chrome` 依赖 Chrome Web Store 发布，当前正式条目已作为默认安装入口内置，`NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL` 仅用于覆盖
