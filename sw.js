// Guarda la app en el celular para que abra rápido y también sin señal (service worker).
// Se publica al lado de index.html (armar.ps1 lo copia a publicar/sw.js) y la app lo registra al abrir (28-arranque.js).
//  - La página: primero intenta traer la última de GitHub, esperando como mucho ESPERA_MS. Si no hay señal o tarda, abre
//    la copia guardada; la descarga sigue por detrás y la próxima vez ya abre la nueva. Así las actualizaciones llegan igual.
//  - Librerías y fuentes (cdnjs, Google Fonts): se bajan una sola vez y después salen de la copia guardada.
//  - El script de Google (los datos) no pasa por acá: siempre va directo, nunca se guarda.
const CACHE = 'registro-atenciones-v1';
const PAGINA = './';                       // una sola copia de la página, sin importar ?modo=…
const ESPERA_MS = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add(PAGINA)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') { e.respondWith(paginaConRespaldo(req)); return; }
  const host = new URL(req.url).hostname;
  if (host === 'cdnjs.cloudflare.com' || host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') e.respondWith(guardadaPrimero(req));
});

async function paginaConRespaldo(req) {
  const cache = await caches.open(CACHE);
  const red = fetch(req).then(r => { if (r && r.ok) cache.put(PAGINA, r.clone()); return r; });
  try {
    const r = await Promise.race([red, new Promise(ok => setTimeout(() => ok(null), ESPERA_MS))]);
    if (r && r.ok) return r;
  } catch (_) {}
  const guardada = await cache.match(PAGINA);
  return guardada || red;                  // sin copia guardada todavía: se espera a la red
}

async function guardadaPrimero(req) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const r = await fetch(req);
  if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone());
  return r;
}
