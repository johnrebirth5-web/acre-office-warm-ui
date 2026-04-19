# Redis 限流后端切换演练

目标：把写接口 rate limit 从 `memory` 切到标准 Redis，避免单进程内存计数在重启后清零，并为后续迁到共享 Redis 保留同一套代码路径。

当前仓库实现位置：

- `apps/web/lib/rate-limit.ts`

## 需要的环境变量

```env
ACRE_RATE_LIMIT_BACKEND="redis"
ACRE_RATE_LIMIT_REDIS_URL="redis://127.0.0.1:6380/0"
ACRE_TRUSTED_PROXY_TIER="none"
```

说明：

- `ACRE_RATE_LIMIT_BACKEND=redis` 会切到标准 Redis 后端
- `ACRE_RATE_LIMIT_REDIS_URL` 支持 `redis://` 和 `rediss://`
- 当前 DigitalOcean 生产机如继续使用现有本地 Redis，可先指向 `redis://127.0.0.1:6380/0`
- 如果未来改到托管 Redis，只需要替换连接串，不需要改代码

## 本地验证方式

推荐直接跑仓库自带测试：

```bash
npx tsx --test apps/web/lib/rate-limit.test.ts
```

这组测试会覆盖：

- memory 后端
- Upstash 后端
- Redis 后端的 routing
- Redis RESP 命令执行

## 服务器切换步骤

1. 编辑 `/etc/acre/acre-ui-rebuild.env`
2. 写入：

```env
ACRE_RATE_LIMIT_BACKEND="redis"
ACRE_RATE_LIMIT_REDIS_URL="redis://127.0.0.1:6380/0"
```

3. 重启服务：

```bash
sudo systemctl restart acre-ui-rebuild-web.service
```

4. 验证：

```bash
curl -s https://acresystem.us/api/health | jq .
```

然后对登录、邀请接受、改密、公开签字这些已接入限流的入口做一次正常访问确认。

## 回滚方式

如果 Redis 不可用或连接串有误：

1. 把 `ACRE_RATE_LIMIT_BACKEND` 改回 `memory`
2. 可以保留或删除 `ACRE_RATE_LIMIT_REDIS_URL`
3. 重启服务

## 适用边界

- `redis` 后端适合：
  - 单机多进程
  - 单机已有 Redis
  - 自建或托管 Redis 已可达
- 如果未来要跨多实例、并且更偏好 REST 方式而不是直接连 Redis，仍可继续使用 `upstash`
