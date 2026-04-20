# GitHub 分支保护设置清单

目标：允许直接推送到 `main`，但继续保留 CI、管理员约束和防误操作保护，避免强推覆盖或误删主线。

适用仓库：`johnrebirth5-web/acre-office-warm-ui`

## 设置入口

GitHub 仓库页面：

`Settings -> Branches -> Add branch protection rule`

建议的 branch name pattern：

`main`

## 当前仓库长期基线

适用时间：自 `2026-04-20` 起，除非仓库 owner 明确调整。

- branch pattern = `main`
- `Require a pull request before merging` 已关闭
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

### 1. Require status checks to pass before merging

为什么要开：

- 没有这个开关，CI 只是“会跑”，不是“必须过”
- 当前仓库最关键的两条检查是 `verify` 和 `hardening-tests`

推荐值：

- `Require status checks to pass before merging`
- `Require branches to be up to date before merging`
- Required checks:
  - `verify`
  - `hardening-tests`

### 2. No force push

为什么要开：

- 避免覆盖主线历史
- 避免在 incident 处理中把原始提交链打乱

推荐值：

- 保持 `Allow force pushes` 为关闭状态

### 3. No deletions

为什么要开：

- 防止误删主线分支
- 和 production / deploy runbook 保持一致

推荐值：

- 保持 `Allow deletions` 为关闭状态

### 4. No bypass for administrators

为什么要开：

- 即使管理员也要受同一套主线保护约束
- 即使允许 direct push，也不应该允许静默改掉保护后无痕绕过

推荐值：

- 保持 `Do not allow bypassing the above settings` 为开启状态

## 当前协作含义

- 允许有权限的成员直接 push 到 `main`
- 保留 `verify` 与 `hardening-tests` 作为 PR merge 时的必过检查
- 如果选择走 PR，仍然要求分支在 merge 前与 `main` 保持最新
- 不再要求 approval 或 stale review 规则，因为当前不强制 PR

直接推送 `main` 时，建议至少在本地先跑一次与你这次改动相称的校验；推送后仍应关注 GitHub Actions 结果。

## 最终检查表

- [ ] branch pattern = `main`
- [ ] `Require a pull request before merging` 已关闭
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
