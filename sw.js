/* ============================================================
   Dotir 2 — sw.js  (dotir2-v4)
   Network-first para JS/HTML/CSS -> cambios en repo siempre
   visibles en la siguiente carga sin borrar cache.
   Cache-first solo para video. Network-first para JSON.
   ============================================================ */

const CACHE = 'dotir2-v4';

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// FIX: regex corregidas — parentesis escapados y punto literal
const isVideo = u => /\.mp4(\?|$)/i.test(u);
const isAudio = u => /\.mp3(\?|$)/i.test(u);
const isJson  = u => /\.json(\?|$)/i.test(u);

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = request.url;
  if (request.method !== 'GET') return;

  // -- Video: cache-first con soporte Range ---
  if (isVideo(url)) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (!cached) {
          const resp = await fetch(request);
          if (resp.ok) cache.put(request, resp.clone());
          return resp;
        }
        const range = request.headers.get('Range');
        if (!range) return cached;
        const blob  = await cached.blob();
        const m     = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m[1] ? +m[1] : 0;
        const end   = m[2] ? +m[2] : blob.size - 1;
        return new Response(blob.slice(start, end + 1), {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Type':  cached.headers.get('Content-Type') || 'video/mp4',
            'Content-Range': `bytes ${start}-${end}/${blob.size}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
          },
        });
      }).catch(() => fetch(request))
    );
    return;
  }

  // -- Audio: cache-first ---
  if (isAudio(url)) {
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const resp = await fetch(request);
        if (resp.ok) cache.put(request, resp.clone());
        return resp;
      }).catch(() => caches.match(request).then(c =>
        c || new Response('Sin conexion', { status: 503 })
      ))
    );
    return;
  }

  // -- JSON: network-first, fallback a cache ---
  if (isJson(url)) {
    e.respondWith(
      fetch(request)
        .then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(request).then(c =>
          c || new Response('[]', { headers: { 'Content-Type': 'application/json' } })
        ))
    );
    return;
  }

  // -- Todo lo demas: network-first ---
  // Siempre va a la red -> cambios en el repo se ven de inmediato.
  // Si no hay red, usa la cache como respaldo.
  e.respondWith(
    fetch(request)
      .then(resp => {
        if (resp.ok) caches.open(CACHE).then(c => c.put(request, resp.clone()));
        return resp;
      })
      .catch(() => caches.match(request).then(c =>
        c || new Response('Sin conexion', { status: 503 })
      ))
  );
});

// -- Mensajes desde la app ---
self.addEventListener('message', async e => {

  // Actualizar SW inmediatamente
  if (e.data?.tipo === 'skipWaiting') {
    self.skipWaiting();
    return;
  }

  // Precachear lista de URLs
  if (e.data?.tipo === 'precache') {
    const cache = await caches.open(CACHE);
    let ok = 0;
    const urls = e.data.urls || [];
    for (const url of urls) {
      try {
        const r = await fetch(url);
        if (r.ok) { await cache.put(url, r); ok++; }
      } catch (_) {}
      // Notificar progreso cada 10 archivos
      if (ok % 10 === 0) {
        e.source?.postMessage({ tipo: 'precache-progress', ok, total: urls.length });
      }
    }
    e.source?.postMessage({ tipo: 'precache-done', total: urls.length, ok });
    return;
  }

  // Verificar si una URL esta en cache
  if (e.data?.tipo === 'check') {
    const c = await caches.match(e.data.url);
    e.source?.postMessage({ tipo: 'check-result', url: e.data.url, cached: !!c });
    return;
  }

  // Borrar cache completo
  if (e.data?.tipo === 'clear') {
    await caches.delete(CACHE);
    e.source?.postMessage({ tipo: 'clear-done' });
    return;
  }

  // Heartbeat — mantener SW activo
  if (e.data?.tipo === 'heartbeat') {
    e.source?.postMessage({ tipo: 'heartbeat-ack' });
    return;
  }
});