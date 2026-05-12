// sw.js — Marina service worker
// Basado en Dótir v4. Para actualizar: sube CACHE_VERSION únicamente.
//
// Estrategias por tipo de recurso:
//   App shell same-origin  → Cache-first, precache en install (fail-fast)
//   CDN JS / fuentes       → Cache-first, lazy, opaque-ok
//   Audio (.mp3/.ogg/.wav) → Cache-first, lazy, cuota protegida (50 MB)
//   Navegación             → Network-first, timeout 3s, fallback a index.html
//   Todo lo demás          → Stale-while-revalidate

const CACHE_VERSION    = 'marina-v1-2026-05-12';
const AUDIO_QUOTA_MIN  = 50 * 1024 * 1024; // 50 MB mínimo libre para cachear audio
const NAV_TIMEOUT_MS   = 3000;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './marina.config.json',
  './app.js',
  './shell.js',
  './home.js',
  './shared.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-256.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

const APP_SHELL_CDN = [
  'https://unpkg.com/react@18.3.1/umd/react.development.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;800&family=Lexend:wght@400;500;600;700&display=swap',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const openCache   = () => caches.open(CACHE_VERSION);
const isAudio     = (url) => /\.(mp3|ogg|wav|m4a|aac)(\?|$)/i.test(url);
const isFont      = (url) => /\.(woff2?|ttf|otf)(\?|$)/i.test(url) || url.includes('fonts.gstatic.com');
const isCdnOpaque = (url) =>
  url.startsWith('https://unpkg.com') ||
  url.startsWith('https://fonts.googleapis.com') ||
  url.startsWith('https://fonts.gstatic.com');

async function hasQuota(minBytes) {
  if (!navigator.storage?.estimate) return true;
  try {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    return (quota - usage) > minBytes;
  } catch { return true; }
}

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      (r) => { clearTimeout(t); resolve(r); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await openCache();
    // Same-origin: fallo explícito si falta un archivo
    await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })));
    // CDN: best-effort, no bloquea install
    await Promise.allSettled(
      APP_SHELL_CDN.map((url) =>
        cache.add(new Request(url, { mode: 'no-cors', cache: 'reload' }))
          .catch((err) => console.warn('[sw] CDN miss:', url, err))
      )
    );
    self.skipWaiting();
  })());
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request: req } = e;
  const url = req.url;
  if (req.method !== 'GET' || !url.startsWith('http')) return;

  if (req.mode === 'navigate')         { e.respondWith(handleNav(req));          return; }
  if (isAudio(url))                    { e.respondWith(handleAudio(req));         return; }
  if (isCdnOpaque(url) || isFont(url)) { e.respondWith(handleCacheFirst(req, true)); return; }
  e.respondWith(handleSWR(req));
});

async function handleNav(req) {
  const cache = await openCache();
  try {
    const res = await fetchWithTimeout(req, NAV_TIMEOUT_MS);
    if (res.ok) { cache.put(req, res.clone()).catch(() => {}); return res; }
    throw new Error('non-ok');
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true }) ?? await cache.match('./index.html');
    if (hit) return hit;
    return new Response('<h1>Sin conexión</h1>', {
      headers: { 'Content-Type': 'text/html;charset=utf-8' }, status: 503,
    });
  }
}

async function handleCacheFirst(req, allowOpaque = false) {
  const cache = await openCache();
  const hit   = await cache.match(req);
  if (hit) {
    fetch(req).then((r) => {
      if (r && (r.ok || (allowOpaque && r.type === 'opaque'))) cache.put(req, r.clone()).catch(() => {});
    }).catch(() => {});
    return hit;
  }
  const res = await fetch(req);
  if (res && (res.ok || (allowOpaque && res.type === 'opaque'))) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function handleSWR(req) {
  const cache   = await openCache();
  const hit     = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then((r) => {
    if (r?.ok) cache.put(req, r.clone()).catch(() => {});
    return r;
  }).catch(() => null);
  return hit ?? await network ?? new Response('', { status: 503 });
}

async function handleAudio(req) {
  const cache = await openCache();
  const hit   = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res?.ok && await hasQuota(AUDIO_QUOTA_MIN)) cache.put(req, res.clone()).catch(() => {});
  return res;
}

// ─── Mensajes desde la app ────────────────────────────────────────────────────
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
