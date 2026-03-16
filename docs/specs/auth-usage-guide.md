# 登录系统使用说明

## 适用范围

这份说明描述的是当前已经上线到仓库里的最小正式内部账号系统。

当前系统包含：

- 管理员邀请创建用户
- 受邀用户通过邀请链接设置密码
- 后续使用邮箱 + 密码登录
- 连续 5 次密码错误后锁定 1 小时
- 管理员从 Users 页手动解锁
- 继续沿用当前 `acre_local_session` 签名 cookie 会话

当前系统明确 **不包含**：

- 忘记密码
- 邮件自动发送邀请
- 2FA / 2-step verification
- OAuth / SSO

## 登录入口

本地开发默认入口：

- `http://localhost:3105/login`

当前 DigitalOcean 入口：

- `http://45.55.247.137:3105/login`

注意：

- 登录页只接受 **邮箱 + 密码**
- 不支持 `admin` 这类用户名
- 登录页首屏应该是空白输入框，不应预填任何演示账号

## 账号角色

当前登录系统对内部账号主要使用两个角色：

- `office_admin`
  - 管理员
  - 可以进入 `/office/settings/users`
  - 可以创建用户、发邀请、解锁账号、修改角色和状态
- `office_user`
  - 普通内部用户
  - 主要用于日常 Office 使用
  - 不能执行高风险后台管理操作

系统内部仍保留部分历史角色兼容逻辑，但当前 Users 管理页只把角色选择暴露为：

- `Admin`
- `User`

## 账号状态的理解方式

当前账号分成两层状态：

### 1. Membership 状态

它表示账号生命周期：

- `invited`
  - 已创建，但还没有完成邀请接受
- `active`
  - 已可正常登录
- `disabled`
  - 已停用，不能继续正常使用

### 2. Credential 状态

它表示密码与登录安全状态，例如：

- 是否已设置密码
- 是否必须修改密码
- 是否因密码连续输错被锁定

不要把“密码输错导致临时锁定”理解成成员身份被禁用。  
临时锁定是凭证层状态，不是 `Membership.status`。

## 首次管理员使用

系统会确保存在一个 bootstrap admin：

- 邮箱：`office@acreny.us`
- 角色：`office_admin`

使用规则：

- 首次成功登录后，系统会强制跳到 `/change-password`
- 必须先改密码，才能进入正常后台
- 仓库文档不重复记录原始初始密码，避免把敏感信息扩散到手册里

如果你在新环境里需要拿到 bootstrap admin 的首次登录凭据，应通过安全渠道保存和传递，不要写进公开页面或日常操作文档。

## 管理员如何新增用户

管理员登录后，进入：

- `/office/settings/users`

这页是当前内部账号管理主入口。

### 创建新用户

1. 打开 `Invite internal user`
2. 填写：
   - First name
   - Last name
   - Email
   - Role
   - Office access
   - Title
3. 点击 `Create invited user`
4. 系统会立即生成一条可复制的邀请链接
5. 点击 `Copy link`，把链接发给对应内部成员

当前不会自动发邮件，所以邀请是“后台生成链接 + 手动发送”。

### 角色怎么选

- `Admin`：创建为 `office_admin`
- `User`：创建为 `office_user`

当前不要把普通成员当成 `office_manager` 来创建；那个角色只保留兼容，不是这套账号系统面向日常操作的主入口。

## 被邀请用户如何激活账号

受邀用户拿到邀请链接后，打开：

- `/invite/[token]`

完成流程：

1. 系统校验邀请链接是否有效
2. 如果链接未过期、未撤销、未被使用，就进入设置密码页面
3. 用户输入自己的新密码
4. 提交后，系统会：
   - 标记邀请已接受
   - 把 `Membership.status` 从 `invited` 改成 `active`
   - 创建或更新密码凭证
   - 直接签发正常登录 cookie session
5. 激活完成后，用户就进入正常后台

## 普通登录怎么用

登录入口：

- `/login`

使用方式：

1. 输入邀请时使用的邮箱
2. 输入当前密码
3. 点击 `Log in`

登录成功后：

- 系统会继续使用 `acre_local_session` 签名 cookie 建立会话
- 会按角色跳到默认工作区页面

登录失败时：

- 页面会显示通用错误提示
- 不会告诉你“邮箱是否存在”

## 密码修改怎么用

密码修改页：

- `/change-password`

当前支持两种情况：

- 首次登录后被强制修改密码
- 已登录用户主动修改自己的密码

已登录用户也可以从：

- `/office/account`

点击：

- `Change password`

进入修改密码页面。

## 锁定机制

当前锁定规则：

- 同一个账号连续输错密码 5 次
- 账号会被锁定 1 小时

锁定后的表现：

- 登录页会提示该账号暂时锁定
- 锁定是账号级别，不只是 IP 级别

解除锁定有两种方式：

- 等 1 小时自动过期
- 由管理员在 Users 页手动解锁

成功登录后：

- `failedLoginCount` 会清零
- 锁定状态也会被清除

## 管理员如何处理已存在账号

在 `/office/settings/users` 中，管理员可以对已有账号做这些操作：

- `Save`
  - 保存角色、状态、office access 的修改
- `Issue invite`
  - 给还没完成初始化的账号发一条新的邀请链接
- `Reissue invite`
  - 重发邀请链接
- `Issue setup link`
  - 给已有账号重新发设置密码链接
- `Reset password`
  - 生成新的密码设置链接，让对方重新设密码
- `Revoke link`
  - 撤销当前有效邀请/设置链接
- `Unlock`
  - 解除临时锁定

## 停用与恢复

管理员可以在 Users 页调整账号状态。

常见理解方式：

- `Invited`
  - 账号已建，但尚未完成激活
- `Active`
  - 正常可用
- `Disabled`
  - 不允许继续使用

如果账号被设为 `Disabled`：

- 不能继续正常登录
- 即使以前设过密码，也不应再视为可用账号

## 退出登录

当前退出方式：

- 打开 `/office/account`
- 点击 `Sign out and switch user`

或者向：

- `POST /api/auth/logout`

提交请求。

退出时系统会：

- 清掉 `acre_local_session`
- 记录一条 logout activity
- 回到 `/login`

## Activity Log 会记录什么

当前至少会记录这些登录相关事件：

- bootstrap admin created
- user invited
- invite accepted
- login succeeded
- login failed
- account locked
- account unlocked
- password changed
- password setup link issued
- role changed
- account activated / deactivated

如果你要排查账号问题，建议优先查看：

- `/office/activity?objectType=auth`

## 常见使用场景

### 场景 1：新增一个普通用户

1. 管理员登录
2. 进入 `/office/settings/users`
3. 创建用户，角色选 `User`
4. 复制邀请链接
5. 把链接发给对方
6. 对方打开链接并设置密码
7. 对方以后从 `/login` 用邮箱 + 密码登录

### 场景 2：新增一个管理员

1. 管理员登录
2. 进入 `/office/settings/users`
3. 创建用户，角色选 `Admin`
4. 复制邀请链接
5. 对方接受邀请并设置密码
6. 激活后即可进入 Users 等管理页

### 场景 3：有人连续输错密码被锁了

1. 管理员进入 `/office/settings/users`
2. 找到对应账号
3. 点击 `Unlock`
4. 让对方重新登录

### 场景 4：有人忘了自己密码

当前系统还没有 forgot-password 页面。

处理方式是：

1. 管理员进入 `/office/settings/users`
2. 对该账号点击 `Reset password` 或 `Issue setup link`
3. 复制新生成的链接
4. 发给对方重新设置密码

如果当前系统里没有第二个管理员，而唯一管理员自己也无法登录，就需要服务端/数据库层人工干预；这是当前最小账号系统的已知限制之一。

## 当前限制

这套系统目前是“最小正式内部账号系统”，不是完整 auth 平台。

已知限制包括：

- 没有 forgot password 页面
- 没有邮件自动发送
- 没有 2FA / 2-step verification
- 没有 OAuth / SSO
- session 目前仍是签名 cookie 模式，不是独立 session store

## 建议的日常操作习惯

- 管理员新增用户时，优先走邀请链接，不要手动共享自己的账号
- 普通用户只使用邮箱登录，不要尝试用户名
- bootstrap admin 首次登录后立即修改密码
- 至少保留两个可用的管理员账号，避免唯一管理员失联时无法自助恢复
- 账号异常时优先看 Users 页状态和 Auth Activity Log

## 对新线程的建议入口

如果以后开新线程，需要让 Codex 快速理解当前登录系统，可以优先让它读取：

- [docs/specs/auth-usage-guide.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/auth-usage-guide.md)
- [docs/specs/auth-invitations-users-spec.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/auth-invitations-users-spec.md)
- [docs/specs/implementation-log.md](/Users/openclaw_john/工作文件夹/Acre_latest_clean/docs/specs/implementation-log.md)
