# Listing Studio Spec

## Purpose

`Listing Studio` 是 Acre `Front Office` 下的 listings-output 模块，面向 agent 处理“外部房源采集 -> 客户材料整理 -> 分享 / PDF / 海报模板导出”的链路。

当前列表卡片的展示原则：

- 避免把同一条地址在标题和地址位重复渲染
- 优先分层展示 `building / address / city-state-zip`
- 当源页面没有直接给出面积、但已有 `price / ft` 时，允许回推出 `sqft` 作为展示回退

它不是现有 FO curated listing，也不是 BO internal listing admin。它的真源来自 `StreetEasy / Zillow` 等外部房源详情页，以及 Chrome Extension 在页面内发起的一键保存动作。

## Scope

### Included in v1

- `Front Office` 内的 studio 路由入口：
  - `/listing-studio`
  - `/listing-studio/dashboard`
  - `/listing-studio/listings`
  - `/listing-studio/collections`
  - `/listing-studio/collections/[collectionId]`
  - `/listing-studio/shares`
  - `/listing-studio/listings/[packId]`
  - `/listing-studio/listings/[packId]/share`
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
  - copyable template briefs for editorial / open-house / social-square / factsheet selection
  - reusable manual campaign flights for launch / event / evergreen cadence planning
  - delete saved packet
- 客户分享页：
  - `/share/packs/[code]`
  - `/share/collections/[code]`
  - collection share page uses the mobile client-facing microsite pattern; tapping a property opens the internal detail view with gallery, facts, amenities, and agent contact instead of leaving for the source listing site
  - collection share page includes a bottom map section that plots saved listings with numbered pins when coordinates are available
  - collection share email actions copy the agent email in-page instead of relying on `mailto:` handlers; the public page does not show a `Schedule a Viewing` CTA
  - collection share listing cards and detail badges do not show source-site labels such as StreetEasy
- collection share tracking:
  - copying a collection share link records a `shared` event
  - opening `/share/collections/[code]` records an `opened` event
  - `/listing-studio/shares` lists current-user collection share counts and public view counts
- PDF 导出：
  - `/api/listing-studio/listings/[packId]/pdf`
- 海报 / 模板导出：
  - `/listing-studio/listings/[packId]/share`
  - `/api/listing-studio/listings/[packId]/poster`
  - `hero / editorial / card / cinematic / grid` 五套竖版 poster 模板切换
  - right-rail `Listing status` controls：`JUST LISTED / IN CONTRACT / PRICE REDUCED / OPEN HOUSE / SOLD`
  - main-photo selection tied to the current saved pack asset set
  - preview / print / downloadable `SVG / HTML / PNG` export，其中 PNG 为 `2160 x 2880`
  - generated poster carries the current logged-in agent contact block（avatar / company / phone / email）and does not inject Acre / Listed / source-site branding or QR blocks into the poster artwork itself

### Explicitly not included in v1

- full recipient management, resend workflow, and outbound delivery automation
- Canva sync
- batch import
- scheduled re-crawl
- background queue / worker
- browser-cookie-based extension auth
- unsupported-site generic scraping

## Current manual contract notes

- campaign bundles and delivery-plan package sets remain derived from the same saved packet and current poster draft
- template briefs and campaign flights remain derived from the same saved packet and current poster draft
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
10. agent 回到 `Front Office -> Studio` 列表时，可立即看到新的 listing card（当前兼容路径仍为 `/listing-studio/listings`）

## Module structure

### Dashboard

- 公司公盘卡片流
- 只展示 `companyFeedVisible = true` 的 pack
- 所有 agent 都能看到管理员发布的房源
- 每张 card 支持 `+ Add to my listings`
- 已经收录到当前个人 workspace 的房源，卡片需要显示完成态
- 只有具备 `listing_studio:company_manage` 的管理员可以在这里做发布 / 下架管理动作

### Listings

- extension connected 状态
- connect Chrome extension 按钮
- install Chrome extension 入口
- Studio overview
- card grid
- 搜索
- source site 筛选
- listing type 筛选
- 当前 membership 自己的 saved packs
  - 自己导入的 pack
  - 从 company dashboard 收录的 pack
- imported-at / saved-at 时间排序
- 每张 card 支持直接加入 / 移出 collections
- 从 `company dashboard` 收录的 pack 支持从个人 `My listings` workspace 移出，且不会删除共享 company pack 本体
- 自己导入的 pack 仍支持完整删除，并级联清理相关 collection memberships
- 具备 `listing_studio:company_manage` 的管理员可在这里把个人 pack 发布到 company dashboard

### Collections

- 当前用户私有的 folder / collection 列表
- 支持新建 collection，自定义命名
- collection list card 展示：
  - name
  - listing count
  - updated-at
  - preview listings
- collection list / detail 都支持删除入口，并在删除前给出确认
- collection detail 支持 `Share` 按钮生成公开 collection 链接；弹框只提供取消和复制，复制后用于粘贴到浏览器查看房源信息
- collection detail 展示：
  - saved listings card grid
  - `Add listings` 多选管理器
  - numbered Google map markers
  - nearby POI filters：
    - `Supermarket`
    - `Subway`
    - `Restaurant`
    - `Coffee`
    - `Nightlife`
    - `All`
    - 默认不预选任何 POI 类目；用户点击后才显示附近点位，并可用 `Clear` 回到无筛选状态
- 当前 collection 地图和 POI 使用运行时 Google Maps / Places 查询，不做 Acre 内部 POI 持久化

### Shares

- 当前先作为 collection share activity list
- 展示当前 membership 的 shared collections
- 每行展示：
  - collection name
  - listing count
  - link status
  - share count（复制 / 生成 collection share link 次数）
  - view count（公开 collection 页面打开次数）
  - last shared / last viewed
- 不记录收件人身份，不做自动发送，不做 resend workflow

### Listing detail

- hero image
- gallery
- price / address / facts
- monthly payment calculator with editable home price, down payment, term, and rate inputs, rolling up mortgage payment + HOA/common charges + taxes into one estimate when those source facts are available
- quick-jump row for the main working zones
- curated-page editor as the primary editing surface
- compact publish / export rail for save, share, PDF, poster, and scan actions
- source facts
- amenities
- transit
- property history
- additional captured sections
- floor plans
- source attribution
- poster studio with inline preview
- marketing workspace with disclosure-based secondary sections
- lower-priority source and marketing detail should stay collapsible by default so future modules can be added without turning the page back into one uninterrupted card stack
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
  - 额外保存 company dashboard 发布状态：
    - `companyFeedVisible`
    - `companyFeedPublishedAt`
    - `companyFeedPublishedByMembershipId`
- `StudioListingSavedPack`
  - 当前 membership 的个人 saved join layer
  - 用于承接“自己导入的 pack”和“从 company dashboard 收录的 pack”
  - `source` 区分：
    - `imported_by_me`
    - `saved_from_dashboard`
- `StudioListingCollection`
  - 当前用户私有 collection
  - 保存 collection 名称、当前 organization / office scope、创建人与最后更新时间
  - 保存最小公开分享状态：
    - `shareEnabled`
    - `shareCode`
- `StudioListingCollectionItem`
  - collection 与 saved pack 的 join layer
  - 对同一 `collectionId + packId` 做唯一约束
- `StudioListingCollectionShareEvent`
  - collection share 的事件表
  - `shared`：agent 复制 / 生成 collection share link
  - `opened`：公开 `/share/collections/[code]` 被打开
- `StudioListingShareEvent`
  - pack public share 的打开事件
- `StudioListingExtensionToken`
  - 扩展长期 token
- `StudioListingExtensionChallenge`
  - 一次性连接挑战

## Auth model

### Web session

用于：

- 打开 `Front Office` 内的 `Listing Studio` 页面
- 编辑 pack
- 发布 share
- 下载 PDF
- 批准 extension challenge

### Extension token

用于：

- 扩展 background worker 直接调用导入 API
- 可选查询导入状态

连接流程：

1. 如果当前 listings tab 尚未与扩展 bridge 成功握手，listings 会先引导用户进入 `/listing-studio/extension/install` / Chrome Web Store 设置入口
2. 安装页会直接显示正式 `Add to Chrome`，并允许用 `NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL` 覆盖到别的商店条目
3. 当前浏览器检测到扩展后，用户可从 listings 点击 `Connect Chrome extension`
4. listings 通过扩展 bridge 把当前 Acre base URL 发给扩展
5. 扩展请求 `/api/listing-studio/extension/connect/start`
6. 服务端生成 challenge token
7. 扩展打开已登录 Acre 的批准页并自动批准 challenge
8. listings 轮询扩展状态，扩展拿到长期 token 后完成绑定

## Permissions

- `listing_studio:view`
  - 允许进入 Listing Studio 页面和读取 pack/detail
- `listing_studio:create`
  - 允许批准扩展连接并接收导入
- `listing_studio:edit`
  - 允许编辑 pack
  - 也允许创建 / 更新 / 删除 collections 以及管理 collection items
- `listing_studio:share`
  - 允许发布 share 和导出 PDF
- `listing_studio:company_manage`
  - 允许把 pack 发布到 company dashboard 或从 dashboard 下架
  - 默认只授予 `owner / office_admin`

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
- `POST /api/listing-studio/listings/[packId]/save`
- `GET /api/listing-studio/collections`
- `POST /api/listing-studio/collections`
- `GET /api/listing-studio/collections/[collectionId]`
- `PATCH /api/listing-studio/collections/[collectionId]`
- `DELETE /api/listing-studio/collections/[collectionId]`
- `POST /api/listing-studio/collections/[collectionId]/items`
- `DELETE /api/listing-studio/collections/[collectionId]/items/[packId]`
- `POST /api/listing-studio/collections/[collectionId]/share`
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
- `Listing Studio` 不再作为第三个独立 workspace 暴露给用户，而是挂在 `Front Office` shell 与侧边导航内
- `Front Office` 侧边栏中的 `Studio` 现在是可展开父级导航，当前包含：
  - `Dashboard`
  - `Listings`
  - `Collections`
  - `Shares`
- 详情页可以比 BO 更图片驱动，但 spacing、radius、标题层级和交互反馈保持 Acre 一致
- 详情页默认分成 `main working column + compact action rail`，不要再把所有编辑、输出、原始抓取信息都堆成同一级长滚动页
- 原始抓取细节、营销扩展块、长文案派生块应优先用 disclosure / collapsible 方式收纳，默认先展示高频动作和最关键摘要
- public share 页和 PDF 可以更偏展示，但不能和后台彻底脱节
- poster output should keep the current agent contact block readable in preview, print, and downloaded HTML, not only inside the editor shell
- the saved packet contact block still acts as the editable fallback source for share / PDF / poster, but poster export should prefer the current logged-in agent snapshot when it is available
- marketing-kit copy should stay manual and review-first, using the saved packet plus current poster draft as its source instead of pretending there is an external campaign service
- campaign bundles should remain derivations of the same local marketing kit; they are copy helpers, not background campaign orchestration or auto-send

## Known limitations

- 只有 `StreetEasy / Zillow` adapter
- 导入是同步 route-handler 处理，暂时没有后台 job queue
- PDF 每次按当前 pack 实时生成
- `Collections` 目前只支持当前用户私有视图，不做组织共享或办公室共享
- `Shares` 目前只聚合 collection share / view counts；还不是 recipient-level delivery or resend center
- `Collections` 地图、POI、以及 public collection share 地图依赖 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`；缺失时地图区域会降级为提示文案，房源卡片仍正常显示
- 海报模板当前是手动 HTML 预览 / 打印 / 下载导出，并由服务端 `svg -> png` 输出 `2160 x 2880` PNG；它还不是 Canva 工作流
- 联系人信息现在可在 packet editor 里直接修改，并会流入 share / PDF / poster，但它仍然是手动维护的 packet 字段，不是独立 CRM 同步或外部模板同步
- live-share page 仍需 pack publish / `shareCode`，但它现在是 studio 里的独立动作，不再作为 poster artwork 的二维码依赖
- public asset 访问当前通过 `shareCode` 参数做分享态校验，还不是签名 URL 模式
- listings 还不能静默安装未发布的 Chrome 扩展；真正的 `Add to Chrome` 依赖 Chrome Web Store 发布，当前正式条目已作为默认安装入口内置，`NEXT_PUBLIC_LISTING_STUDIO_EXTENSION_STORE_URL` 仅用于覆盖
