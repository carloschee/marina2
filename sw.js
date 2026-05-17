// sw.js — Marina 2 service worker
// Para actualizar: sube CACHE_VERSION únicamente.
//
// Estrategias:
//   App shell + assets-manifest.json  → Cache-first, precache en install
//   CDN JS / fuentes                  → Cache-first, lazy, opaque-ok
//   Audio (.mp3/.ogg/.wav)            → Cache-first, lazy, cuota protegida
//   Navegación                        → Network-first, timeout 3s, fallback index.html
//   Todo lo demás                     → Stale-while-revalidate

const CACHE_VERSION = 'marina2-v2-2026-05-17';
const AUDIO_QUOTA_MIN = 50 * 1024 * 1024; // 50 MB mínimo libre para audio
const NAV_TIMEOUT_MS  = 3000;

// Shell mínimo garantizado — siempre se precachea aunque el manifiesto falle
const SHELL_FALLBACK = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './app.config.json',
];

const CDN_PRECACHE = [
  'https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Outfit:wght@700;800;900&display=swap',
];

// ── Helpers ───────────────────────────────────────────────────
const openCache   = () => caches.open(CACHE_VERSION);
const isAudio     = url => /\.(mp3|ogg|wav|m4a|aac)(\?|$)/i.test(url);
const isFont      = url => /\.(woff2?|ttf|otf)(\?|$)/i.test(url) || url.includes('fonts.gstatic.com');
const isCdnOpaque = url =>
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
      r => { clearTimeout(t); resolve(r); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

// ── Install ───────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await openCache();

    // 1. Intentar cargar assets-manifest.json para precache completo
    let urlsToPrecache = [...SHELL_FALLBACK];
    try {
      const res = await fetch('./assets-manifest.json', { cache: 'no-store' });
      if (res.ok) {
        const manifest = await res.json();
        // El manifiesto ya incluye el shell, usarlo completo
        urlsToPrecache = manifest.urls || SHELL_FALLBACK;
        console.log(`[SW] Precacheando ${urlsToPrecache.length} assets desde manifiesto`);
      }
    } catch (e) {
      console.warn('[SW] assets-manifest.json no disponible, usando shell fallback:', e.message);
    }

    // 2. Precachear same-origin (fail-fast para detectar archivos faltantes)
    const sameOrigin = urlsToPrecache.filter(u => !u.startsWith('http'));
    await Promise.allSettled(
      sameOrigin.map(url =>
        cache.add(new Request(url, { cache: 'reload' }))
          .catch(e => console.warn('[SW] Precache miss:', url, e.message))
      )
    );

    // 3. CDN best-effort
    await Promise.allSettled(
      CDN_PRECACHE.map(url =>
        cache.add(new Request(url, { mode: 'no-cors', cache: 'reload' }))
          .catch(e => console.warn('[SW] CDN miss:', url, e.message))
      )
    );

    self.skipWaiting();
  })());
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request: req } = event;
  const url = req.url;
  if (req.method !== 'GET' || !url.startsWith('http')) return;

  if (req.mode === 'navigate')         { event.respondWith(handleNav(req));              return; }
  if (isAudio(url))                    { event.respondWith(handleAudio(req));             return; }
  if (isCdnOpaque(url) || isFont(url)) { event.respondWith(handleCacheFirst(req, true)); return; }
  event.respondWith(handleSWR(req));
});

async function handleNav(req) {
  const cache = await openCache();
  try {
    const res = await fetchWithTimeout(req, NAV_TIMEOUT_MS);
    if (res.ok) { cache.put(req, res.clone()).catch(() => {}); return res; }
    throw new Error('non-ok');
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true })
              ?? await cache.match('./index.html');
    if (hit) return hit;
    return new Response('<h1>Sin conexión</h1>',
      { headers: { 'Content-Type': 'text/html;charset=utf-8' }, status: 503 });
  }
}

async function handleCacheFirst(req, allowOpaque = false) {
  const cache = await openCache();
  const hit   = await cache.match(req);
  if (hit) {
    fetch(req).then(r => {
      if (r && (r.ok || (allowOpaque && r.type === 'opaque')))
        cache.put(req, r.clone()).catch(() => {});
    }).catch(() => {});
    return hit;
  }
  const res = await fetch(req);
  if (res && (res.ok || (allowOpaque && res.type === 'opaque')))
    cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function handleSWR(req) {
  const cache   = await openCache();
  const hit     = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then(r => {
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
  if (res?.ok && await hasQuota(AUDIO_QUOTA_MIN))
    cache.put(req, res.clone()).catch(() => {});
  return res;
}

// ── Mensajes desde la app ─────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING')   self.skipWaiting();
  if (event.data?.tipo === 'heartbeat')      { /* keepalive — no-op */ }

  // Precache bajo demanda (llamado desde offline.js → precachear())
  if (event.data?.tipo === 'precache') {
    const urls = event.data.urls || [];
    caches.open(CACHE_VERSION).then(async cache => {
      let ok = 0;
      await Promise.allSettled(
        urls.map(url =>
          cache.add(new Request(url, { cache: 'reload' }))
            .then(() => ok++)
            .catch(() => {})
        )
      );
      event.source?.postMessage({ tipo: 'precache-done', ok, total: urls.length });
    });
  }

  // Check de cache (llamado desde offline.js → estaEnCache())
  if (event.data?.tipo === 'check') {
    caches.open(CACHE_VERSION).then(async cache => {
      const hit = await cache.match(event.data.url);
      event.source?.postMessage({ tipo: 'check-result', url: event.data.url, cached: !!hit });
    });
  }

  // Limpiar cache (llamado desde offline.js → borrarCache())
  if (event.data?.tipo === 'clear') {
    caches.delete(CACHE_VERSION).then(() => {
      event.source?.postMessage({ tipo: 'clear-done' });
    });
  }
});