/**
 * Cloudflare Worker — eat-with-me 后端代理
 *
 * 作用：前端不带任何 Key 调这里，这里用「Worker 环境变量 Secret」里的 Key 转调高德/DeepSeek。
 * 这样 Web 服务 Key + DeepSeek Key 永不进入前端 bundle，用户 F12 看不到。
 *
 * 部署步骤：
 * 1. Cloudflare 控制台 → Workers & Pages → 创建 Worker，粘贴本文件
 * 2. Settings → Variables and Secrets 添加（类型选 Secret）：
 *    - AMAP_WEB_KEY        高德 Web 服务 Key
 *    - AMAP_SECURITY_CODE  高德安全密钥（若没开启数字签名可留空）
 *    - DEEPSEEK_API_KEY    DeepSeek Key
 *    - DEEPSEEK_BASE_URL   默认 https://api.deepseek.com（可留空）
 * 3. 可选：绑定 Rate Limiting（真·防刷的核心，Origin 白名单可被伪造）
 * 4. 记下 Worker 的 URL，填到前端 .env 的 VITE_AMAP_PROXY_URL / VITE_LLM_PROXY_URL
 */

const ALLOWED_ORIGINS = [
  'https://hailey-h123.github.io',
  // Cloudflare 上托管的同项目前端（Workers 静态部署）
  'https://eat-with-me.15122319805.workers.dev',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
];

function cors(origin, status = 200) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function reject(origin, body, status) {
  return new Response(JSON.stringify(body), { status, headers: cors(origin, status) });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (request.method !== 'POST') {
      return reject(origin, { error: 'Method Not Allowed' }, 405);
    }

    // Origin 白名单（提高门槛，可被伪造；真正的防刷靠 Cloudflare Rate Limiting）
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      return reject(origin, { error: 'Forbidden' }, 403);
    }

    // ===== 路由：/llm =====
    if (url.pathname === '/llm') {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.text !== 'string' || !body.text.trim()) {
        return reject(origin, { error: 'Bad Request: text required' }, 400);
      }
      const apiKey = env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        return reject(origin, { error: 'Server Misconfigured: DEEPSEEK_API_KEY' }, 500);
      }
      const base = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

      const upstream = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: body.system || '你是餐厅推荐系统的意图解析器。' },
            { role: 'user', content: body.text },
          ],
          temperature: 0.1,
          max_tokens: 300,
        }),
      });

      const data = await upstream.json();
      return new Response(JSON.stringify(data), { status: 200, headers: cors(origin) });
    }

    // ===== 路由：/amap =====
    if (url.pathname === '/amap') {
      const body = await request.json().catch(() => null);
      if (!body || typeof body.path !== 'string' || !body.path) {
        return reject(origin, { error: 'Bad Request: path required' }, 400);
      }
      const apiKey = env.AMAP_WEB_KEY;
      if (!apiKey) {
        return reject(origin, { error: 'Server Misconfigured: AMAP_WEB_KEY' }, 500);
      }

      const params = new URLSearchParams(body.params || {});
      params.set('key', apiKey);
      const scode = env.AMAP_SECURITY_CODE;
      if (scode) params.set('scode', scode);

      const amapUrl = `https://restapi.amap.com${body.path}?${params.toString()}`;
      const upstream = await fetch(amapUrl, { method: 'GET' });
      const data = await upstream.json();
      return new Response(JSON.stringify(data), { status: 200, headers: cors(origin) });
    }

    return reject(origin, { error: 'Not Found' }, 404);
  },
};
