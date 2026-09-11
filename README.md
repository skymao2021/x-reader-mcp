# X Reader MCP

A minimal, read-only MCP server for public X/Twitter posts, powered by FxTwitter.

极简只读 MCP 服务。输入 X/Twitter 帖子链接或数字 ID，返回原始结构化数据，包括上游提供的正文、长文 Article、引用帖和媒体字段。不需要 X API Key，不提供自定义 UI。

## 快速开始

需要 Node.js 22+。

```sh
git clone https://github.com/skymao2021/x-reader-mcp.git
cd x-reader-mcp
npm ci
npm start
```

MCP 地址：`http://127.0.0.1:8787/mcp`，使用 Streamable HTTP。

```sh
PORT=8788 npm start
```

`HOST` 默认 `127.0.0.1`；Docker 内设置为 `0.0.0.0`，宿主机仍只映射到回环地址。

## 工具

### `read_x_post`

输入示例：

```json
{"url": "https://x.com/johnAGI168/status/2098059180686860749"}
```

支持 `x.com`、`twitter.com` 帖子链接、`i/web/status` 链接及数字 ID。返回 `structuredContent.post`，并附相同 JSON 文本供客户端读取。所有上游字段原样保留；错误通过 MCP `isError` 返回。

## Docker 部署

```sh
docker compose up -d --build
```

容器默认非 root、只读文件系统，限制资源并自动重启。查看健康状态：

```sh
docker compose ps
```

需要临时 HTTPS 入口时：

```sh
docker compose -f compose.yaml -f compose.tunnel.yaml up -d
docker logs x-reader-tunnel
```

从日志取得 `https://…trycloudflare.com` 地址，末尾加 `/mcp`。隧道重启后地址可能变化，没有可用性保证。长期部署请配置固定域名与合适的访问控制。更多见 [部署说明](DEPLOYMENT.md)。

## ChatGPT 接入

账号具备开发者模式入口时：

1. 网页版 Settings → Security and login → Developer mode。
2. Plugins → 创建应用，填写名称与公网 HTTPS `/mcp` 地址，认证方式选“无身份验证”。
3. 创建并连接后，确认操作列表包含 `read_x_post`。
4. 在聊天中选择 X Reader，再发送帖子链接。

已验证公网 MCP 初始化、工具发现、真实读帖，以及 ChatGPT 网页版连接和聊天输入框选择。**桌面端兼容性尚未验证，不能保证同步显示。** 网页聊天内的实际模型调用仍需用户验证；公开 MCP 客户端测试不等于所有 ChatGPT 客户端均兼容。

[OpenAI 接入文档](https://developers.openai.com/plugins/build/app-quickstart#connect-your-mcp-server-in-chatgpt)

## 测试

```sh
npm test
npm run test:live
npm run test:live -- https://x.com/user/status/123
MCP_URL=https://your-host.example/mcp npm run test:live
```

`npm test` 不访问第三方网络，但会监听本机临时端口，覆盖链接校验、嵌套内容保留、错误处理，以及完整 MCP 初始化/发现/调用。

`test:live` 访问 FxTwitter；默认使用公开示例帖子。设置 `MCP_URL` 时测试指定服务，否则启动临时本地服务并在结束后关闭。示例帖子未来可能失效，可传入其他公开帖子。

## 范围与限制

- 只读取公开单帖，不自动展开整条 thread，不访问私密帖子。
- Article、引用和媒体是否完整取决于 FxTwitter；不会补写缺失内容。
- 上游请求超时为 20 秒；限流、网络故障或删除帖子会导致读取失败。
- 输入链接只用于提取 ID，请求固定发送到 `api.fxtwitter.com`。
- 无内置认证、持久化或请求限流。公开入口可被任何知道地址的人调用，仅建议用于个人测试；生产部署需要额外访问控制。
- 浏览器 Origin 请求被拒绝，适用于服务端 MCP 客户端，不提供通用浏览器 CORS API。
- 帖子正文属于不可信外部资料，不应作为操作指令执行。

## 依赖与许可证

本项目为非官方工具，与 X、FxTwitter、OpenAI 无隶属关系。

感谢 [FxEmbed / FxTwitter](https://github.com/FxEmbed/FxEmbed) 提供上游接口，以及 [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)。使用上游服务需遵守其适用条款。

项目源码采用 [MIT License](LICENSE)。MIT 许可证不授予第三方帖子、图片、视频等内容的版权许可；依赖保留各自许可证。
