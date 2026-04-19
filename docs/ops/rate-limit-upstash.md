# Upstash 限流后端切换演练

目标：验证 `memory -> upstash` 切换路径在本地和部署环境都明确可操作，且出现故障时可以快速回滚。

当前仓库实现位置：

- `apps/web/lib/rate-limit.ts`

## 需要的环境变量

```env
ACRE_RATE_LIMIT_BACKEND="upstash"
ACRE_UPSTASH_REDIS_REST_URL="https://example.upstash.io"
ACRE_UPSTASH_REDIS_REST_TOKEN="replace-with-upstash-rest-token"
ACRE_TRUSTED_PROXY_TIER="none"
```

说明：

- `ACRE_RATE_LIMIT_BACKEND=upstash` 会切到共享 REST 后端
- `ACRE_UPSTASH_REDIS_REST_URL` 和 `ACRE_UPSTASH_REDIS_REST_TOKEN` 必须成对提供
- `ACRE_TRUSTED_PROXY_TIER` 与限流 key 的 client IP 提取顺序有关；当前如果没有可信 CDN / 反向代理，保持 `none`

## Upstash 开通步骤

1. 登录 [Upstash 控制台](https://console.upstash.com/)
2. 创建一个 `Redis` 数据库
3. 记录：
   - REST URL
   - REST Token
4. 把这两个值写入本地 `.env.local` 或部署环境变量源

## 本地验证方式

推荐直接跑仓库自带测试：

```bash
npm exec -- tsx --test apps/web/lib/rate-limit.test.ts
```

这组测试会覆盖：

- memory 后端
- Upstash pipeline 请求格式
- `ACRE_RATE_LIMIT_BACKEND=upstash` 时 `consumeRateLimit` 走共享后端
- proxy tier 对 client identifier 优先级的影响

本轮本地演练时，测试输出里与 Upstash 相关的关键片段是：

```text
ok - consumeRateLimit routes through the upstash backend when configured
ok - createUpstashRateLimitConsumer sends the expected pipeline request
```

## 切换步骤

### 本地

1. 在 `.env.local` 写入：
   - `ACRE_RATE_LIMIT_BACKEND="upstash"`
   - `ACRE_UPSTASH_REDIS_REST_URL="..."`
   - `ACRE_UPSTASH_REDIS_REST_TOKEN="..."`
2. 重启本地 `npm run dev`
3. 运行：

```bash
npm exec -- tsx --test apps/web/lib/rate-limit.test.ts
```

### 服务器

1. 在服务器环境变量源中写入同样 3 个值
2. 重启应用服务
3. 观察登录 / 邀请接受 / 签署提交这些已接入限流的入口

## 回滚方式

如果 Upstash 配置错误或服务不可用，回滚步骤很简单：

1. 把 `ACRE_RATE_LIMIT_BACKEND` 改回 `memory`
2. 可以保留 Upstash URL / token，也可以一并删掉
3. 重启应用服务

`memory` 是当前默认值，所以只要 backend 切回去，应用会恢复到进程内限流。

## 失败模式

当前实现不会静默吞掉 Upstash 故障。

如果：

- URL / token 缺失
- Upstash 返回非 2xx
- pipeline payload 不合法

则 `consumeRateLimit` 会抛错，路由层会按现有错误链路返回失败。对用户可见表现通常会是 `503` 或对应 route 的失败响应，而不是“偷偷降级到 memory”。

这样做的目的，是避免在多实例环境里误以为还在共享限流，实际上已经退化成每个实例各算各的。
