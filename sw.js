// The version lives in version.js; changing it is what makes installed apps detect an update.
importScripts('./version.js');

const CACHE_NAME = 'manic-math-' + self.APP_VERSION;
const ASSETS = [
    './',
    './index.html',
    './version.js',
    './manifest.json',
    './css/style.css',
    './js/main.js',
    './js/constants.js',
    './js/textures.js',
    './js/starfield.js',
    './js/bica.js',
    './js/pwa.js',
    './js/settings.js',
    './js/i18n.js',
    './js/ui.js',
    './js/stats.js',
    './js/display.js',
    './js/achievements.js',
    './js/music.js',
    './js/progress.js',
    './js/ranking.js',
    './js/namefilter.js',
    './js/nameDialog.js',
    './js/sfx.js',
    './js/title.js',
    './js/audio.js',
    './js/drills.js',
    './js/drillbg.js',
    './js/backdrops.js',
    './js/album.js',
    './js/net.js',
    './js/p2p.js',
    './js/analysis.js',
    './assets/scenes/lisbon.webp',
    './assets/scenes/lisbon.json',
    './js/scenes/AchievementsScene.js',
    './js/scenes/GameScene.js',
    './js/scenes/MenuScene.js',
    './js/scenes/TestScene.js',
    './js/scenes/ShopScene.js',
    './js/scenes/RankingScene.js',
    './js/scenes/TrainingScene.js',
    './js/scenes/DrillScene.js',
    './js/scenes/AlbumScene.js',
    './js/scenes/MultiScene.js',
    './js/scenes/GuestScene.js',
    './js/scenes/AnalysisScene.js',
    './assets/icon-192.png',
    './assets/icon-512.png',
    './assets/icon-maskable-512.png',
    'https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser.min.js'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Network first so new deploys reach phones immediately; cache only as offline fallback
self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    // The ranking is always live: never answer it from the cache
    if (new URL(e.request.url).pathname.includes('/api/')) return;
    e.respondWith(
        fetch(e.request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
                }
                return response;
            })
            .catch(() => caches.match(e.request))
    );
});
