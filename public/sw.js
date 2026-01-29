// Service Worker para EscalaPro PWA
const CACHE_NAME = 'escalapro-v1';
const DYNAMIC_CACHE = 'escalapro-dynamic-v1';

// Arquivos para cache inicial
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
            console.log('[SW] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  // Ignorar requisições de API (sempre buscar do servidor)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then((response) => {
            // Verificar se é uma resposta válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clonar resposta para cache
            const responseToCache = response.clone();
            
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch(() => {
            // Offline fallback
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Push Notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'EscalaPro',
    body: 'Você tem uma nova notificação',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'escalapro-notification',
    data: {}
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    tag: data.tag || 'escalapro',
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' }
    ],
    data: data.data || {}
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data;
  
  if (action === 'dismiss') {
    return;
  }
  
  // URL para abrir baseado no tipo de notificação
  let urlToOpen = '/';
  
  if (notificationData.tipo === 'escala') {
    urlToOpen = '/escalas';
  } else if (notificationData.tipo === 'furo') {
    urlToOpen = '/furos';
  } else if (notificationData.tipo === 'troca') {
    urlToOpen = '/trocas';
  } else if (notificationData.tipo === 'aviso') {
    urlToOpen = '/avisos';
  } else if (notificationData.url) {
    urlToOpen = notificationData.url;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Verificar se já existe uma janela aberta
        for (const client of windowClients) {
          if (client.url.includes(self.registration.scope) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        
        // Abrir nova janela
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Fechar notificação
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
});

// Sincronização em background
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-presencas') {
    event.waitUntil(syncPresencas());
  }
});

// Função para sincronizar presenças pendentes
async function syncPresencas() {
  try {
    const db = await openIndexedDB();
    const pendingPresencas = await getPendingPresencas(db);
    
    for (const presenca of pendingPresencas) {
      try {
        await fetch('/api/presencas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(presenca)
        });
        await removePendingPresenca(db, presenca.id);
      } catch (error) {
        console.error('[SW] Erro ao sincronizar presença:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Erro na sincronização:', error);
  }
}

// IndexedDB helpers (para offline)
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('escalapro-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-presencas')) {
        db.createObjectStore('pending-presencas', { keyPath: 'id' });
      }
    };
  });
}

function getPendingPresencas(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-presencas', 'readonly');
    const store = tx.objectStore('pending-presencas');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function removePendingPresenca(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending-presencas', 'readwrite');
    const store = tx.objectStore('pending-presencas');
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

console.log('[SW] Service Worker loaded');
