# 部署与维护

将本仓库克隆到自己的服务器，确保 Docker Engine 和 Docker Compose 可用。

```sh
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8787/
```

## 临时 HTTPS

```sh
docker compose -f compose.yaml -f compose.tunnel.yaml up -d
docker logs x-reader-tunnel
```

隧道仅转发到本项目 `x-reader:8787`，不需要开放服务器入站端口。取得 HTTPS 地址后加上 `/mcp` 用于连接客户端。该配置没有认证，适用于临时测试，不应把它当作长期稳定的公开托管服务。

[Cloudflare Quick Tunnel 文档](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/)

## 日志与停止

```sh
docker logs --tail 30 x-reader-mcp
docker logs --tail 30 x-reader-tunnel
# 停止并移除本项目容器和网络，保留源码与镜像
docker compose -f compose.yaml -f compose.tunnel.yaml down
```

容器设置 `restart: unless-stopped`。重启隧道可能生成新 URL，需要更新客户端连接。固定域名可通过自己的反向代理或命名隧道配置，HTTPS 证书和访问控制由部署者维护。

## 发布前检查

个人服务器地址、凭据、隧道 URL、日志和部署记录应保存在仓库外。仅提交通用模板，不提交 `.env`、私钥或 `node_modules`。
