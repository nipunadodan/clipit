const CACHE = 'Clipit-v2';

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.add('/').catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    // Only cache GET requests; pass through API calls
    if (e.request.method !== 'GET' || e.request.url.includes('api.php')) return;
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});

