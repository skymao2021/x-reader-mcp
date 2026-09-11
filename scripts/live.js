import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHttpServer } from '../server.js';

const url = process.argv[2] || 'https://x.com/johnAGI168/status/2098059180686860749';
const server = process.env.MCP_URL ? null : createHttpServer();
if (server) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = process.env.MCP_URL || `http://127.0.0.1:${server.address().port}/mcp`;
const client = new Client({ name: 'live-check', version: '1.0.0' });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
  const { tools } = await client.listTools();
  assert.equal(tools[0].name, 'read_x_post');
  const result = await client.callTool({ name: 'read_x_post', arguments: { url } });
  assert.ok(!result.isError, JSON.stringify(result.content));
  const post = result.structuredContent.post;
  assert.ok(post.id);
  console.log(JSON.stringify({ ok: true, tool: tools[0].name, id: post.id, text: post.text, articleTitle: post.article?.title, articleBytes: Buffer.byteLength(JSON.stringify(post.article ?? null)), hasMedia: Boolean(post.media), responseBytes: Buffer.byteLength(JSON.stringify(post)) }, null, 2));
} finally {
  await client.close();
  if (server) await new Promise(resolve => server.close(resolve));
}
