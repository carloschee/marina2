const SW_URL = './sw.js';

export async function registrarSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: './' });
    if (navigator.storage?.persist) navigator.storage.persist();
    return reg;
  } catch (e) {
    console.error('[Offline] Error SW:', e);
    return null;
  }
}

const _swReady = () => navigator.serviceWorker?.ready ?? Promise.resolve(null);

async function _swMsg(msg) {
  const reg = await _swReady();
  if (reg?.active) reg.active.postMessage(msg);
}

export async function precachear(urls, { onProgress } = {}) {
  if (!urls?.length) return { ok: 0, total: 0 };
  return new Promise(resolve => {
    let done = false;
    const handler = e => {
      if (e.data?.tipo !== 'precache-done' || done) return;
      done = true;
      navigator.serviceWorker.removeEventListener('message', handler);
      resolve({ ok: e.data.ok, total: e.data.total });
    };
    navigator.serviceWorker.addEventListener('message', handler);
    setTimeout(() => {
      if (done) return;
      navigator.serviceWorker.removeEventListener('message', handler);
      resolve({ ok: 0, total: urls.length });
    }, 30000);
    _swMsg({ tipo: 'precache', urls });
    if (onProgress) {
      let n = 0;
      const tick = setInterval(() => {
        if (n >= urls.length || done) { clearInterval(tick); return; }
        n = Math.min(n + Math.ceil(urls.length / 20), urls.length);
        onProgress(n, urls.length);
      }, 300);
    }
  });
}

export async function estaEnCache(url) {
  return new Promise(resolve => {
    const handler = e => {
      if (e.data?.tipo === 'check-result' && e.data.url === url) {
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve(e.data.cached);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    _swMsg({ tipo: 'check', url });
    setTimeout(() => resolve(false), 3000);
  });
}

export function borrarCache() {
  return new Promise(resolve => {
    const handler = e => {
      if (e.data?.tipo === 'clear-done') {
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve();
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    _swMsg({ tipo: 'clear' });
    setTimeout(resolve, 3000);
  });
}

let _estado = 'checking';
let _listeners = [];

export function onConexionChange(fn) {
  _listeners.push(fn);
  fn(_estado);
}

function _emitir(e) {
  if (_estado === e) return;
  _estado = e;
  _listeners.forEach(fn => fn(e));
}

async function _verificar() {
  if (!navigator.onLine) { _emitir('offline'); return; }
  try {
    const res = await fetch('./manifest.json', {
      method: 'HEAD',
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    _emitir(res.ok ? 'online' : 'offline');
  } catch {
    _emitir('offline');
  }
}

window.addEventListener('online', () => _verificar());
window.addEventListener('offline', () => _emitir('offline'));
_verificar();
setInterval(_verificar, 4 * 60 * 1000);

export function fetchTimeout(url, ms = 8000, opts = {}) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
}
