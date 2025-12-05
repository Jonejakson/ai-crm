// Service Worker для PWA
// Версия кэша - обновляйте при изменении ресурсов
const CACHE_NAME = 'pocket-crm-v2';
const RUNTIME_CACHE = 'pocket-crm-runtime-v2';

// Ресурсы для кэширования при установке
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.webmanifest',
  '/icon.svg',
];

// Стратегии кэширования
const CACHE_STRATEGIES = {
  // Кэшировать сначала, затем сеть (для статических ресурсов)
  CACHE_FIRST: 'cache-first',
  // Сеть сначала, затем кэш (для API запросов)
  NETWORK_FIRST: 'network-first',
  // Только сеть (для критичных данных)
  NETWORK_ONLY: 'network-only',
  // Только кэш (для офлайн режима)
  CACHE_ONLY: 'cache-only',
};

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        // Кэшируем критичные ресурсы, игнорируем ошибки для несуществующих
        return Promise.allSettled(
          STATIC_ASSETS.map(url => 
            cache.add(url).catch(err => {
              console.warn(`[Service Worker] Failed to cache ${url}:`, err);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        // Принудительно активировать новый Service Worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Install error:', error);
        // Все равно активируем Service Worker даже при ошибках
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Удаляем старые кэши
              return name !== CACHE_NAME && name !== RUNTIME_CACHE;
            })
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        // Взять контроль над всеми клиентами
        return self.clients.claim();
      })
  );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем не-GET запросы
  if (request.method !== 'GET') {
    return;
  }

  // Пропускаем chrome-extension и другие протоколы
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Пропускаем запросы к другим доменам (кроме нашего)
  if (url.origin !== location.origin) {
    return;
  }

  // API запросы - Network First с кэшем
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Статические ресурсы (CSS, JS, изображения, шрифты) - Cache First
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/i) ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image')
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // HTML страницы - Network First с fallback на кэш и офлайн страницу
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithOfflineFallback(request));
    return;
  }

  // По умолчанию - Network First
  event.respondWith(networkFirstStrategy(request));
});

// Стратегия: Cache First
async function cacheFirstStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    // Кэшируем успешные ответы
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] Cache first error:', error);
    // Возвращаем офлайн страницу для HTML запросов
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/offline');
    }
    throw error;
  }
}

// Стратегия: Network First
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Кэшируем успешные ответы
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Для HTML запросов возвращаем офлайн страницу
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlinePage = await caches.match('/offline');
      if (offlinePage) {
        return offlinePage;
      }
    }
    
    throw error;
  }
}

// Стратегия: Network First с офлайн fallback
async function networkFirstWithOfflineFallback(request) {
  try {
    // Пытаемся загрузить из сети с таймаутом
    const networkResponse = await Promise.race([
      fetch(request),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 5000)
      )
    ]);
    
    // Кэшируем успешные ответы
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      // Клонируем ответ перед кэшированием
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache).catch(err => {
        console.error('[Service Worker] Cache put error:', err);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', error);
    
    // Пытаемся найти в кэше
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Возвращаем офлайн страницу
    const offlinePage = await caches.match('/offline');
    if (offlinePage) {
      return offlinePage;
    }
    
    // Если офлайн страница не найдена, возвращаем простой HTML ответ
    return new Response(
      `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Офлайн - Pocket CRM</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      padding: 20px;
    }
    .container {
      max-width: 400px;
    }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { font-size: 16px; opacity: 0.9; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Нет подключения</h1>
    <p>Проверьте подключение к интернету и попробуйте снова.</p>
  </div>
</body>
</html>`,
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

// Обработка push-уведомлений (для будущей реализации)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push notification received');
  
  const data = event.data?.json() || {};
  const title = data.title || 'Pocket CRM';
  const options = {
    body: data.body || 'У вас новое уведомление',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    tag: data.tag || 'default',
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Если есть открытое окно, фокусируемся на нем
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Иначе открываем новое окно
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

