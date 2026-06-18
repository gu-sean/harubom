/**
 * utils.js — 날짜/알림/토스트/IndexedDB 등 도메인에 얽매이지 않는 순수 유틸 모음.
 *
 * 날짜 포맷·D-Day 계산, 브라우저 알림 예약, 토스트/진동/파티클 같은 UI 부수효과,
 * 그리고 사진을 저장하는 IndexedDB 래퍼(savePhotoIDB 등)를 export 한다.
 * React에 의존하지 않으므로 어디서든 import해 쓸 수 있다.
 */
import { MS_PER_DAY } from './constants.js';
import { TRANSLATIONS } from './translations.js';

// 오늘 날짜를 로컬 시간대 기준 'YYYY-MM-DD'로. (toISOString은 UTC라 KST에서 날짜가 밀릴 수 있어 직접 조립)
export const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
};
// Date 객체 → 로컬 기준 'YYYY-MM-DD' 문자열
export const fmtD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

// fmtDateI18n — i18n 훅 밖에서 날짜를 언어별 표기로 포맷(useDateI18n의 비-훅 버전).
export const fmtDateI18n = (dateStr, lang) => {
  if (!dateStr) return '';
  const mm = dateStr.match(/\d{4}-(\d{2})-(\d{2})/);
  if (!mm) return dateStr;
  const mo = parseInt(mm[1]) - 1, day = parseInt(mm[2]);
  const tr = TRANSLATIONS[lang] || TRANSLATIONS.ko;
  const ms = tr['mo.' + mo] !== undefined ? tr['mo.' + mo] : TRANSLATIONS.ko['mo.' + mo];
  if (lang === 'en') return ms + ' ' + day;
  if (lang === 'zh' || lang === 'ja') return ms + day + '日';
  return ms + ' ' + day + '일';
};

// 충분히 유니크한 ID 생성 (랜덤 + 타임스탬프). DB가 아니라 클라이언트 로컬 식별용.
export const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36);
export const firstDayOfMonth = (y,m) => new Date(y,m,1).getDay();
export const daysInMonth = (y,m) => new Date(y,m+1,0).getDate();
// 오늘부터 dateStr까지 며칠 차이(양수=미래, 음수=과거). 정오 보정 없이 자정 기준으로 비교.
export const diffDays = dateStr => {
  const t = new Date(todayStr()+'T00:00:00');
  const d = new Date(dateStr+'T00:00:00');
  return Math.round((d - t) / MS_PER_DAY);
};

// getDDayInfo — D-Day의 남은 일수/다음 도래일/경과 햇수를 계산. yearly면 가장 가까운 미래로 보정.
export const getDDayInfo = (dd) => {
  const today = new Date(todayStr()+'T00:00:00');
  const base = new Date(dd.date+'T00:00:00');

  if (!dd.yearly) {
    // 일회성 D-Day: 원래 날짜까지의 단순 차이만 계산
    const diff = Math.round((base - today) / MS_PER_DAY);
    return { diff, nextDate: dd.date, years: null };
  }

  // 매년 반복: 올해 같은 월/일이 아직 안 지났으면 올해, 지났으면 내년을 목표일로 삼는다
  const thisYear = new Date(today.getFullYear(), base.getMonth(), base.getDate());
  const nextYear = new Date(today.getFullYear()+1, base.getMonth(), base.getDate());
  const target = thisYear >= today ? thisYear : nextYear;
  const diff = Math.round((target - today) / MS_PER_DAY);
  const years = target.getFullYear() - base.getFullYear();
  const nextDate = fmtD(target);
  return { diff, nextDate, years };
};

// scheduleDDayNotif — 서비스워커에 D-Day 알림을 예약한다(권한 허용 + 30일 이내일 때만).
export const scheduleDDayNotif = (dd) => {
  if (!dd.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const info = getDDayInfo(dd);
  if (info.diff < 0 || info.diff > 30) return; // 너무 먼 미래는 예약하지 않음(30일 이내만)
  navigator.serviceWorker?.ready.then(reg => {
    // 알림은 당일 오전 8시에 띄운다. 이미 지난 시각이면(delay<=0) 예약하지 않음.
    const notifDate = new Date(info.nextDate+'T08:00:00');
    const delay = notifDate.getTime() - Date.now();
    if (delay > 0) {
      reg.active?.postMessage({
        type: 'SCHEDULE_NOTIF',
        ev: {
          id: 'dday-'+dd.id,
          title: dd.emoji+' '+dd.label,
          startTime: '08:00',
          date: info.nextDate,
        }
      });
    }
  });
};

// 알림 권한 요청. 이미 granted/denied면 묻지 않고 즉시 결과 반환.
export const requestNotificationPermission = async () => {
  if (typeof Notification === 'undefined') return true;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
};

let _toastTimer = null;
// toast — index.html의 #toast-el에 잠깐 메시지를 띄움. 2.2초 후 자동 사라짐(연속 호출 시 타이머 리셋).
export const toast = (msg, ico='') => {
  const el = document.getElementById('toast-el');
  if (!el) return;
  el.textContent = ico ? ico+' '+msg : msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
};

// 햅틱 진동(지원 기기 한정). 숫자/패턴 배열 모두 허용.
export const vib = (pattern) => {
  if (navigator.vibrate) navigator.vibrate(Array.isArray(pattern) ? pattern : [pattern]);
};

// burstAt — (x,y) 지점에서 파티클 8개를 방사형으로 터뜨리는 축하 효과(완료 피드백 등).
export const burstAt = (x, y, color) => {
  const cols = [color,'#FFD700','#FF6B6B','#7EC8E3','#98D8C8'];
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'burst-particle';
    // 360도를 8등분한 각도 a로 퍼뜨리고, 거리 d는 약간 랜덤하게 줘서 자연스럽게
    const a = (i/8)*Math.PI*2, d = 40+Math.random()*30;
    p.style.cssText = `left:${x-3}px;top:${y-3}px;background:${cols[i%5]};--tx:${Math.cos(a)*d}px;--ty:${Math.sin(a)*d}px`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 520);
  }
};

// ══════════════════════════════════════
// IndexedDB (사진)
// 사진 원본은 용량이 커서 localStorage 대신 IndexedDB에 저장한다.
// photoSrcCache는 디코딩된 src를 메모리에 캐싱해 재조회를 줄이는 용도.
// ══════════════════════════════════════
export const IDB_NAME = 'naharu-photos', IDB_VER = 1, IDB_STORE = 'photos';
let _idb = null; // 한 번 연 DB 핸들을 재사용(매 호출마다 open하지 않도록)
export const photoSrcCache = new Map();
// openIDB — DB를 열고(없으면 store 생성) 핸들을 반환. 최초 1회만 실제 open.
export const openIDB = () => new Promise((res, rej) => {
  if (_idb) { res(_idb); return; }
  const req = indexedDB.open(IDB_NAME, IDB_VER);
  req.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'id' }); };
  req.onsuccess = e => { _idb = e.target.result; res(_idb); };
  req.onerror = e => rej(e.target.error);
});
// savePhotoIDB — 사진 원본(src)과 편집본(edited)을 함께 저장. 표시용 캐시도 갱신.
export const savePhotoIDB = async (id, src, edited=null) => {
  if (src) photoSrcCache.set(id, edited || src); // 편집본이 있으면 그쪽을 우선 캐시
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ id, src, edited });
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
};
// loadPhotoIDB — id로 사진 레코드({id, src, edited}) 조회.
export const loadPhotoIDB = async (id) => {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const req = db.transaction(IDB_STORE,'readonly').objectStore(IDB_STORE).get(id);
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
};
// deletePhotoIDB — id에 해당하는 사진 삭제.
export const deletePhotoIDB = async (id) => {
  const db = await openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE,'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    tx.oncomplete = res; tx.onerror = e => rej(e.target.error);
  });
};
// makeThumbnail — 캔버스로 축소한 썸네일 dataURL 생성. 실패하면 원본을 그대로 반환.
export const makeThumbnail = (dataUrl, maxW=120) => new Promise(res => {
  const img = new Image();
  img.onload = () => {
    const r = Math.min(1, maxW/img.width); // 원본보다 키우지 않도록 비율 상한 1
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width*r); cv.height = Math.round(img.height*r);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    res(cv.toDataURL('image/png'));
  };
  img.onerror = () => res(dataUrl);
  img.src = dataUrl;
});
// ensureImageDecodes — 업로드 이미지가 실제로 디코딩 가능한지 검증(깨진/미지원 형식 거르기).
export const ensureImageDecodes = (dataUrl) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => img.naturalWidth && img.naturalHeight ? res(img) : rej(new Error('이미지 크기를 읽지 못했어요'));
  img.onerror = () => rej(new Error('지원하지 않는 이미지 형식이에요'));
  img.src = dataUrl;
});
