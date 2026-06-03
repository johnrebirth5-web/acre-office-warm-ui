# Secret Rotation Actions Checklist

这份文档是给运维/owner 抄命令用的执行清单，不需要改代码。

生产默认基线：

- 环境文件：`<deployment-env-file>`
- 服务：`<app-service-name>`
- 代码目录：`<deployment-app-dir>`

## 0. 预检

- [ ] 先确认当前仓库工作树不要再新增包含真实 secret 的文件
- [ ] 先跑 git 历史扫描，确认泄漏范围：

```bash
cd <repo-root>
git log --all --full-history -p -- .env .env.local
git log --all -S 'ACRE_SESSION_SECRET'
git log --all -S '<old-resend-key-fragment>'
git log --all -S '<old-db-password-fragment>'
```

- [ ] 确认生产环境是否已经配置 `ACRE_SETTINGS_ENCRYPTION_SECRET`

```bash
ssh <ssh-user>@<server-host> "grep -n '^ACRE_SETTINGS_ENCRYPTION_SECRET=' <deployment-env-file> || true"
```

## 1. 登录到生产主机

```bash
ssh <ssh-user>@<server-host>
cd <deployment-app-dir>
sudo cp <deployment-env-file> <deployment-env-file>.pre-rotation.$(date +%Y%m%d-%H%M%S)
```

## 2. Session secret 轮换

先 dry-run：

```bash
cd <deployment-app-dir>
bash ./scripts/rotate-session-secret.sh
```

确认输出无误后 apply：

```bash
cd <deployment-app-dir>
sudo bash ./scripts/rotate-session-secret.sh --apply
sudo systemctl status <app-service-name> --no-pager
```

验证：

- [ ] 开始前另起一个 ssh 会话跑 `bash scripts/ops/preflight.sh`；如果输出 `NO-GO` 就停手
- [ ] 在准备执行 `systemctl restart` 或其他服务重启动作之前，在另一个会话跑 `bash scripts/ops/watch.sh` 并保持打开
- [ ] 完成后跑 `bash scripts/ops/smoke.sh`；如果输出 `FAIL`，按本 doc 的回滚段处理

检查 env 文件：

```bash
sudo grep -n '^ACRE_SESSION_SECRET=' <deployment-env-file>
sudo grep -n '^ACRE_SESSION_SECRET_SECONDARY=' <deployment-env-file>
```

兼容窗口提醒：

- [ ] 记录今天日期，`30` 天后删除 `ACRE_SESSION_SECRET_SECONDARY`

## 3. Resend key 轮换

控制台动作：

- [ ] 登录 Resend 控制台
- [ ] 为 production 创建新 API key
- [ ] **暂时不要**先 revoke 旧 key

服务器动作：

```bash
read -rsp 'New Resend API key: ' NEW_RESEND_KEY
echo
sudo python3 -c '
from pathlib import Path
import sys

env_file = Path("<deployment-env-file>")
new_value = sys.stdin.read().rstrip("\n")
lines = env_file.read_text().splitlines()
updated = []
replaced = False

for line in lines:
    if line.startswith("ACRE_RESEND_API_KEY="):
        updated.append(f"ACRE_RESEND_API_KEY=\"{new_value}\"")
        replaced = True
    else:
        updated.append(line)

if not replaced:
    updated.append(f"ACRE_RESEND_API_KEY=\"{new_value}\"")

env_file.write_text("\n".join(updated) + "\n")
' <<<"$NEW_RESEND_KEY"
unset NEW_RESEND_KEY

sudo systemctl restart <app-service-name>
sudo systemctl status <app-service-name> --no-pager
```

验证：

- [ ] 开始前另起一个 ssh 会话跑 `bash scripts/ops/preflight.sh`；如果输出 `NO-GO` 就停手
- [ ] 在准备执行 `systemctl restart` 或其他服务重启动作之前，在另一个会话跑 `bash scripts/ops/watch.sh` 并保持打开
- [ ] 完成后跑 `bash scripts/ops/smoke.sh`；如果输出 `FAIL`，按本 doc 的回滚段处理
- [ ] 发一封真实测试邮件，确认新 key 已生效
- [ ] 验证成功后，再回到 Resend 控制台 revoke 旧 key

## 4. 数据库密码轮换

先在本地或服务器上离线生成新密码，不要写进仓库：

```bash
python3 - <<'PY'
from secrets import token_urlsafe
print(token_urlsafe(32))
PY
```

更新 PostgreSQL 用户密码：

```bash
psql "$DATABASE_URL"
```

在 `psql` 提示符内执行：

```text
\password acre_app
\q
```

- [ ] 在 `\password acre_app` 的两次提示里输入同一个新密码；这一步不会把密码暴露到 shell history 或 `ps` 输出

更新生产 env 文件里的 `DATABASE_URL`：

```bash
read -rsp 'New DB password: ' NEW_DB_PASSWORD
echo
sudo python3 -c '
from pathlib import Path
from urllib.parse import quote
import sys

env_file = Path("<deployment-env-file>")
new_password = quote(sys.stdin.read().rstrip("\n"), safe="")
lines = env_file.read_text().splitlines()
updated = []

for line in lines:
    if not line.startswith("DATABASE_URL="):
        updated.append(line)
        continue
    prefix, value = line.split("=", 1)
    raw = value.strip().strip("\"")
    raw = raw.strip(chr(39))
    marker = "://"
    scheme, rest = raw.split(marker, 1)
    credentials, host_part = rest.split("@", 1)
    user = credentials.split(":", 1)[0]
    updated.append(f"DATABASE_URL=\"{scheme}{marker}{user}:{new_password}@{host_part}\"")

env_file.write_text("\n".join(updated) + "\n")
' <<<"$NEW_DB_PASSWORD"
unset NEW_DB_PASSWORD

sudo systemctl restart <app-service-name>
sudo systemctl status <app-service-name> --no-pager
```

验证：

- [ ] 开始前另起一个 ssh 会话跑 `bash scripts/ops/preflight.sh`；如果输出 `NO-GO` 就停手
- [ ] 在准备执行 `systemctl restart` 或其他服务重启动作之前，在另一个会话跑 `bash scripts/ops/watch.sh` 并保持打开
- [ ] 完成后跑 `bash scripts/ops/smoke.sh`；如果输出 `FAIL`，按本 doc 的回滚段处理

```bash
curl -fsS https://your-acre-domain.example.com/api/health | jq
```

- [ ] 登录 `/login`
- [ ] 打开一个 Office 列表页
- [ ] 完成一条真实写操作（例如保存 setting 或创建 test record）

## 5. 轮换后的统一 smoke checks

```bash
curl -I https://your-acre-domain.example.com/login
curl -fsS https://your-acre-domain.example.com/api/health | jq
sudo journalctl -u <app-service-name> -n 100 --no-pager
```

- [ ] 登录成功
- [ ] `/api/health` 返回 `ok` 或无 DB 错误的 `degraded`
- [ ] 没有持续的 `invalid session signature`、DB auth failure、Resend auth failure

## 6. 30 天后的 session 收尾

当兼容窗口过去后：

```bash
sudo python3 - <<'PY'
from pathlib import Path

env_file = Path("<deployment-env-file>")
lines = [line for line in env_file.read_text().splitlines() if not line.startswith("ACRE_SESSION_SECRET_SECONDARY=")]
env_file.write_text("\n".join(lines) + "\n")
PY

sudo systemctl restart <app-service-name>
```

- [ ] 删除 `ACRE_SESSION_SECRET_SECONDARY`
- [ ] 再做一次登录 smoke test
