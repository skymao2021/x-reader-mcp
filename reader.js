export function extractPostId(input) {
  const value = input.trim();
  if (/^\d{1,25}$/.test(value)) return value;
  let url;
  try { url = new URL(value); } catch { throw new Error('请输入完整的 X/Twitter 帖子链接或数字 ID'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(url.hostname)) {
    throw new Error('仅支持 x.com 或 twitter.com 帖子链接');
  }
  const match = url.pathname.match(/^\/(?:[^/]+\/status(?:es)?|i\/web\/status)\/(\d{1,25})(?:\/(?:photo|video)\/\d+)?\/?$/);
  if (!match) throw new Error('无法识别帖子 ID');
  return match[1];
}

export async function fetchXPost(input, { fetchImpl = fetch, timeoutMs = 20000 } = {}) {
  const id = extractPostId(input);
  let response;
  try {
    response = await fetchImpl(`https://api.fxtwitter.com/2/status/${id}`, {
      headers: { 'User-Agent': 'X-Reader-MCP/0.1', Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('FxTwitter 请求超时，请稍后重试');
    throw new Error('无法连接 FxTwitter，请检查网络后重试');
  }
  if (!response.ok) throw new Error(`FxTwitter 请求失败：HTTP ${response.status}`);
  let data;
  try { data = await response.json(); } catch { throw new Error('FxTwitter 返回了无效 JSON'); }
  if (data?.code !== 200 || !data.status || typeof data.status !== 'object' || Array.isArray(data.status)) {
    throw new Error(`读取失败：${String(data?.message || data?.error || 'Post not found').slice(0, 300)}`);
  }
  return data.status;
}
