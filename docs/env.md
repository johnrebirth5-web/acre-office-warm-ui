# Environment Variables

## 概览

当前项目实际用到的环境变量非常少。

真实代码状态：

- 当前数据库相关代码使用 `DATABASE_URL`
- 当前主页面和大多数 API 仍不依赖数据库，因此在“只跑前端和 mock API”时，即使没有真实数据库，也能运行
- 但 `Office Pipeline workspace`、`Office Transactions`、`Office Contacts`、`Office Tasks`、`Office Accounting`、transaction finance、密码登录 / 邀请接受 / 用户管理、`/office/activity` 和数据库 probe 已经依赖 `DATABASE_URL`
- transaction detail 下的 checklist/tasks 也已经依赖 `DATABASE_URL`
- `Office Reports` 的 CSV 导出 route 也依赖 `DATABASE_URL`
- `/api/office/activity/comments` 也依赖 `DATABASE_URL`
- transaction detail 下的 documents / forms / signatures / incoming updates 也已经依赖 `DATABASE_URL`
- 一旦执行 Prisma 相关命令，或访问这些数据库路径，`DATABASE_URL` 就变成必需项
- 当前本地 auth/session 可以使用默认开发 secret，但建议显式配置 `ACRE_SESSION_SECRET`

未来随着 auth、storage、AI、第三方集成接入，这个文件需要同步扩展。

## 当前环境变量清单

### `DATABASE_URL`

用途：

- 提供 PostgreSQL 连接串
- 当前用于 Prisma schema 校验
- 当前用于 Prisma Client、migration、seed 和数据库 probe 读取
- 当前也用于 `TransactionContact` 关系迁移和回填
- 后续会用于更多页面和 API 的真实数据库读写

是否必填：

- 对 Prisma 命令是必填
- 对数据库 probe route 是必填
- 对只看 mock 页面本地运行是“可不填”
- 对 `/office/pipeline`、`/office/transactions`、`/office/contacts`、`/office/activity`、`/login`、`/invite/[token]`、`/change-password`、`/office/settings/users`、数据库 probe 是必填
- 对 `/office/tasks` 也是必填
- 对 `/office/accounting` 也是必填
- 对 transaction detail 下的 checklist/tasks 读写也是必填
- 对 `/api/office/reports/export` 也是必填
- 对 transaction detail 下的 finance 读写也是必填
- 对 `/api/office/activity/comments` 也是必填
- 对 `/api/office/accounting/transactions*` 和 `/api/office/accounting/earnest-money*` 也是必填
- 对 `/api/office/transactions/:transactionId/documents*` / `forms*` / `signatures*` / `incoming-updates*` 也是必填

示例格式：

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/acre"
```

Docker 本地开发补充：

- 当前仓库根目录的 `docker-compose.yml` 会把容器内 `DATABASE_URL` 覆盖为 `postgresql://postgres:postgres@db:5432/acre`
- 当前仓库默认把 Docker `db` 发布到宿主机 `127.0.0.1:5433`，避免和本机 Homebrew/Postgres 常见的 `5432` 冲突
- 这意味着宿主机 `.env.local` 应保持为 `127.0.0.1:5433`，而不是 `localhost:5432`
- 如果你要改 Docker 下的数据库连接串，可以设置 `ACRE_DOCKER_DATABASE_URL`

缺失后的影响：

- `npm run db:validate` 会失败
- `npm run db:migrate` 会失败
- `npm run db:seed` 会失败
- `/api/db/seeded-context` 会失败
- `/office/pipeline` 会失败
- `/office/transactions` 会失败
- `/office/transactions` 的 URL 驱动分页查询（`q / status / page / pageSize`）会失败
- `/office/contacts` 会失败
- `/office/contacts` 的 URL 驱动分页查询（`q / stage / page / pageSize`）会失败
- `/office/activity` 会失败
- `/office/tasks` 会失败
- `/office/accounting` 会失败
- `/login`、`/invite/[token]`、`/change-password` 和需要 session context 的 server-side 查询会失败
- `/office/settings/users` 以及其邀请 / 解锁写接口会失败
- transaction detail 下的 checklist/tasks route 会失败
- `/api/office/reports/export` 会失败
- `/api/office/activity/comments` 会失败
- `/api/office/accounting/transactions*` 会失败
- `/api/office/accounting/earnest-money*` 会失败
- `/api/office/transactions/:transactionId/documents*` 会失败
- `/api/office/transactions/:transactionId/forms*` 会失败
- `/api/office/transactions/:transactionId/signatures*` 会失败
- `/api/office/transactions/:transactionId/incoming-updates*` 会失败
- 后续如果更多页面/API 接入 Prisma runtime，相关查询也会失败

开发和生产差异：

- 开发环境通常使用本地 PostgreSQL 或开发库
- 生产环境必须使用真实数据库，并确保网络和权限配置正确

### `ACRE_SESSION_SECRET`

用途：

- 本地 auth/session 的 cookie 签名 secret
- 当前用于保护 `acre_local_session` 不被随意篡改
- 当前 password login、invite accept、forced change-password 成功后都依赖这套 signed cookie

是否必填：

- 本地开发不是强制必填，因为代码里有 development fallback
- 但建议配置，避免不同环境共享默认 secret
- 生产环境现在应视为必填；缺失时登录签名不会继续回退到仓库内默认值

示例格式：

```env
ACRE_SESSION_SECRET="replace-with-a-long-random-string"
```

缺失后的影响：

- 本地登录仍然可以工作
- 但会退回到仓库内的开发默认值，不适合长期共享环境
- 生产环境下如果缺失，session 创建会直接失败并暴露配置问题

开发和生产差异：

- 开发环境可用 fallback 启动
- 生产或共享环境应始终显式配置

### `ACRE_BASE_URL`

用途：

- 为一次性 provisioning / 邀请批量初始化脚本生成完整 invite URL
- 当前用于 `scripts/provision-backoffice-initial-accounts.ts`

是否必填：

- 非必填
- 缺失时默认使用 `https://acresystem.us`

示例格式：

```env
ACRE_BASE_URL="https://acresystem.us"
```

缺失后的影响：

- 脚本仍可运行
- 但 invite URL 会按默认生产域名拼接

### `ACRE_DOCUMENTS_STORAGE_DIR`

用途：

- 覆盖 transaction document 文件的本地存储目录
- 当前 document upload / generated form document / file open 都通过这个目录读写文件

是否必填：

- 不是必填
- 开发环境不配置时，默认落到仓库根目录下的 `.local-storage/documents`
- 生产环境不配置时，默认落到 `/var/lib/acre/documents`

示例格式：

```env
ACRE_DOCUMENTS_STORAGE_DIR="/absolute/path/to/acre-documents"
```

缺失后的影响：

- 不会导致应用报错
- 会使用默认本地目录
- 当前新写入的 `storageKey` 会以 storage root 下的相对路径保存，避免把仓库目录写死进 metadata
- 这适合当前单 Droplet 生产模型，但前提是目录必须是持久化磁盘路径，而不是 deploy 目录

开发和生产差异：

- 开发环境可直接使用默认目录或显式指定一个本地路径
- 生产环境如果继续保留这个实现，需要保证文件系统持久化、目录权限正确、并把该目录纳入备份
- 更合理的长期方向仍是后续替换到对象存储

### `ACRE_SECURE_COOKIES`

用途：

- 控制当前本地 auth/session cookie 是否强制使用 `Secure`
- 当前主要用于没有 HTTPS 的部署环境

是否必填：

- 不是必填
- 不配置时，当前代码会在 `production` 环境默认使用 `Secure` cookie

示例格式：

```env
ACRE_SECURE_COOKIES=false
```

当前使用建议：

- 本地开发：通常不需要显式设置
- 纯 `HTTP` 的临时生产部署：设为 `false`
- 正式 `HTTPS` 生产部署：不要设为 `false`

缺失后的影响：

- 在没有 HTTPS 的生产环境里，如果保持默认 `Secure` cookie，登录后浏览器不会保存 session
- 表现为：
  - 登录接口返回成功
  - 但进入受保护页面后又被重定向回 `/login`

开发和生产差异：

- 开发环境通常不受这个问题影响
- 纯 `HTTP` 生产环境需要显式处理
- 一旦接入 HTTPS，应恢复 `Secure` cookie

## 当前代码中的来源

参考文件：

- [.env.example](../.env.example)
- [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma)
- [packages/db/package.json](../packages/db/package.json)
- [packages/db/src/client.ts](../packages/db/src/client.ts)

注意：

- 当前 `db:validate` 脚本里带了一个本地占位格式的连接串，用于在没有真实 secret 的情况下完成 schema 语法校验
- 这不等于已经接入真实数据库

## 暂未实现但未来大概率会新增的环境变量

以下变量当前还不存在于代码里，因此不要提前假设已经接入：

- `NEXTAUTH_SECRET` 或同类 auth secret
- `NEXTAUTH_URL` 或应用 base URL
- `S3_*` / `R2_*` 对象存储相关变量
- AI provider key
- OCR provider key
- 邮件 / 短信服务 key
- 第三方地产平台集成 key

这些在真正接入前，不应写入生产部署手册中作为“已存在配置”。

## 开发环境建议

如果你当前只是前端开发或页面结构开发：

- 可以不配置真实数据库
- 直接运行 `npm run dev`
- 当前默认走 `next dev --webpack`，用来降低 `Docker/Colima` bind mount 下 Turbopack 对新增文件偶发报错的问题

如果你要开始接数据库：

1. 先在仓库根目录配置 `.env.local`
2. 提供真实可连接的 `DATABASE_URL`
3. 运行 `npm run db:generate`
4. 运行 `npm run db:migrate -- --name init`
5. 运行 `npm run db:seed`

如果你要改用 Docker 本地长期运行：

1. 安装 Docker Desktop 或可用的 Docker Engine
2. 在仓库根目录执行 `npm run docker:dev:up`
3. 首次初始化数据库时执行 `docker compose run --rm web npm run db:migrate -- --name init`
4. 需要初始数据时执行 `docker compose run --rm web npm run db:seed`
5. 打开 `http://localhost:3105/`

当前 Docker 开发基线说明：

- `db` 使用 `postgres:16-alpine`
- `web` 使用仓库内 `Dockerfile.dev`
- `web` 和 `db` 都配置为 `restart: unless-stopped`
- 文档文件会持久化到 Docker volume，而不是容器临时层
- 如果你希望宿主机 `npm run dev` 与 Docker `web` 共享同一套本地数据库，宿主机 `.env.local` 的 `DATABASE_URL` 应保持为 `postgresql://postgres:postgres@127.0.0.1:5433/acre`
- 容器内部仍然固定使用 `postgresql://postgres:postgres@db:5432/acre`
- 如果宿主机另一个服务占用了 `5433`，需要同步修改 compose 的 host 端口映射和宿主机 `.env.local`

### 生产数据到本地的单向同步

如果你需要把 `DigitalOcean` 线上最新数据拉到本地开发库，但又不希望本地写操作回写线上，可以使用：

```bash
npm run db:sync:from-production
```

当前同步行为：

- 通过 `ssh` 连接默认生产主机 `root@45.55.247.137`
- 从 `/etc/acre/acre-ui-rebuild.env` 读取生产 `DATABASE_URL`
- 在远端仅执行 `pg_dump` 只读导出
- 在本地 Docker `db` 容器里先导入 `prod_sync_stage` 临时 schema
- 再把 stage 数据 upsert 合并进本地 `public` schema
- 线上不存在的本地记录会保留，不会被删除
- 这是一条单向同步线：本地不会把数据回写线上

当前限制：

- 本地如果改的是与线上同一主键的既有记录，下一次同步时会被线上版本覆盖
- 该脚本依赖本地 `docker compose` 的 `db` 服务正在运行
- 该脚本依赖远端主机上可用的 `pg_dump`
- 同步前应保证本地 schema 与当前代码匹配；如果刚改过 Prisma schema，先运行 `npm run db:generate` 以及需要的 migration
- 如果你本地之前跑过 seed 或旧测试数据，这些“线上不存在”的本地记录会默认保留；如果首次要做成纯线上基线，可临时开启 `ACRE_SYNC_RESET_LOCAL=1`

### 本地同步脚本相关变量

以下变量是同步脚本的 operator override，不是 Web 应用 runtime 必填项：

- `ACRE_DEPLOY_HOST`
  - 默认 `root@45.55.247.137`
- `ACRE_DEPLOY_SSH_KEY`
  - 默认 `$HOME/.ssh/acre_do_ed25519`
- `ACRE_DEPLOY_ENV_FILE`
  - 默认 `/etc/acre/acre-ui-rebuild.env`
- `ACRE_LOCAL_DB_SERVICE`
  - 默认 `db`
- `ACRE_LOCAL_DB_HOST`
  - 默认 `127.0.0.1`
- `ACRE_LOCAL_DB_NAME`
  - 默认 `acre`
- `ACRE_LOCAL_DB_USER`
  - 默认 `postgres`
- `ACRE_LOCAL_DB_PASSWORD`
  - 默认 `postgres`
- `ACRE_SYNC_STAGE_SCHEMA`
  - 默认 `prod_sync_stage`
- `ACRE_SYNC_KEEP_STAGE_SCHEMA`
  - 默认 `0`
- `ACRE_SYNC_RESET_LOCAL`
  - 默认 `0`
  - 设为 `1` 时，会先清空本地 `public` schema 里的业务数据，再把线上数据导入本地

当前实现说明：

- `packages/db` 的 Prisma 脚本会读取仓库根目录的 `.env.local` / `.env`
- `@acre/db` 的 runtime 也会从仓库根目录读取同一份 `DATABASE_URL`

## 生产环境建议

当前默认生产基线是 `DigitalOcean + systemd + nginx`：

- 不要把 `.env.local` 提交到仓库
- 服务器环境文件位于 `/etc/acre/acre-ui-rebuild.env`
- 服务器应用目录位于 `/opt/acre-ui-rebuild/app`
- 生产服务名是 `acre-ui-rebuild-web.service`
- 生产 `DATABASE_URL` 必须指向可用的 PostgreSQL 实例

## 维护要求

今后每新增一个环境变量，都应同步更新：

- [docs/env.md](./env.md)
- [.env.example](../.env.example)
- 如果影响部署，也要同步更新 [docs/deployment.md](./deployment.md)
