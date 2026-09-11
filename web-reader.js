import { Worker } from 'node:worker_threads';
import { fetchPublic, validateUrl } from './safe-fetch.js';
import { fetchXPost } from './reader.js';

export function extractPage(data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./extract-worker.js', import.meta.url), { workerData: data, resourceLimits: { maxOldGenerationSizeMb: 128 }, execArgv: [] });
    const timer = setTimeout(() => { reject(new Error('正文解析超时')); void worker.terminate(); }, 10000);
    worker.once('message', ({ result, error }) => { clearTimeout(timer); void worker.terminate(); error ? reject(new Error(error)) : resolve(result); });
    worker.once('error', error => { clearTimeout(timer); reject(error); });
    worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('正文解析进程退出')); });
  });
}
let active = 0;
export async function readWebPage(input, { fetchPage = fetchPublic, xReader = fetchXPost } = {}) {
  const url = validateUrl(input);
  if (active >= 2) throw new Error('网页读取繁忙，请稍后重试');
  active++;
  try {
    if (['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(url.hostname)) {
      const post = await xReader(url.href);
      return { source_url: url.href, extractor: 'fxtwitter', post, retrieved_at: new Date().toISOString() };
    }
    const page = await fetchPage(url.href);
    const result = await extractPage(page);
    if (result.content.trim().length < 120) throw new Error('未提取到足够的正文；页面可能依赖 JavaScript、需要登录或不属于文章页');
    const maxLength = 60000;
    return { source_url: url.href, final_url: page.url, ...result, content: result.content.slice(0, maxLength), format: 'markdown', truncated: result.content.length > maxLength, retrieved_at: new Date().toISOString() };
  } finally { active--; }
}
