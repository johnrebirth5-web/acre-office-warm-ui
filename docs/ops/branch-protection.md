# GitHub 分支保护设置清单

目标：允许直接推送到 `main`，不再把 PR 或 CI 检查设为 merge / push 门槛，同时继续保留防强推和防误删保护。

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
- `Require status checks to pass before merging` 已关闭
- `Do not allow bypassing the above settings` 已开启
- `Allow force pushes` 关闭
- `Allow deletions` 关闭

## 当前仓库 merge method 约束

适用时间：`2026-04-24` 实时确认，除非仓库 owner 明确调整。

- merge commits 不允许：`allow_merge_commit = false`
- squash merges 不允许：`allow_squash_merge = false`
- rebase merges 允许：`allow_rebase_merge = true`
- merged 后自动删除 head branch 已开启：`delete_branch_on_merge = true`

处理 PR merge 时，默认使用：

```bash
gh pr merge <pr-number> --rebase
```

不要先尝试：

```bash
gh pr merge <pr-number> --merge
gh pr merge <pr-number> --squash
```

除非实时仓库设置已经确认对应 merge method 被重新开启。

这项设置不属于 branch protection API 的同一组输出。需要确认时运行：

```bash
gh api repos/johnrebirth5-web/acre-office-warm-ui \
  --jq '{allow_merge_commit, allow_squash_merge, allow_rebase_merge, delete_branch_on_merge}'
```

注意：rebase merge 后，`main` 上的 commit SHA 可能不同于原 PR 分支 commit SHA，即使文件内容完全一致。如果生产已经提前部署了 PR 分支 commit，不要只因为 SHA 变化就判断生产落后；先用 `git diff <deployed_commit> origin/main` 或等价方式比较内容。

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

### 1. No force push

为什么要开：

- 避免覆盖主线历史
- 避免在 incident 处理中把原始提交链打乱

推荐值：

- 保持 `Allow force pushes` 为关闭状态

### 2. No deletions

为什么要开：

- 防止误删主线分支
- 和 production / deploy runbook 保持一致

推荐值：

- 保持 `Allow deletions` 为关闭状态

### 3. No bypass for administrators

为什么要开：

- 即使管理员也要受同一套主线保护约束
- 即使允许 direct push，也不应该静默放开剩余保护项

推荐值：

- 保持 `Do not allow bypassing the above settings` 为开启状态

## 当前协作含义

- 允许有权限的成员直接 push 到 `main`
- 不再要求 PR、approval、stale review 或 required checks
- `.github/workflows/ci.yml` 里的 `verify` 与 `hardening-tests` 仍然存在，但现在是“运行后观察结果”，不是 branch protection 门槛

直接推送 `main` 时，建议至少在本地先跑一次与你这次改动相称的校验；推送后仍应关注 GitHub Actions 结果，因为它们不再替你自动挡住有问题的提交。

## 最终检查表

- [ ] branch pattern = `main`
- [ ] `Require a pull request before merging` 已关闭
- [ ] `Require status checks to pass before merging` 已关闭
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
