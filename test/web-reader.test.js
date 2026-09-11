import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { validateUrl, resolvePublic, fetchPublic } from '../safe-fetch.js';
import { readWebPage, extractPage } from '../web-reader.js';
const text = '这是一段公开文章正文，介绍网页提取、来源记录与真实验证。'.repeat(30);
test('rejects SSRF destinations including encoded and mapped addresses', async () => {
  for (const url of ['file:///etc/passwd', 'http://user:pass@example.com', 'http://example.com:8080']) assert.throws(() => validateUrl(url));
  for (const url of ['http://127.1', 'http://2130706433', 'http://[::1]', 'http://[::ffff:127.0.0.1]', 'http://169.254.169.254', 'http://10.0.0.1']) await assert.rejects(resolvePublic(validateUrl(url)), /拒绝/);
  await assert.rejects(resolvePublic(new URL('https://example.com'), async () => [{ address: '127.0.0.1', family: 4 }]), /拒绝/);
});
test('redirects cannot reach private hosts; request uses pinned public DNS', async () => {
  let requests = 0;
  await assert.rejects(fetchPublic('https://example.com', {
    resolver: async () => [{ address: '93.184.216.34', family: 4 }],
    requestImpl: (url, options, callback) => {
      requests++;
      options.lookup(url.hostname, { all: true }, (error, addresses) => assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]));
      const req = new EventEmitter();
      req.end = () => { callback({ statusCode: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' }, resume() {} }); req.emit('close'); };
      req.destroy = () => {};
      return req;
    },
  }), /拒绝/);
  assert.equal(requests, 1);
});
test('WeChat extraction preserves body and rejects captcha page', async () => {
  const page = { url: 'https://mp.weixin.qq.com/s/test', type: 'text/html', html: `<html><head><meta property="og:title" content="测试文章"></head><body><div id="js_content" style="display:none"><p>${text}</p></div></body></html>` };
  const result = await readWebPage(page.url, { fetchPage: async () => page });
  assert.equal(result.title, '测试文章'); assert.equal(result.extractor, 'wechat_js_content'); assert.ok(result.content.includes(text));
  await assert.rejects(extractPage({ ...page, html: '<html><body>环境异常，请验证</body></html>' }), /未返回正文/);
});
test('generic article returns Markdown; X routes to original reader', async () => {
  const page = { url: 'https://example.com/article', type: 'text/html', html: `<html><head><title>Example</title></head><body><article><h1>Example</h1><p>${text}</p></article></body></html>` };
  const result = await readWebPage(page.url, { fetchPage: async () => page });
  assert.ok(result.content.includes(text)); assert.equal(result.format, 'markdown');
  const post = { id: '123', article: { text: 'Full article' } };
  assert.deepEqual((await readWebPage('https://x.com/u/status/123', { xReader: async () => post })).post, post);
});
