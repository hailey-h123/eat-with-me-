// Cloudflare Worker: 高德 REST API 代理
// 前端不携带任何 Key，只 POST 到这个 Worker，Worker 服务端注入 Key 后调高德。
//
// 部署后在 Cloudflare Dashboard 设置两个 Secret（环境变量）：
//   AMAP_WEB_KEY  - 高德 Web 服务 Key（你新建的那个）
//   AMAP_SCODE    - 高德安全密钥（可选，有就加上）

const ALLOWED_ORIGINS = [
  /^https:\/\/hailey-h123\.github\.io$/,
  /^http:\/\/localhost:\d+$/,  // 允许任意 localhost 端口开发
];

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return handleCORS(request);
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('OK', { status: 200 });
    if (url.pathname === '/amap') return handleAmapProxy(request, env);
    return new Response('Not Found', { status: 404 });
  },
};

function isAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(rx => rx.test(origin));
}

function handleCORS(request) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (isAllowed(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(null, { status: 204, headers });
}

async function handleAmapProxy(request, env) {
  const origin = request.headers.get('Origin');
  const corsHeaders = isAllowed(origin) ? { 'Access-Control-Allow-Origin': origin } : {};

  if (request.method !== 'POST') {
    return json({ status: '0', info: 'METHOD_NOT_ALLOWED', infocode: 'PROXY_405' }, 405, corsHeaders);
  }

  try {
    const { path, params } = await request.json();

    // 防 SSRF：path 必须是 /v{数字}/ 开头的高德 API 路径
    if (!path || !/^\/v\d+\//.test(path)) {
      return json({ status: '0', info: 'INVALID_PATH', infocode: 'PROXY_001' }, 400, corsHeaders);
    }

    // Worker 端注入 Key + 安全密钥，前端永远看不到
    const fullParams = { ...params, key: env.AMAP_WEB_KEY };
    if (env.AMAP_SCODE) fullParams.scode = env.AMAP_SCODE;

    const amapUrl = `https://restapi.amap.com${path}?${new URLSearchParams(fullParams)}`;
    const res = await fetch(amapUrl);
    const data = await res.json();

    return json(data, 200, corsHeaders);
  } catch (err) {
    return json({ status: '0', info: String(err), infocode: 'PROXY_500' }, 500, corsHeaders);
  }
}

function json(obj, status, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
