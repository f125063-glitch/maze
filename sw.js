const CACHE_NAME = 'maze-game-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './BGM_music_1.mp3',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
