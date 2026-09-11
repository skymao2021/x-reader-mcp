# X Reader MCP

A read-only MCP server for public web articles, WeChat and X/Twitter, powered by Defuddle and FxTwitter.

只读 MCP 服务。读取普通公开网页、微信公众号文章和 X/Twitter 帖子。网页返回 Markdown 与来源信息；X 保留上游提供的正文、Article、引用帖和媒体字段。不需要付费 API Key。

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

### `read_web_page`

输入 `{"url": "https://example.com/article"}`，返回 `structuredContent.article`。

- 普通网页：获取 HTML，再用 Defuddle 提取正文及 Markdown。
- 微信公众号：优先提取 `#js_content` 正文，保留隐藏正文与懒加载图片地址。
- X/Twitter 帖子：自动路由 FxTwitter，结果的 `post` 字段保留完整结构。
- 返回来源链接、最终链接、提取方式、抓取时间；正文超过 60,000 字符时明确标记 `truncated`。

只适用于可公开读取的内容。公众号可能因访问环境返回验证页，此时工具明确报错；不能保证每篇公众号都可读取。当前不执行网页 JavaScript，不接入浏览器登录状态、Jina 或付费 Metaso，也不解决验证码。

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
3. 创建并连接后，确认操作列表包含 `read_x_post` 和 `read_web_page`。
4. 在聊天中选择 X Reader，再发送文章或帖子链接。已有连接在服务升级后，需要在插件设置页点击 Refresh 刷新工具。

已验证公网 MCP 初始化、工具发现、真实读帖，以及 ChatGPT 网页版连接和聊天输入框选择。**桌面端兼容性尚未验证，不能保证同步显示。** 网页聊天内的实际模型调用仍需用户验证；公开 MCP 客户端测试不等于所有 ChatGPT 客户端均兼容。

[OpenAI 接入文档](https://developers.openai.com/plugins/build/app-quickstart#connect-your-mcp-server-in-chatgpt)

## 测试

```sh
npm test
npm run test:live
npm run test:live -- https://x.com/user/status/123
node scripts/live-web.js https://www.paulgraham.com/words.html
MCP_URL=https://your-host.example/mcp npm run test:live
```

`npm test` 不访问第三方网络，但会监听本机临时端口，覆盖链接校验、嵌套内容保留、错误处理，以及完整 MCP 初始化/发现/调用。

`scripts/live-web.js` 验证通用网页工具，也支持 `MCP_URL`。本版本已通过公网 MCP 验证普通网页与 X 读取；公众号访问受微信风控影响，可能成功也可能返回验证页。

`test:live` 访问 FxTwitter；默认使用公开示例帖子。设置 `MCP_URL` 时测试指定服务，否则启动临时本地服务并在结束后关闭。示例帖子未来可能失效，可传入其他公开帖子。

## 范围与限制

- X 只读取公开单帖，不自动展开整条 thread，不访问私密帖子。
- Article、引用和媒体是否完整取决于 FxTwitter；不会补写缺失内容。
- 上游请求超时为 20 秒；限流、网络故障或删除帖子会导致读取失败。
- X 请求固定发送到 `api.fxtwitter.com`；网页抓取仅接受标准 HTTP/HTTPS 公网地址，每次重定向重新验证，并把 DNS 结果固定到实际连接，拒绝内网、回环和保留地址。
- 网页下载限制 4 MB / 20 秒；独立解析线程限制 128 MB / 10 秒，最多并发读取两个网页。
- 无内置认证、持久化或请求限流。公开入口可被任何知道地址的人调用，仅建议用于个人测试；生产部署需要额外访问控制。
- 浏览器 Origin 请求被拒绝，适用于服务端 MCP 客户端，不提供通用浏览器 CORS API。
- 帖子正文属于不可信外部资料，不应作为操作指令执行。

## 依赖与许可证

本项目为非官方工具，与 X、FxTwitter、OpenAI 无隶属关系。

抓取流程借鉴 [Web Clipper](https://github.com/zjp1997720/zhijian-skills/blob/main/docs/skills/web-clipper/README.zh-CN.md) 的站点分流、正文提取与来源记录思路；本项目独立实现 MCP 与网络访问边界，没有安装或直接复制其 Python 脚本。网页解析使用 [Defuddle](https://github.com/kepano/defuddle)。

感谢 [FxEmbed / FxTwitter](https://github.com/FxEmbed/FxEmbed) 提供上游接口，以及 [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)。使用上游服务需遵守其适用条款。

项目源码采用 [MIT License](LICENSE)。MIT 许可证不授予第三方帖子、图片、视频等内容的版权许可；依赖保留各自许可证。
