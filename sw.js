/* Service worker do Mapa de Riscos.
   Atua só dentro da pasta onde está publicado (ex.: /mapaderiscos/) e só mexe
   nos caches que começam com "mapa-riscos-", para não interferir em outros
   apps publicados no mesmo domínio. */
const PREFIX = 'mapa-riscos-';
const VERSION = '2026-11-19-1';           // troque a cada nova publicação
const APP_CACHE = PREFIX + 'app-' + VERSION;
const CDN_CACHE = PREFIX + 'cdn-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const SCOPE_PATH = new URL(self.registration.scope).pathname;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith(PREFIX) && k !== APP_CACHE && k !== CDN_CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    if (!url.pathname.startsWith(SCOPE_PATH)) return;   // fora da pasta do app: não toca
    if (req.mode === 'navigate') {
      // página: tenta a rede (pega a versão nova) e cai para o cache sem internet
      e.respondWith(
        fetch(req).then(res => {
          if (res.ok) { const cp = res.clone(); caches.open(APP_CACHE).then(c => c.put('./index.html', cp)); }
          return res;
        }).catch(() => caches.match('./index.html', { cacheName: APP_CACHE }).then(r => r || caches.match('./')))
      );
      return;
    }
    e.respondWith(
      caches.match(req, { cacheName: APP_CACHE }).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const cp = res.clone(); caches.open(APP_CACHE).then(c => c.put(req, cp)); }
        return res;
      }))
    );
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    // bibliotecas e fontes: usa o cache na hora e atualiza em segundo plano
    e.respondWith(caches.open(CDN_CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || net;
    })));
  }
});
