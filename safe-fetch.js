import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';

export function validateUrl(input) {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('仅支持不含账号密码、使用标准端口的 HTTP/HTTPS 公网链接');
  url.hash = '';
  return url;
}
export function isPublicAddress(address) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export async function resolvePublic(url, resolver = lookup) {
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = ipaddr.isValid(hostname)
    ? [{ address: hostname, family: ipaddr.parse(hostname).kind() === 'ipv4' ? 4 : 6 }]
    : await resolver(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error('拒绝访问内网、回环或保留地址');
  return addresses;
}
// Validate every redirect and pin the resolved address to the connection.
export async function fetchPublic(input, { timeoutMs = 20000, maxBytes = 4 * 1024 * 1024, resolver = lookup, requestImpl } = {}) {
  const deadline = Date.now() + timeoutMs;
  let url = validateUrl(input);
  for (let hop = 0; hop <= 4; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('网页请求超时');
    let dnsTimer;
    const addresses = await Promise.race([
      resolvePublic(url, resolver),
      new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(new Error('DNS 查询超时')), remaining); }),
    ]).finally(() => clearTimeout(dnsTimer));
    const result = await new Promise((resolve, reject) => {
      const request = requestImpl ?? (url.protocol === 'https:' ? https.request : http.request);
      const req = request(url, {
        method: 'GET', agent: false,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PublicReader/0.2)', Accept: 'text/html,text/plain;q=0.9', 'Accept-Encoding': 'identity' },
        lookup: (_host, options, cb) => options.all ? cb(null, addresses) : cb(null, addresses[0].address, addresses[0].family),
      }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume(); resolve({ location: res.headers.location, status: res.statusCode }); return;
        }
        if (res.statusCode !== 200) { res.resume(); reject(new Error(`网页请求失败：HTTP ${res.statusCode}`)); return; }
        const type = res.headers['content-type'] ?? '';
        if (!/text\/(html|plain)|application\/xhtml\+xml/i.test(type)) { res.destroy(); reject(new Error('链接未返回 HTML 或纯文本正文')); return; }
        const chunks = []; let size = 0;
        res.on('data', chunk => { size += chunk.length; if (size > maxBytes) res.destroy(new Error('网页超过 4 MB 限制')); else chunks.push(chunk); });
        res.on('error', reject);
        res.on('end', () => {
          const charset = type.match(/charset=["']?([^;\s"']+)/i)?.[1] ?? 'utf-8';
          try { resolve({ html: new TextDecoder(charset).decode(Buffer.concat(chunks)), type, url: url.href }); }
          catch { reject(new Error('网页字符编码无法解码')); }
        });
      });
      const timer = setTimeout(() => req.destroy(new Error('网页请求超时')), Math.max(1, deadline - Date.now()));
      req.on('error', reject); req.on('close', () => clearTimeout(timer)); req.end();
    });
    if (result.html !== undefined) return result;
    if (!result.location) throw new Error('网页重定向缺少地址');
    url = validateUrl(new URL(result.location, url).href);
  }
  throw new Error('网页重定向次数过多');
}
