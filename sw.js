/* ChronoNote service worker
 * 导航请求走「网络优先」——新版本部署后刷新即生效；
 * 静态资源（含 CDN）走「缓存优先 + 后台更新（Stale-While-Revalidate）」；
 * 第三方 API（DeepSeek / GitHub）一律直连，绝不进缓存——否则同步会读到旧 Gist。
 * 改版时请同步修改 CACHE 常量，旧缓存会在 activate 时清掉。
 */
const CACHE = 'chrononote-v1.7.1';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

/* 这些域名的请求必须直连，缓存会导致同步/AI 读到旧数据 */
const BYPASS_HOSTS = ['api.deepseek.com', 'api.github.com', 'gist.githubusercontent.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE).catch(() => { /* 个别资源失败不阻塞安装 */ }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let host = '';
  try { host = new URL(req.url).hostname; } catch (err) { host = ''; }
  if (BYPASS_HOSTS.indexOf(host) >= 0) return;   // 交给浏览器直连

  const put = (res) => {
    if (!res) return;
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  };

  /* 页面导航：网络优先，失败回退缓存，保证新版本不被旧缓存挡住 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => { put(res); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  /* 其他资源：先给缓存，同时在后台拉一次并更新（CDN 脚本/字体也一并缓存） */
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) put(res);
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
