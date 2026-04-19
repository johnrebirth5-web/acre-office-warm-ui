# Secret Rotation Runbook

本 runbook 只覆盖 `Acre` 当前生产基线下最关键的三类 secret 轮换：

- `ACRE_SESSION_SECRET`
- `ACRE_RESEND_API_KEY`
- `acre_app` 对应的 PostgreSQL 凭据（`DATABASE_URL`）

默认生产基线：

- 应用目录：`/opt/acre-ui-rebuild/app`
- 环境文件：`/etc/acre/acre-ui-rebuild.env`
- systemd 服务：`acre-ui-rebuild-web.service`

开始之前先做两件事：

1. 跑一轮 git 历史扫描，确认泄漏范围。
2. 确认是否已经独立配置 `ACRE_SETTINGS_ENCRYPTION_SECRET`。如果没有，当前系统内保存的 SMTP / Signature Drive 密钥仍可能依赖 `ACRE_SESSION_SECRET` 进行加密。

推荐的历史扫描命令：

```bash
git log --all --full-history -p -- .env .env.local
git log --all -S 'ACRE_SESSION_SECRET'
git log --all -S '<old-resend-key-fragment>'
git log --all -S '<old-db-password-fragment>'
```

如果历史里出现真实 secret：

- 先完成轮换，再决定是否需要 `git filter-repo`
- 无论是否重写历史，都应记入内部 incident log

## 1. Session secret 轮换

### 适用场景

- `.env` / `.env.local`、终端、截图、备份、聊天记录出现了当前值
- 团队需要定期做 session signing secret 轮换

### 预检

- `/etc/acre/acre-ui-rebuild.env` 中存在当前 `ACRE_SESSION_SECRET`
- `ACRE_SESSION_SECRET_SECONDARY` 当前为空，或你明确知道可以覆盖它
- `ACRE_SETTINGS_ENCRYPTION_SECRET` 已经配置；如果没有，先确认 SMTP / Signature Drive 设置在轮换后是否需要重新保存

### 推荐执行方式

先在服务器上 dry-run：

```bash
cd /opt/acre-ui-rebuild/app
bash ./scripts/rotate-session-secret.sh
```

确认输出无误后再 apply：

```bash
cd /opt/acre-ui-rebuild/app
sudo bash ./scripts/rotate-session-secret.sh --apply
```

脚本行为：

- 生成新的 `ACRE_SESSION_SECRET`
- 把当前 primary 值写入 `ACRE_SESSION_SECRET_SECONDARY`
- 为 `/etc/acre/acre-ui-rebuild.env` 创建时间戳备份
- 重启 `acre-ui-rebuild-web.service`

### 兼容窗口

- 旧 cookie 需要保留 `30` 天兼容期
- 在兼容窗口内不要删除 `ACRE_SESSION_SECRET_SECONDARY`
- 兼容期结束后，再手动从 env source 中移除 `ACRE_SESSION_SECRET_SECONDARY`

### 预期空窗

- 只有一次 `systemd` 重启窗口
- 现有用户在 primary/secondary 双验签窗口内不应被整体踢下线

### 回滚

如果应用重启后无法创建或验证 session：

1. 恢复脚本生成的 env 备份文件
2. 重启 `acre-ui-rebuild-web.service`
3. 检查 `/login`、邀请接受、强制改密三条路径是否恢复正常

回滚命令示例：

```bash
sudo cp /etc/acre/acre-ui-rebuild.env.bak.<timestamp> /etc/acre/acre-ui-rebuild.env
sudo systemctl restart acre-ui-rebuild-web.service
```

## 2. Resend API key 轮换

### 适用场景

- `ACRE_RESEND_API_KEY` 在本地工作树、截图、日志、聊天记录中暴露
- 需要按季度或按事件轮换邮件发送凭据

### 执行步骤

1. 进入 Resend 控制台，定位当前 production key。
2. 创建新的 production API key。
3. 在应用侧先更新 `/etc/acre/acre-ui-rebuild.env` 中的 `ACRE_RESEND_API_KEY`。
4. 重启 `acre-ui-rebuild-web.service`。
5. 用一封测试签署邮件或其他真实发送路径验证新 key 生效。
6. 验证成功后，再在 Resend 控制台 revoke 旧 key。

### 预期空窗

- 应用本身不会下线
- 只有邮件发送在切换窗口内可能短暂失败

### 回滚

- 如果新 key 发送失败但旧 key 还未 revoke，先把 env 文件改回旧 key 并重启服务
- 如果旧 key 已经 revoke，则重新签发新的 Resend key，再更新 env 文件

## 3. PostgreSQL 凭据轮换

### 适用场景

- `DATABASE_URL` 或 `acre_app` 密码在工作树 / 文档 / 日志中暴露
- 需要按 DBA 规范轮换应用数据库用户密码

### 执行步骤

1. 生成新的高强度数据库密码。
2. 使用现有管理账户连接 PostgreSQL。
3. 执行 `ALTER USER acre_app WITH PASSWORD '...'`。
4. 更新 `/etc/acre/acre-ui-rebuild.env` 中的 `DATABASE_URL`。
5. 重启 `acre-ui-rebuild-web.service`。
6. 验证 `/api/health`、登录、Office 列表页和至少一条数据库写路径。

### 预期空窗

- 主要是应用重启与旧连接池清空的窗口
- 如果 DB 连接失败，`/api/health` 应先表现为 `degraded` / `503`

### 回滚

- 如果应用无法连库，先把 `DATABASE_URL` 恢复到旧值并重启服务
- 如果密码已经修改但应用仍失败，检查：
  - 实际连接的主机 / 端口 / 库名
  - 用户是否为 `acre_app`
  - 密码中是否含需要 URL encode 的字符

## 4. 轮换完成后的统一验证

每次轮换结束后都要至少做以下 smoke checks：

```bash
sudo systemctl status acre-ui-rebuild-web.service --no-pager
curl -I https://acresystem.us/login
curl -fsS https://acresystem.us/api/health | jq
```

然后补做一条真实业务路径：

- session secret：重新登录并访问一个需要权限的 Office 页面
- Resend：从签署或通知流里发一封测试邮件
- DB：进入一个有 Prisma runtime 的 Office 页面，确认读写都正常
