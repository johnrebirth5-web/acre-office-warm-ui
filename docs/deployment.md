# Deployment

## Codex 部署规则

这份文档只在“用户明确要求部署 / 生产同步”时使用。

默认规则：

- Codex 在日常功能开发任务里只做本地实现、文档更新和本地验证
- 对于 Codex 在仓库内完成的代码或文档改动，默认应在任务收尾时 `git commit` 并 `git push origin <branch>`
- 如果用户在当前任务里明确要求不要同步到 GitHub，才可以只保留本地提交或本地变更
- 不要运行 `vercel`，不要触发 Vercel deployment / redeploy，也不要把 Vercel 当作 Codex 的交付目标
- 除非用户在当前任务里明确要求，否则不要自动同步到 `DigitalOcean`
- GitHub 同步不等于 `DigitalOcean` 部署；两者必须分开判断
- 如果 GitHub 仍在平台侧连着 Vercel 自动部署，必须去 Vercel / GitHub 设置里关闭；仓库守则本身不会物理关闭外部自动化
- 不要把“本地验证通过”“代码已提交”或“任务已完成”解释成可以自动部署
- 如果用户没有明确要求部署，最终汇报里只需要说明本地验证结果，不要自行执行任何生产命令

## 当前 DigitalOcean 生产环境

当前仓库已经有一个真实的 `DigitalOcean` 单机部署，不需要再从聊天里恢复这部分背景。

当前默认工作基线：

- 默认 GitHub 仓库：`https://github.com/johnrebirth5-web/acre-office-warm-ui.git`
- 默认外部入口：`http://45.55.247.137:3105/`
- 默认应用目录：`/opt/acre-ui-rebuild/app`
- 默认环境文件：`/etc/acre/acre-ui-rebuild.env`
- 默认服务：`acre-ui-rebuild-web.service`
- 旧 `acre-web`、旧 `/opt/acre/app`、旧 `http://45.55.247.137/` 仅作为历史线路保留

生产服务器：

- provider: `DigitalOcean`
- droplet ip: `45.55.247.137`
- region: `nyc3`
- host OS: `Ubuntu 24.04`
- deploy shape: `single droplet`
  - `Next.js` app
  - local `PostgreSQL`
  - local document storage

当前生产访问方式：

- app URL: `http://45.55.247.137`
- login URL: `http://45.55.247.137/login`

当前已知限制：

- 还没有自定义域名
- 还没有 HTTPS
- 还没有 `Managed PostgreSQL`
- 还没有 `Spaces` / 对象存储
- 生产 document 存储仍然是服务器本地文件系统

## 当前生产服务器上的关键路径

- app root: `/opt/acre/app`
- app env file: `/etc/acre/acre.env`
- app local env mirror: `/opt/acre/app/.env.local`
- document storage dir: `/var/lib/acre/documents`
- systemd service: `acre-web`
- nginx site config: `/etc/nginx/sites-available/acre.conf`
- app service logs: `journalctl -u acre-web`
- nginx logs: `/var/log/nginx/access.log`、`/var/log/nginx/error.log`

说明：

- 当前服务器上的应用目录不是长期维护的 Git 工作副本
- 当前部署方式是把本地仓库的**已提交代码**同步到服务器目录，再在服务器上构建
- 所以“同步到 DO”时，不要假设服务器上可以直接 `git pull`
- document storage 目录不在 app root 下，重部署不会覆盖它

## 单 Droplet 文件存储约定

当前生产文件存储不是“临时开发捷径”，而是当前单 Droplet 方案的一部分：

- 默认生产目录：`/var/lib/acre/documents`
- 这个目录必须位于持久化磁盘上，不能放在 `/opt/acre/app` 这类会被部署覆盖的目录里
- 目录应由应用运行用户可读写；当前推荐保持 `acre:acre`
- 最低要求：
  - 应用进程可创建子目录和文件
  - nginx 不直接读这个目录
  - 目录纳入服务器级备份

建议初始化检查：

```bash
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 '
  install -d -o acre -g acre -m 0750 /var/lib/acre/documents &&
  ls -ld /var/lib/acre/documents
'
```

## 当前生产同步方式

只有在用户明确要求部署到 `DigitalOcean` 时，后续 Codex 线程才应遵循下面的同步方式。

### 1. 本地先完成并提交代码

只有在当前任务已经得到明确部署指令后，才继续下面步骤。

```bash
git add <files>
git commit -m "your message"
git push origin main
```

### 2. 把当前已提交版本同步到服务器

当前推荐方式是从本地仓库把 `HEAD` 打包后通过 `ssh` 解到服务器：

```bash
git archive --format=tar HEAD | \
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 'tar -xf - -C /opt/acre/app'
```

如果只同步部分文件，也可以指定路径：

```bash
git archive --format=tar HEAD path/to/file1 path/to/file2 | \
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 'tar -xf - -C /opt/acre/app'
```

注意：

- 这依赖当前机器上的 SSH key：`~/.ssh/acre_do_ed25519`
- 如果未来线程发现这把 key 不存在，需要重新建立 SSH 访问，不要假设服务器公开接受密码登录

### 3. 在服务器上构建并重启

当前推荐方式：

```bash
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 '
  su - acre -c "
    cd /opt/acre/app &&
    set -a &&
    . /etc/acre/acre.env &&
    [ -f .env.local ] && . .env.local;
    set +a;
    npm run build
  " &&
  systemctl restart acre-web
'
```

如果 schema 变更了，先执行 migration，再 build / restart，不要反过来。

### 4. 基础验证

至少验证：

```bash
curl -I http://45.55.247.137/login
curl -I http://45.55.247.137/office/dashboard
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 'systemctl status acre-web --no-pager | sed -n "1,20p"'
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 'systemctl status nginx --no-pager | sed -n "1,20p"'
```

如果登录或反向代理行为异常，再补查：

```bash
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 'journalctl -u acre-web -n 100 --no-pager'
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 'tail -n 100 /var/log/nginx/error.log'
```

## 生产环境初始化状态

当前服务器已经完成：

- Node.js 22
- npm
- nginx
- PostgreSQL 16
- 2G swap
- `acre` system user
- app directories and env file layout
- systemd service for the web app
- nginx reverse proxy to `127.0.0.1:3000`

因此未来线程一般不需要重做初始化，只需要：

- 同步代码
- 必要时跑 migration
- 构建
- 重启服务

## 生产数据库操作

当前数据库就在同一台机器上，应用通过本机 PostgreSQL 连接。

如果 schema 变更了，生产同步时要显式执行：

```bash
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 '
  su - acre -c "
    cd /opt/acre/app/packages/db &&
    set -a &&
    . /etc/acre/acre.env &&
    [ -f ../../.env.local ] && . ../../.env.local;
    set +a;
    npx prisma migrate deploy --schema prisma/schema.prisma
  "
'
```

seed 只在需要时执行，不要每次部署都无条件跑：

```bash
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 '
  su - acre -c "
    cd /opt/acre/app &&
    set -a &&
    . /etc/acre/acre.env &&
    [ -f .env.local ] && . .env.local;
    set +a;
    npm run db:seed
  "
'
```

## 当前生产环境变量特殊点

除了常规的：

- `DATABASE_URL`
- `ACRE_SESSION_SECRET`
- `ACRE_DOCUMENTS_STORAGE_DIR`

当前生产还临时设置了：

- `ACRE_SECURE_COOKIES=false`

原因：

- 现在生产站点还是纯 `HTTP`
- 如果 cookie 标成 `Secure`，浏览器不会保存登录 session

后续一旦接入 HTTPS，应把这个变量移除或设回安全模式。

额外要求：

- `ACRE_SESSION_SECRET` 在生产应始终显式配置
- `ACRE_DOCUMENTS_STORAGE_DIR` 建议显式配置为 `/var/lib/acre/documents`，即使代码现在也会在生产默认落到这里

## 当前 nginx / web 服务行为

nginx 当前把所有流量反向代理到：

- `127.0.0.1:3000`

应用服务由 `systemd` 管理：

- service name: `acre-web`

常用命令：

```bash
systemctl restart acre-web
systemctl status acre-web --no-pager
journalctl -u acre-web -n 100 --no-pager

systemctl restart nginx
systemctl status nginx --no-pager
nginx -t
```

## 当前部署已知问题和边界

- 当前是单机生产，不是高可用架构
- 文件存储仍是本机磁盘，不适合长期大规模 documents 生产方案
- 没有 HTTPS
- 没有域名
- 没有对象存储

## 备份最低要求

当前部署至少要把下面两部分一起备份，否则 documents 和 metadata 会失配：

- PostgreSQL 数据库
- `/var/lib/acre/documents`

最低 runbook：

```bash
ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 '
  su - postgres -c "pg_dump acre > /var/backups/acre/acre-$(date +%F).sql"
'

ssh -i ~/.ssh/acre_do_ed25519 root@45.55.247.137 '
  tar -czf /var/backups/acre/documents-$(date +%F).tar.gz /var/lib/acre/documents
'
```

注意：

- 只备份数据库而不备份 documents，会导致 document metadata 仍在但文件丢失
- 只备份 documents 而不备份数据库，会导致无法恢复文档归属、workflow 和 activity

所以后续推荐优先级是：

1. 绑定域名
2. 配 HTTPS
3. 恢复 `Secure` cookie
4. 把 documents 移到对象存储
5. 评估是否把 PostgreSQL 移到 `Managed PostgreSQL`

## 当前部署状态

当前真实状态：

- 本地开发可运行
- GitHub 仓库已存在并已推送
- 仓库历史上存在 Vercel 配置，但 Codex 当前守则禁止把 Vercel 作为同步目标
- 已有生产部署实例
- 没有 staging 环境实例
- 已有最小本地 auth/session，但生产 auth 仍未正式设计
- 本地 PostgreSQL + Prisma migrate/seed 已验证

所以这份文档既说明“现在如何运行”，也说明“后续推荐如何部署”。其中未落地部分会标明。

## 当前可用部署方式

### 1. 本地开发运行

这是当前唯一实际完成并验证通过的运行方式。

步骤：

```bash
npm install
npm run dev
```

访问：

- `http://localhost:3000`

已验证的命令：

```bash
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
npm run lint
npm run typecheck
npm run build
npm run db:validate
```

如果拉到包含新 Prisma migration 的代码，例如 transaction、contact、transaction finance、`TransactionContact`、`TransactionTask` / `TaskListView`，或 accounting / EMD 这类 schema 扩展，先额外执行：

```bash
npm run db:migrate -- --name your_change_name
npm run db:seed
```

## 推荐的后续部署方案

当前的推荐方案是：

- `GitHub` 作为代码源
- `DigitalOcean` 作为当前唯一允许的 Codex 部署目标
- `PostgreSQL` 作为外部数据库

但注意：

- 现在 `Dashboard` 的业务指标、`Pipeline workspace`、`Transactions`、`Contacts`、`Tasks`、`Reports`、`Activity`、`Accounting` 这几条 Office 线已经依赖真实数据库
- `/office/tasks` 现在也依赖真实数据库中的 `TransactionTask`、`TaskListView` 和当前 office session
- `/office/activity` 现在也依赖真实数据库中的 `AuditLog` 和实时派生 alerts 查询
- `Transactions` detail 里的 finance 保存也已经依赖真实数据库 migration 和写路径
- `/office/accounting` 现在也依赖真实数据库中的 `LedgerAccount / AccountingTransaction / AccountingTransactionLineItem / GeneralLedgerEntry / EarnestMoneyRecord`
- `/api/office/accounting/transactions*` 和 `/api/office/accounting/earnest-money*` 现在也属于真实数据库写路径
- `Reports` 的 CSV 导出 route 也依赖真实数据库和有效 office session
- `/api/office/activity/comments` 也依赖真实数据库和有效 office session
- transaction detail 下的 documents / forms / signatures / incoming updates 现在也依赖真实数据库和有效 office session
- transaction documents 当前还依赖本地文件系统存储目录；默认写到 `.local-storage/documents`
- 所以当前并不存在“完整生产部署”

## 构建与发布

### 本地构建

```bash
npm run build
```

作用：

- 验证 monorepo 中各 package 能否完成 `build`
- 验证 Next.js 应用能否生成生产构建
- 验证 API route 是否能通过 Next build

### 发布到 GitHub

当前仓库已经这样发布：

- remote: `origin`
- repo: [johnrebirth5-web/acre](https://github.com/johnrebirth5-web/acre)
- branch: `main`

典型流程：

```bash
git add .
git commit -m "your message"
git push origin main
```

### Vercel（禁用，不作为 Codex 同步目标）

当前守则要求：

- Codex 不得运行 `vercel`
- Codex 不得把任何任务收尾动作定义为“同步到 Vercel”
- Codex 不得把 Vercel 当作生产验证目标

如果平台侧仍保留了 GitHub -> Vercel 自动部署：

1. 需要在 Vercel / GitHub 设置中显式关闭
2. 不要把“GitHub 已 push”解释成“Vercel 应该同步”
3. 在外部设置关闭之前，任何 push 都可能仍由平台自动触发，这不属于仓库守则可直接消除的行为

## 依赖的平台和服务

### 当前已依赖

- GitHub
- Node.js
- npm

### 当前代码中已声明但尚未接入运行时

- PostgreSQL
- Prisma
- Vercel（守则中禁用，不作为 Codex 同步目标）

### 未来大概率需要，但当前未实现

- 对象存储
- 鉴权服务或 session 存储
- 后台任务执行器
- AI / OCR / third-party integration service

## 开发、测试、生产环境区别

### 开发环境

当前真实情况：

- 运行 `next dev`
- 使用 `@acre/backoffice` 内存数据
- 不需要真实数据库即可浏览多数页面和多数 mock API
- 但 `/office/transactions`、`/office/contacts`、`/office/tasks`、`/office/activity`、`/office/accounting`、本地登录、以及数据库 probe 依赖真实数据库
- `/office/transactions` 现在的 `q / status / page / pageSize` 服务端分页查询也依赖真实数据库
- `/office/contacts` 现在的 `q / stage / page / pageSize` 服务端分页查询也依赖真实数据库
- accounting create / edit / EMD 写路径也依赖真实数据库
- document upload / open / delete、form draft、signature workflow、incoming update review 也依赖真实数据库和本地文件存储
- 如果只执行 `db:validate`，只需要一个格式正确的 `DATABASE_URL`

### 测试环境

未实现。

当前没有：

- 自动化测试环境
- preview environment 约定
- fixture / seed 流程

暂定建议：

- 后续接数据库后，先补一个最小的 preview/staging 环境
- 不要直接把生产数据库作为开发验证环境

### 生产环境

未实现。

当前不应该把这个仓库视为可直接上线的生产系统，原因包括：

- 没有真实鉴权
- 只有部分数据库运行时接入
- 只有部分写接口
- 没有 observability
- 没有错误监控
- 没有测试

## 常见部署故障点

### 1. Node/npm 版本不兼容

表现：

- `npm install` 或 `next build` 失败

建议：

- 使用较新的 Node 版本，建议 `Node 22+`
- 保持本地与 CI / Vercel 版本尽量一致

### 2. workspace 依赖没安装完整

表现：

- `@acre/*` 包无法解析
- `next build` 或 `tsc` 报 workspace module not found

建议：

- 在仓库根目录运行 `npm install`
- 不要只在 `apps/web` 下单独装依赖

### 3. `DATABASE_URL` 缺失

表现：

- `npm run db:validate` 失败

说明：

- 当前运行页面不依赖真实数据库
- 但 Prisma schema 校验、migration、seed 和数据库 probe 都依赖 `DATABASE_URL`

建议：

- 在仓库根目录配置 `.env.local`
- 参考 [docs/env.md](./env.md) 配置

### 4. 把“可 build”误认为“可上线”

表现：

- 团队误以为 Next build 成功就代表生产可用

实际情况：

- 当前 build 成功，只代表前端和 API mock 层可编译
- 不代表业务已具备生产能力

### 5. Vercel 根目录识别错误

这个问题曾经出现过，所以已经在 [apps/web/next.config.ts](../apps/web/next.config.ts) 里通过 `turbopack.root` 做了约束。

如果未来目录结构变化，需要重新检查这里。

## 发布前最低检查清单

在任何准备发布的动作前，建议先跑：

```bash
npm run db:generate
npm run lint
npm run typecheck
npm run build
npm run db:validate
```

再手动确认：

- 首页能打开
- `/login` 能打开
- Agent 页面能打开
- Office 页面能打开
- `/api/health` 返回 `ok`
- 如果已配置数据库，`/api/db/seeded-context` 能返回 seeded organization / office / memberships

如果后续接入真实数据库，再把数据库连接检查加入发布清单。
