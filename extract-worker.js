import { parentPort, workerData } from 'node:worker_threads';
import { parseHTML } from 'linkedom';
import { Defuddle } from 'defuddle/node';

async function extract({ html, url, type }) {
  if (type.startsWith('text/plain')) return { title: '', content: html, extractor: 'plain_text' };
  const { document } = parseHTML(html);
  const host = new URL(url).hostname;
  const meta = name => document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.getAttribute('content') ?? '';
  const title = meta('og:title') || document.querySelector('#activity-name')?.textContent.trim() || document.title || '';
  const wechat = host === 'mp.weixin.qq.com';
  if (wechat && !document.querySelector('#js_content')) throw new Error('微信公众号未返回正文，可能需要验证、登录或文章已失效；不能把提示页当成文章');
  if (!wechat && /just a moment|access denied|verify you are human|captcha|登录|安全验证/i.test(title)) throw new Error('网站返回访问验证或登录页面，无法提取公开正文');
  document.querySelectorAll('img[data-src]').forEach(img => img.setAttribute('src', img.getAttribute('data-src')));
  const result = await Defuddle(document, url, {
    markdown: true, useAsync: false,
    fetch: async () => { throw new Error('提取器不允许额外联网'); },
    ...(wechat ? { contentSelector: '#js_content', removeHiddenElements: false, removeLowScoring: false, removeContentPatterns: false } : {}),
  });
  return {
    title: title || result.title || '', author: meta('author') || result.author || '',
    published: result.published || '', content: result.contentMarkdown || result.content || '',
    extractor: wechat ? 'wechat_js_content' : 'defuddle',
  };
}
try { parentPort.postMessage({ result: await extract(workerData) }); }
catch (error) { parentPort.postMessage({ error: error.message }); }
