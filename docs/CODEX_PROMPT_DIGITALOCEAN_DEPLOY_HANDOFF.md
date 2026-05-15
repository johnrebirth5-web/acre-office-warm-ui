# Acre DO 部署交接给 Codex

把这个文件直接喂给新电脑上的 Codex。Codex 的任务只有一个：把同事已经同步到她自己仓库里的 Acre 代码部署到 DigitalOcean。

不要处理她怎么改代码，也不要处理她怎么同步到自己的 GitHub。只管部署到 DO。

## 固定信息

- DO SSH：`root@45.55.247.137`
- SSH key 默认路径：`~/.ssh/acre_do_ed25519`
- 生产登录页：`https://acresystem.us/login`
- fallback 登录页：`http://45.55.247.137:3105/login`
- 生产目录：`/opt/acre-ui-rebuild/app`
- 生产 env：`/etc/acre/acre-ui-rebuild.env`
- systemd 服务：`acre-ui-rebuild-web.service`
- 部署命令：`npm run deploy:digitalocean -- "$ACRE_DEPLOY_COMMIT_SHA"`

## 需要用户提供的两个值

部署前只问用户这两个值：

```bash
export ACRE_DEPLOY_REPO_URL="<她自己的仓库 clone URL>"
export ACRE_DEPLOY_COMMIT_SHA="<要部署的 commit sha>"
```

如果她的仓库是 private，`ACRE_DEPLOY_REPO_URL` 必须是 DO 服务器能 clone 的 URL。

## 第一步：确保 SSH key 在本机

先检查：

```bash
ls -la ~/.ssh/acre_do_ed25519
```

如果文件不存在，就让用户把部署私钥内容发给 Codex，然后在本机执行：

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat > ~/.ssh/acre_do_ed25519 <<'EOF'
把用户给的部署私钥原文放这里
EOF
chmod 600 ~/.ssh/acre_do_ed25519
```

然后写入 known_hosts 并测试：

```bash
ssh-keyscan -H 45.55.247.137 >> ~/.ssh/known_hosts
ssh -i ~/.ssh/acre_do_ed25519 -o StrictHostKeyChecking=yes root@45.55.247.137 'hostname && systemctl is-active acre-ui-rebuild-web.service'
```

如果输出里有 hostname，并且服务是 `active`，就可以继续。

## 第二步：确认 DO 能 clone 她自己的仓库

```bash
ssh -i ~/.ssh/acre_do_ed25519 -o StrictHostKeyChecking=yes root@45.55.247.137 \
  "rm -rf /tmp/acre-repo-check && git clone --depth 1 '$ACRE_DEPLOY_REPO_URL' /tmp/acre-repo-check && rm -rf /tmp/acre-repo-check"
```

如果失败，说明 `ACRE_DEPLOY_REPO_URL` 不是 DO 可读取的地址。让用户换成 DO 可以 clone 的 URL。

## 第三步：本地快速检查

在 Acre 项目根目录执行：

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

如果改过 Prisma schema，再执行：

```bash
npm run db:validate
npm run db:generate
```

## 第四步：部署到 DO

在 Acre 项目根目录执行：

```bash
export ACRE_DEPLOY_REPO_URL="<她自己的仓库 clone URL>"
export ACRE_DEPLOY_COMMIT_SHA="<要部署的 commit sha>"

npm run deploy:digitalocean -- "$ACRE_DEPLOY_COMMIT_SHA"
```

部署脚本会自动：

- SSH 到 DO
- clone `ACRE_DEPLOY_REPO_URL`
- checkout `ACRE_DEPLOY_COMMIT_SHA`
- `npm ci`
- `npm run db:generate`
- 读取 `/etc/acre/acre-ui-rebuild.env`
- `prisma migrate deploy`
- `npm run build`
- 同步到 `/opt/acre-ui-rebuild/app`
- 重启 `acre-ui-rebuild-web.service`
- 验证登录页

## 第五步：部署后验证

```bash
curl -fsSI https://acresystem.us/login
curl -fsSI http://45.55.247.137:3105/login
ssh -i ~/.ssh/acre_do_ed25519 -o StrictHostKeyChecking=yes root@45.55.247.137 'systemctl status --no-pager acre-ui-rebuild-web.service | sed -n "1,30p"'
```

如果页面不对，看日志：

```bash
ssh -i ~/.ssh/acre_do_ed25519 -o StrictHostKeyChecking=yes root@45.55.247.137 'journalctl -u acre-ui-rebuild-web.service -n 120 --no-pager'
```

## 给 Codex 的执行口径

用户说“部署到 DO / 上线 / deploy production”时，按这个顺序做：

1. 确认 `ACRE_DEPLOY_REPO_URL`
2. 确认 `ACRE_DEPLOY_COMMIT_SHA`
3. 确认 `~/.ssh/acre_do_ed25519` 存在，不存在就让用户粘贴私钥并保存
4. 测试 SSH 到 `root@45.55.247.137`
5. 测试 DO 能 clone `ACRE_DEPLOY_REPO_URL`
6. 本地跑 `npm ci && npm run typecheck && npm run lint && npm run build`
7. 执行 `npm run deploy:digitalocean -- "$ACRE_DEPLOY_COMMIT_SHA"`
8. 验证 `https://acresystem.us/login`

不要用 Vercel。不要在 `/opt/acre-ui-rebuild/app` 里手动 `git pull`。
