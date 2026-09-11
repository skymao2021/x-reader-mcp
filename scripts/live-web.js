import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHttpServer } from '../server.js';
const url = process.argv[2] || 'https://www.paulgraham.com/words.html';
const server = process.env.MCP_URL ? null : createHttpServer();
if (server) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = process.env.MCP_URL || `http://127.0.0.1:${server.address().port}/mcp`;
const client = new Client({ name: 'live-web-check', version: '1.0.0' });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
  const { tools } = await client.listTools();
  assert.ok(tools.some(tool => tool.name === 'read_web_page'));
  const result = await client.callTool({ name: 'read_web_page', arguments: { url } });
  assert.ok(!result.isError, JSON.stringify(result.content));
  const article = result.structuredContent.article;
  assert.ok(article.content?.length >= 120 || article.post?.id);
  console.log(JSON.stringify({ tools: tools.map(tool => tool.name), title: article.title, extractor: article.extractor, length: article.content?.length, truncated: article.truncated }, null, 2));
} finally {
  await client.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
