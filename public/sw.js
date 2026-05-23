const CACHE = 'Clipit-v3';

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(['/', './'].map(u => u)).catch(() => {}))
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
    // Only cache GET requests; pass through API calls and non-http(s) schemes
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || e.request.url.includes('api.php') || !url.protocol.startsWith('http')) return;

    // For navigation requests (share target, page loads) use app-shell fallback
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    if (res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE).then(c => c.put(e.request, clone));
                    }
                    return res;
                })
                .catch(() =>
                    caches.match(e.request)
                        .then(cached => cached || caches.match('/') || caches.match('./'))
                )
        );
        return;
    }

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

