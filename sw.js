/* ChronoNote service worker
 * 导航请求走「网络优先」——新版本部署后刷新即生效；
 * 静态资源（含 CDN）走「缓存优先 + 运行时写入」——断网也能打开。
 * 改版时请同步修改 CACHE 常量，旧缓存会在 activate 时清掉。
 */
const CACHE = 'chrononote-v1.5.1';
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

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

  /* 页面导航：网络优先，失败回退缓存，保证新版本不被旧缓存挡住 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  /* 其他资源：缓存优先，未命中则取网络并写入缓存（含 CDN 脚本/字体） */
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => hit);
    })
  );
});
