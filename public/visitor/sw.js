// ネットワーク優先。通信できない時だけ保存済みの画面を表示する（/api は対象外）
const C = 'tonight-v68';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // 旧版キャッシュが新しい app.js / CSS の代わりに返されないよう整理
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('tonight-') && key !== C)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).then(response => {
      const copy = response.clone();
      caches.open(C).then(cache => cache.put(request, copy));
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      return cached || caches.match('./');
    })
  );
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    // iOS/iPadOSではPushイベント中に、ネットワーク通信を待たず通知を表示する。
    // 現在のPush送信は暗号化ペイロードを含まないため、本文は安全な共通文言にする。
    const title = 'tonight!｜TMPからのお知らせ';
    const options = {
      body: '新しいお知らせがあります。',
      icon: '/visitor/icon-192.png',
      badge: '/visitor/notification-badge.png',
      data: { url: './' },
      tag: 'tonight-announcement'
    };
    await self.registration.showNotification(title, options);

    // 通知表示後に補助処理を行う。失敗しても通知表示には影響させない。
    try {
      if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
        await self.navigator.setAppBadge(1);
      }
    } catch {}
    try {
      const response = await fetch('/api/public/messages/latest', {
        cache: 'no-store',
        credentials: 'same-origin'
      });
      if (response.ok) {
        const message = await response.json();
        // タイトル・本文の取得は表示後に限定。将来の診断用に通知データへ保持する。
        if (message && message.id) {
          const notifications = await self.registration.getNotifications({ tag: 'tonight-announcement' });
          if (notifications.length) {
            const current = notifications[notifications.length - 1];
            current.close();
            await self.registration.showNotification(title, {
              ...options,
              body: String(message.text || options.body).slice(0, 120),
              data: { url: './', messageId: message.id },
              tag: 'tonight-announcement'
            });
          }
        }
      }
    } catch {}
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    try {
      const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of list) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate('./');
          return;
        }
      }
      await clients.openWindow('./');
    } catch {
      await clients.openWindow('./');
    }
  })());
});
