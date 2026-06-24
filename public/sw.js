/* ✿ 하루봄 — Service Worker v2 */

try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
} catch (_) {}

const CACHE_NAME = 'harubom-v10';
const STATIC = ['./index.html', './icons/icon-192.png', './icons/icon-512.png', './manifest.json'];

/* Firebase 초기화 */
let _fbInited = false;
function initFB(cfg) {
  if (_fbInited || !cfg?.apiKey || cfg.apiKey.startsWith('YOUR_')) return;
  if (typeof firebase === 'undefined') return;
  try {
    firebase.initializeApp(cfg);
    firebase.messaging().onBackgroundMessage(payload => {
      const { title = '✿ 하루봄', body = '새 알림이 있어요' } = payload.notification || {};
      return self.registration.showNotification(title, {
        body, icon: './icons/icon-192.png', badge: './icons/icon-96.png',
        vibrate: [200, 100, 200], data: payload.data || {},
      });
    });
    _fbInited = true;
  } catch(_) {}
}

/* Firebase config는 App.jsx가 SW 등록 후 FIREBASE_CONFIG 메시지로 전달.
   SW 재시작 후 백그라운드 푸시에 대비해 IndexedDB에 캐시한다. */
const _IDB = 'harubom-sw-cfg';
function _idbPut(cfg) {
  try {
    const req = indexedDB.open(_IDB, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('cfg');
    req.onsuccess = e => {
      const db = e.target.result;
      db.transaction('cfg', 'readwrite').objectStore('cfg').put(cfg, 'fb');
      db.close();
    };
  } catch (_) {}
}
function _idbGet() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(_IDB, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('cfg');
      req.onsuccess = e => {
        const db = e.target.result;
        const r = db.transaction('cfg').objectStore('cfg').get('fb');
        r.onsuccess = () => { db.close(); resolve(r.result || null); };
        r.onerror  = () => { db.close(); resolve(null); };
      };
      req.onerror = () => resolve(null);
    } catch (_) { resolve(null); }
  });
}

/* install */
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC).catch(() => {})));
});

/* activate */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => _idbGet().then(cfg => { if (cfg) initFB(cfg); }))
      .then(() => self.clients.claim())
  );
});

/* fetch — clone 오류 수정 버전 */
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (!url.startsWith(self.location.origin)) return;
  if (e.request.method !== 'GET') return;

  // HTML — Network First
  if (url.endsWith('.html') || url.endsWith('/') || url === self.location.origin) {
    e.respondWith(
      fetch(e.request.clone())
        .then(res => {
          if (res && res.ok && res.status < 400) {
            const cloned = res.clone();  // 캐시용 복사본 먼저 만들기
            caches.open(CACHE_NAME).then(c => c.put(e.request, cloned));
            return res;
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html').then(r => r || new Response('', { status: 503 }))))
    );
    return;
  }

  // 이미지/아이콘 — Cache First
  if (url.match(/\.(png|jpg|svg|webp|ico)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request.clone())
          .then(res => {
            if (res && res.ok) {
              const cloned = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(e.request, cloned));
            }
            return res;
          })
          .catch(() => cached || new Response('', { status: 404 }));
      })
    );
    return;
  }

  // JS/CSS — Cache First (Vite 해시 파일명 덕분에 캐시 히트 = 항상 정확한 버전)
  // 오프라인 시 캐시에서 서빙. 첫 방문 시 자동 캐시.
  if (url.match(/\.(js|jsx|css)(\?|$)/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request.clone())
          .then(res => {
            if (res && res.ok) {
              const cloned = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(e.request, cloned));
            }
            return res;
          })
          .catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // 나머지 — Network First, 캐시 폴백
  e.respondWith(
    fetch(e.request.clone())
      .then(res => {
        if (res && res.ok) {
          const cloned = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, cloned));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(c => c || new Response('', { status: 503 })))
  );
});

/* push */
self.addEventListener('push', e => {
  if (!e.data) return;
  try {
    const d = e.data.json();
    const { title = '✿ 하루봄', body = '새 알림이 있어요' } = d.notification || {};
    e.waitUntil(self.registration.showNotification(title, {
      body, icon: './icons/icon-192.png', badge: './icons/icon-96.png',
      vibrate: [200, 100, 200], data: d.data || {},
      actions: [{ action: 'open', title: '앱 열기' }],
    }));
  } catch(_) {}
});

/* VAPID key는 App.jsx가 FIREBASE_CONFIG 메시지와 함께 vapidKey로 전달. IndexedDB에 캐시. */
let _vapidKey = null;

/* pushsubscriptionchange */
self.addEventListener('pushsubscriptionchange', e => {
  if (!_vapidKey) return; // VAPID key 미수신 시 재구독 생략
  e.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _vapidKey,
    }).catch(() => {})
  );
});

/* 예약 알림 */
const _scheduled = new Map();
function scheduleNotif(ev) {
  if (!ev?.date) return;
  if (!ev.startTime) ev = {...ev, startTime: '08:00'}; // D-Day 알림 기본 08:00
  const notifyBefore = ev.notifyBefore ?? 10; // 기본 10분 전
  const target = new Date(ev.date + 'T' + ev.startTime);
  const delay = target.getTime() - notifyBefore * 60 * 1000 - Date.now();
  if (delay < 0 || delay > 48 * 3600 * 1000) return;
  const old = _scheduled.get(ev.id);
  if (old) clearTimeout(old);
  const notifyLabel = notifyBefore >= 1440 ? '내일' : notifyBefore >= 60 ? (notifyBefore/60) + '시간 후' : notifyBefore + '분 후';
  const t = setTimeout(() => {
    self.registration.showNotification('✿ 하루봄', {
      body: '"' + ev.title + '" ' + notifyLabel + ' 시작해요',
      icon: './icons/icon-192.png', badge: './icons/icon-96.png',
      tag: 'ev-' + ev.id, vibrate: [200, 100, 200],
      data: { url: './index.html', evId: ev.id, ds: ev.date, originDate: ev.originDate },
      actions: [{ action: 'open', title: '일정 보기' }, { action: 'done', title: '완료' }],
      requireInteraction: true,
    });
    _scheduled.delete(ev.id);
  }, delay);
  _scheduled.set(ev.id, t);
}

/* 메시지 수신 */
self.addEventListener('message', e => {
  const { type, ev, config } = e.data || {};
  if (type === 'FIREBASE_CONFIG' && config) { initFB(config); _idbPut(config); if (e.data.vapidKey) _vapidKey = e.data.vapidKey; }
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'SCHEDULE_NOTIF' && ev) scheduleNotif(ev);
  if (type === 'CANCEL_NOTIF' && ev?.id) {
    const t = _scheduled.get(ev.id);
    if (t) { clearTimeout(t); _scheduled.delete(ev.id); }
  }
  if (type === 'INIT') e.source?.postMessage({ type: 'SW_READY', version: CACHE_NAME });
});

/* 알림 클릭 */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { url = './index.html', evId, ds, originDate } = e.notification.data || {};
  if (e.action === 'done' && evId) {
    self.clients.matchAll({ type: 'window' }).then(clients =>
      clients.forEach(c => c.postMessage({ type: 'MARK_DONE', evId, ds, originDate }))
    );
  }
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if (c.url.includes(self.location.origin)) { c.focus(); return; }
      }
      return self.clients.openWindow(url);
    })
  );
});
