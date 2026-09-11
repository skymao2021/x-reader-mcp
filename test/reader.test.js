import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { extractPostId, fetchXPost } from '../reader.js';
import { createHttpServer } from '../server.js';

test('accepted links and rejection of lookalike domains', () => {
  for (const value of ['123', 'https://x.com/user/status/123?s=20', 'https://twitter.com/u/statuses/123', 'https://x.com/i/web/status/123', 'https://x.com/u/status/123/photo/1']) assert.equal(extractPostId(value), '123');
  for (const value of ['https://evil.com/x.com/u/status/123', 'https://x.com.evil.com/u/status/123', 'https://x.com/u', 'https://x.com/u/status/123oops', 'file:///123']) assert.throws(() => extractPostId(value));
});

test('preserves nested article, quote and media', async () => {
  const status = { id: '123', article: { content: { blocks: [{ text: '正文' }] } }, quote: { text: '引用' }, media: { photos: ['image'] } };
  assert.deepEqual(await fetchXPost('123', { fetchImpl: async (url) => {
    assert.equal(url, 'https://api.fxtwitter.com/2/status/123');
    return Response.json({ code: 200, status });
  } }), status);
});

test('upstream errors, invalid JSON and timeout are visible', async () => {
  for (const [fetchImpl, pattern] of [
    [async () => new Response('', { status: 429 }), /HTTP 429/],
    [async () => Response.json({ code: 404, message: 'Not found' }), /Not found/],
    [async () => new Response('<html>'), /JSON/],
    [async () => { throw new DOMException('timeout', 'TimeoutError'); }, /超时/],
  ]) await assert.rejects(fetchXPost('123', { fetchImpl }), pattern);
});

test('MCP HTTP initialization, discovery, call and error result', async () => {
  const server = createHttpServer(async (url) => ({ id: extractPostId(url), text: '测试' }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/mcp`;
  const client = new Client({ name: 'test', version: '1.0.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
    const { tools } = await client.listTools();
    assert.equal(tools.length, 2);
    assert.equal(tools[0].name, 'read_x_post');
    assert.equal(tools[0].annotations.readOnlyHint, true);
    const result = await client.callTool({ name: 'read_x_post', arguments: { url: '123' } });
    assert.equal(result.structuredContent.post.text, '测试');
    assert.equal((await client.callTool({ name: 'read_x_post', arguments: { url: 'bad' } })).isError, true);
    assert.equal((await fetch(endpoint, { headers: { Origin: 'https://example.com' } })).status, 403);
    assert.equal((await fetch(endpoint)).status, 405);
  } finally {
    await client.close();
    await new Promise(resolve => server.close(resolve));
  }
});
