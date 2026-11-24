// 앱 셸을 캐시해 오프라인에서도 열리게 하는 서비스워커.
// 앱 파일을 수정해 배포할 때는 VERSION을 올려서 이전 캐시를 비운다.
const VERSION = 'v12';
const CORE = [
  './', 'index.html', 'data.js', 'tailwind.css', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// stale-while-revalidate: 캐시를 즉시 돌려주고 뒤에서 최신본으로 갱신한다.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !/^https?:/.test(req.url)) return;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; })
        .catch(() => null);
      if (cached) return cached;
      const res = await network;
      if (res) return res;
      if (req.mode === 'navigate') return cache.match('index.html');
      return Response.error();
    })
  );
});
