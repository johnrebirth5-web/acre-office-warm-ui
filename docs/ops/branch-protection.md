# GitHub 分支保护设置清单

目标：把 `main` 设成“必须经由 PR、必须通过 CI、管理员也不能静默绕过”的稳定主线，避免直接推送、漏跑校验或强推覆盖。

适用仓库：`johnrebirth5-web/acre-office-warm-ui`

## 设置入口

GitHub 仓库页面：

`Settings -> Branches -> Add branch protection rule`

建议的 branch name pattern：

`main`

## 当前仓库长期基线

适用时间：自 `2026-04-19` 起，除非仓库 owner 明确调整。

- branch pattern = `main`
- `Require a pull request before merging` 已开启
- `Require approvals` = `0`
- `Dismiss stale pull request approvals when new commits are pushed` 已开启
- `Require status checks to pass before merging` 已开启
- `Require branches to be up to date before merging` 已开启
- required checks:
  - `verify`
  - `hardening-tests`
- `Do not allow bypassing the above settings` 已开启
- `Allow force pushes` 关闭
- `Allow deletions` 关闭

这份文档描述的是期望基线，不是永远正确的云端事实。任何 merge、规则调整、验收或运维判断之前，都要再次运行：

```bash
bash scripts/ops/verify-branch-protection.sh \
  --repo johnrebirth5-web/acre-office-warm-ui \
  --branch main
```

必要时再用：

```bash
gh api repos/johnrebirth5-web/acre-office-warm-ui/branches/main/protection
```

确认实时 GitHub 状态。

## 必须开启的规则

### 1. Require a pull request before merging

为什么要开：

- 防止直接把未审查改动推到 `main`
- 保留清晰的 review / discussion 记录
- 配合 required status checks 才能真正把 CI 变成门槛

当前仓库基线：

- `Require a pull request before merging`
- `Require approvals: 0`
- `Dismiss stale pull request approvals when new commits are pushed`

### 2. Require status checks to pass before merging

为什么要开：

- 没有这个开关，CI 只是“会跑”，不是“必须过”
- 当前仓库最关键的两条检查是 `verify` 和 `hardening-tests`

推荐值：

- `Require status checks to pass before merging`
- `Require branches to be up to date before merging`
- Required checks:
  - `verify`
  - `hardening-tests`

### 3. Approval 数量按协作模型设置

为什么要单独说明：

- 多人协作仓库常见做法是 `>= 1`
- 当前仓库的长期模式是“CI 必过 + PR 必经 + 管理员不可绕过”，但 approval 设成 `0`
- 这样可以保留分支与 CI 门槛，同时避免单人维护节奏被 approval 卡住

当前仓库基线：

- 在 `Require a pull request before merging` 下，把 approvals 设成 `0`

如果未来改回多人 review 流程，再把这个值上调到 `1` 或更高。

### 4. Dismiss stale reviews

为什么要开：

- 避免“旧 approval”在代码变更后仍被当成有效
- 可以减少“review 的是旧版本，merge 的是新版本”的风险

推荐值：

- `Dismiss stale pull request approvals when new commits are pushed`

### 5. No force push

为什么要开：

- 避免覆盖主线历史
- 避免在 incident 处理中把原始提交链打乱

推荐值：

- 保持 `Allow force pushes` 为关闭状态

### 6. No deletions

为什么要开：

- 防止误删主线分支
- 和 production / deploy runbook 保持一致

推荐值：

- 保持 `Allow deletions` 为关闭状态

## 推荐同时开启的配套设置

### Automatically delete head branches

入口：

`Settings -> General -> Pull Requests`

为什么建议开：

- 减少分支墓园
- 和当前仓库“合并即删”的治理目标一致

## 紧急绕过流程

只在真正阻塞生产恢复、且没有时间走正常 PR 流程时使用。

### 允许的场景

- 线上故障需要立即 hotfix
- 安全 incident 需要先堵口子，再补完整修复

### 绕过步骤

1. 由具备 admin 权限的人执行一次性 override
2. 只允许最小必要改动进入 `main`
3. 在同一天补一条 PR 或至少补一条 issue，记录：
   - 为什么绕过
   - 谁执行的
   - 改了什么
   - 后续补救动作
4. 如果是直接 push，事后必须补一条 PR 或 cherry-pick 到审查分支，保留 review 记录

### 禁止的场景

- “为了省事”
- “CI 太慢，先跳过”
- “这个改动很小，不需要 review”

## 最终检查表

- [ ] branch pattern = `main`
- [ ] `Require a pull request before merging` 已开启
- [ ] approvals = `0`
- [ ] `Dismiss stale pull request approvals when new commits are pushed` 已开启
- [ ] `Require status checks to pass before merging` 已开启
- [ ] required checks 包含 `verify`
- [ ] required checks 包含 `hardening-tests`
- [ ] `Require branches to be up to date before merging` 已开启
- [ ] `Do not allow bypassing the above settings` 已开启
- [ ] `Allow force pushes` 关闭
- [ ] `Allow deletions` 关闭
- [ ] `Automatically delete head branches` 已开启

按当前长期基线核对时，最终检查表应读作：

```bash
bash scripts/ops/verify-branch-protection.sh \
  --repo johnrebirth5-web/acre-office-warm-ui \
  --branch main
```

必须输出 `PASS`。
