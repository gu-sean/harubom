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

initFB({
  apiKey: "AIzaSyBa3na9yaijIyOXEz3REmk4sNqXvxjDXus",
  authDomain: "naharu-app.firebaseapp.com",
  projectId: "naharu-app",
  storageBucket: "naharu-app.firebasestorage.app",
  messagingSenderId: "1020301644065",
  appId: "1:1020301644065:web:5e4be458910cfc1c082e60",
});

/* install */
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC).catch(() => {})));
});

/* activate */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
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

const VAPID_KEY = "BJaGUVcGbkpfvqCr15MJKbjGqLWSZgBXNiJTHSyK2FEh7Fy9Nt8SyYZxr5QUH3_Wh5iB7l2XHnwDW1l1Bt-PgBg";

/* pushsubscriptionchange */
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_KEY,
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
      data: { url: './index.html', evId: ev.id },
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
  if (type === 'FIREBASE_CONFIG' && config) initFB(config);
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
  const { url = './index.html', evId } = e.notification.data || {};
  if (e.action === 'done' && evId) {
    self.clients.matchAll({ type: 'window' }).then(clients =>
      clients.forEach(c => c.postMessage({ type: 'MARK_DONE', evId }))
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
