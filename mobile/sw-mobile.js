// Service Worker for Scene*Writer Mobile
const CACHE_NAME = 'scene-writer-mobile-v1.0';
const urlsToCache = [
  '/scene-writer/mobile/',
  '/scene-writer/mobile/index.html',
  '/scene-writer/mobile/manifest.json',
  '/scene-writer/mobile/style.css',
  '/scene-writer/mobile/script.js',
  '/scene-writer/mobile/icon-192.png',
  '/scene-writer/mobile/icon-512.png'
];

// インストール時に必要なファイルをすべてキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('モバイル版キャッシュを開きました');
        return cache.addAll(urlsToCache);
      })
  );
  // すぐにアクティベート
  self.skipWaiting();
});

// オフライン時もキャッシュから応答
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // キャッシュにあればそれを返す
        if (response) {
          return response;
        }
        
        // ネットワークリクエストを試みる
        return fetch(event.request).then(
          response => {
            // 有効なレスポンスでない場合はそのまま返す
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // レスポンスをキャッシュに追加（動的キャッシング）
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          }
        ).catch(() => {
          // オフライン時のフォールバック
          return new Response('<h1>オフラインです</h1><p>インターネット接続を確認してください。</p>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        });
      })
  );
});

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // すべてのクライアントを更新
  self.clients.claim();
});
