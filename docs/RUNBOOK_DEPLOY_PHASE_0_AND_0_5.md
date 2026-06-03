# Runbook — 部署 Phase 0 / Phase 0.5 + 验证分支保护

> 我的沙箱没装 `gh`、没有 cloud VM 的 SSH 钥匙、不能替你创建 Sentry 账号。
> 下面是**你本人需要执行**的每一步，按顺序来，10~20 分钟搞定。
>
> 建议在终端里开一个新窗口，一步一步复制粘贴。每步都有预期输出，对不上就停下来回报我。

---

## 步骤 1 — 验证分支保护（2 分钟）

在你 **Mac 本地**（`<repo-root>` 目录下）跑：

```bash
bash scripts/ops/verify-branch-protection.sh \
  --repo johnrebirth5-web/acre-office-warm-ui \
  --branch main
```

**预期输出**（一堆 `[OK]` 行）：

```
[OK] pull requests are required before merge
[OK] required approvals is 0
[OK] stale reviews are dismissed on new commits
[OK] administrators cannot bypass branch protection
[OK] required status checks are enabled
[OK] branches must be up to date before merge
[OK] required status checks include verify
[OK] required status checks include hardening-tests
[OK] force pushes are disabled
[OK] branch deletions are disabled
PASS
```

**判断：**

- 全是 `[OK]` + 最后 `PASS` → 分支保护规则本身没问题，当前长期模式已经对齐到“PR 必经、CI 必过、approval=0、管理员不可绕过”。
- 出现任何 `[FAIL]` → 把完整输出贴给我，我告诉你补哪条。

---

## 步骤 2 — 创建 Sentry 项目，拿 DSN（5 分钟，只需一次）

Sentry 账号和项目得你自己在浏览器里弄，我没法代劳。按这个流程：

1. 打开 <https://sentry.io/signup/>（或如果已有账号 <https://sentry.io/auth/login/>）
2. 用你的工作邮箱登录
3. 创建新 Project：
   - Platform 选 **Next.js**
   - Project name 写 `acre-web-app`（或你喜欢的名字）
   - Alert frequency 选 `Alert me on every new issue`
4. 创建完成后，Sentry 会直接展示安装步骤，里面有一行：
   ```
   dsn: "https://<xxxxxxxxxxxx>@<yyyy>.ingest.us.sentry.io/<project-id>"
   ```
   **把这整个 DSN URL 复制下来**，这是你的 `SENTRY_DSN` 值。
5. （可选）创建一个 Auth Token 用于 source map 上传：
   - Sentry → Settings → Account → API → Auth Tokens → Create New Token
   - Scopes 只勾 `project:releases`
   - 复制 token，这是你的 `SENTRY_AUTH_TOKEN`（不填也没关系，只是不上传 source map，报错堆栈会是 minified 的）

---

## 步骤 3 — 先生成 metrics token，再在生产 server 上更新 env（5 分钟）

先在你 **Mac 本地** 生成一个新的 metrics token，记下来，后面会用两次：

```bash
openssl rand -hex 32
```

把输出的 64 位十六进制串保存到密码管理器或临时笔记里。下面用 `<你刚生成的 metrics token>` 代指它。

> **注意：** `ACRE_METRICS_TOKEN` 是生产环境密钥，不要把真实值写进仓库、runbook、公开 chat 或邮件。

然后再 SSH 到 cloud VM：

```bash
ssh <你平时用的用户名>@<server-ip>
```

然后在 server 上：

```bash
# 1. 备份现有 env 文件
sudo cp <deployment-env-file> <deployment-env-file>.bak.$(date +%Y%m%d%H%M%S)

# 2. 编辑
sudo nano <deployment-env-file>
```

**在文件末尾追加这 6 行**（替换 `SENTRY_DSN` 为步骤 2 拿到的真实 DSN，`ACRE_METRICS_TOKEN` 用你刚生成的新值）：

```
ACRE_METRICS_TOKEN=<你刚生成的 metrics token>
PRISMA_SLOW_QUERY_MS=500
PRISMA_VERY_SLOW_QUERY_MS=2000
SENTRY_DSN=<把 Sentry 给你的 DSN URL 整个粘贴进来>
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_AUTH_TOKEN=
```

保存退出（nano 里按 `Ctrl+O` → `Enter` → `Ctrl+X`）。

校验文件格式没问题：

```bash
# 这条不应该报错
sudo bash -n -c 'set -a; source <deployment-env-file>; set +a'

# 确认新增了 6 个值，每个都非空（除了 SENTRY_AUTH_TOKEN 可以空）
sudo grep -E '^(ACRE_METRICS_TOKEN|PRISMA_SLOW_QUERY_MS|PRISMA_VERY_SLOW_QUERY_MS|SENTRY_DSN|SENTRY_TRACES_SAMPLE_RATE|SENTRY_AUTH_TOKEN)=' <deployment-env-file>
```

---

## 步骤 4 — 按仓库默认流程部署指定 commit（3 分钟）

回到你 **Mac 本地仓库根目录** `<repo-root>`，执行：

```bash
cd <repo-root>
git log --oneline -5
```

确认最新 5 条 commit 里包含：

```
8c51304 Extend listing studio asset cache lifetimes
fa5dd65 Add image decoding hints to listing studio gallery
a49511c Preload adjacent listing studio images
a0d79bc Add observability route tests and docs
8c45609 Add phase 0 observability instrumentation
```

然后：

```bash
# 按仓库当前默认生产链路部署指定 commit
npm run deploy:digitalocean -- 8c51304
```

这条命令会按仓库当前认可的流程自动做这些事：

- SSH 到 server
- 在临时目录 clone 指定 commit
- `npm ci`
- `npm run db:generate`
- 读取 `<deployment-env-file>` 后执行 `npx prisma migrate deploy`
- `npm run build`
- 把构建结果 rsync 到 `<deployment-app-dir>`
- 重启 `<app-service-name>`
- 自动校验 `https://your-acre-domain.example.com/login`

> 不要在 live 目录里手动 `git fetch` / `git reset --hard`。当前仓库的正式部署文档明确要求走“临时 checkout/build -> sync 到 `<deployment-app-dir>`”这条线。

如果脚本失败，再 SSH 到 server 看状态：

```bash
sudo journalctl -u <app-service-name> -n 100 --no-pager
```

把最后 50 行贴给我。

---

## 步骤 5 — 生产环境验证（5 分钟）

还在 server 上（或者回到你的 Mac 上）：

### 5.1 /api/health 新字段

```bash
curl -s https://your-acre-domain.example.com/api/health | jq .
```

**预期看到**：

```json
{
  "status": "ok",
  "health_status": "ok",
  "service": "acre-agent-os",
  "checks": { ... },
  "db": {
    "ping_ms": <小于 50 的数字>,
    "pool_in_use": <一般 1~3>,
    "pool_idle": <可能是 0 或几个>,
    "pool_max": <100 或你 DB 的 max_connections 配置值>
  },
  "process": {
    "rss_bytes": <几亿的数字>,
    "heap_used_bytes": ...,
    "heap_total_bytes": ...,
    "uptime_seconds": <几十，刚重启不久>
  },
  "timestamp": "2026-04-19T..."
}
```

如果 `pool_max` 是 100（managed PostgreSQL 默认），**记录一下**——这是 Phase 1 调优连接池时的上限参考。

### 5.2 /api/metrics 新端点

```bash
curl -s -H "X-Metrics-Token: <你在步骤 3 生成并写入 env 的 metrics token>" \
  https://your-acre-domain.example.com/api/metrics
```

**预期看到** 6 组 Prometheus gauge（每组通常有 `# HELP`、`# TYPE` 和数值行）。确认 `nodejs_event_loop_lag_ms` 有值（通常是小于 10 的浮点数，新启动时可能是 0）。

也测一下 401：

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://your-acre-domain.example.com/api/metrics
# 应该返回 401
```

### 5.3 Sentry 探针

不要把 `curl https://your-acre-domain.example.com/api/__nonexistent__` 当成 Sentry 探针。

- 那个请求大概率只会返回普通 `404`，不能证明当前接入的 `withApiGuard` / Prisma / global error boundary 已经成功上报到 Sentry。
- 当前仓库里没有专门的生产 `sentry-probe` 路由，所以更稳妥的做法是：
  - 先确认 `SENTRY_DSN` 已经写入 `<deployment-env-file>`
  - 部署完成后打开 Sentry dashboard 的 Issues / Events 页面
  - 等下一次真实异常出现时确认它是否进入 Sentry
  - 如果你一定要做“显式探针”，建议单独开一个临时 probe commit，在受控路由里 `throw new Error("sentry-probe")`，验证后再回滚这个 probe commit

### 5.4 慢查询日志

```bash
# 让服务跑 2 分钟，然后看有没有 slow_query 记录
sudo journalctl -u <app-service-name> --since "5 minutes ago" | grep -E 'slow_query|very_slow_query' | head -20
```

**预期**：可能有，也可能没有。

- 有 `slow_query` / `very_slow_query`：记录前几条最常见的路径 / SQL 类型
- 完全没有：不一定是故障，也可能只是当前流量窗口里没有超过阈值的查询

### 5.5 Phase 0.5 图片切换

用浏览器访问 <https://your-acre-domain.example.com/listing-studio/listings/cmo0yqyvo001ai6yr16xel3jm>：

1. 打开 DevTools → Network → Filter: `assets/`
2. 首次加载后，应该看到 3 个 `/api/listing-studio/assets/...` 请求（当前图 + next + prev）
3. 点下一张缩略图 → Network 里新的 `/api/listing-studio/assets/...` 请求应该显示 `(disk cache)` 或 `(memory cache)`，**不再有真实网络传输**
4. 肉眼感受：切换大图应该**瞬时、无白屏**

---

## 完成后回报给我的信息

如果都顺利：

- 步骤 1 的输出（`PASS` 还是 `FAIL` + 哪些 FAIL 行）
- 步骤 5.1 的 `db.pool_max` 数字
- 步骤 5.4 里最常出现的 slow_query 路径 / SQL 类型（前 5 条就行）
- 步骤 5.5 的主观感受（是否瞬时）

我拿这些数据就能直接给你开 Phase 1.1（连接池调优）的提示词，并且能根据 5.4 的慢查询数据反过来验证 `connection_limit` 的合理值。

---

## 如果任何一步卡住

**不要硬继续**。直接回报我：

- 哪一步卡住
- 看到的完整输出（或截图）
- `systemctl status` 和 `journalctl -u ... -n 50` 的结果

我会告诉你怎么恢复。最坏情况：

```bash
# 把 env 文件回滚到备份
sudo cp <deployment-env-file>.bak.<timestamp> <deployment-env-file>

# 代码回滚到 Phase 0 之前，按同一条正式部署链路重新部署旧 commit
cd <repo-root>
npm run deploy:digitalocean -- 3274acb  # Make branch-protection drift visible
```

Phase 0 / 0.5 的代码改动都是"只增不改"，回滚是安全的。
