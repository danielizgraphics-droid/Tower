// Offline support for the installed app: the page itself is fetched fresh when
// online (so updates arrive), everything else (scripts, models, icons, fonts)
// is served from the cache once downloaded. Old versions' bundles are dropped.
const CACHE = 'bastion-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

/** Removes cached bundles (assets/index-*.js|css) that the current page no longer uses. */
async function prune(cache, html) {
  const used = new Set(html.match(/assets\/index-[\w-]+\.(?:js|css)/g) ?? []);
  if (!used.size) return;
  for (const req of await cache.keys()) {
    const m = new URL(req.url).pathname.match(/assets\/index-[\w-]+\.(?:js|css)$/);
    if (m && !used.has(m[0])) await cache.delete(req);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const page = req.mode === 'navigate';
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit && !page) return hit;
      try {
        // The page skips the browser's HTTP cache too, so a new version shows at once.
        // (A navigation request can't take new options: fetch its URL instead.)
        const res = await (page ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req));
        if (res.ok) {
          cache.put(req, res.clone());
          if (page)
            e.waitUntil(
              res
                .clone()
                .text()
                .then((html) => prune(cache, html)),
            );
        }
        return res;
      } catch (err) {
        if (hit) return hit;
        throw err;
      }
    }),
  );
});
