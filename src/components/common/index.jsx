/**
 * components/common/index.jsx — 여러 탭에서 공유하는 공통 UI 컴포넌트 모음.
 *
 * 헤더/하단 내비(Header, BottomNav), 빈 상태 화면(EmptyState + SVG 일러스트),
 * 오늘 요약 카드, 오프라인/알림 배너, 실행취소 토스트 등을 export 한다.
 * 대부분 useApp()으로 전역 상태를, useT()로 번역을 받아 쓴다.
 */
import React, { useState, useEffect } from 'react';
import { LS, ADMIN_UID } from '../../constants.js';
import { useT } from '../../i18n.jsx';
import { todayStr, fmtD, toast } from '../../utils.js';
import { useApp } from '../../store.js';

// 탭별 빈 상태에 쓰는 인라인 SVG 일러스트(문자열). EmptyState에서 dangerouslySetInnerHTML로 주입.
const EmptyIllust = {
  calendar: `<svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="28" width="160" height="120" rx="14" fill="#FFF0EE"/>
    <rect x="20" y="28" width="160" height="36" rx="14" fill="#F5604A"/>
    <rect x="20" y="50" width="160" height="14" fill="#F5604A"/>
    <circle cx="60" cy="22" r="8" fill="#F5604A" opacity=".6"/>
    <circle cx="140" cy="22" r="8" fill="#F5604A" opacity=".6"/>
    <rect x="60" y="14" width="4" height="16" rx="2" fill="#FF9A7B"/>
    <rect x="136" y="14" width="4" height="16" rx="2" fill="#FF9A7B"/>
    <rect x="36" y="76" width="26" height="22" rx="6" fill="#FFD6CC"/>
    <rect x="72" y="76" width="26" height="22" rx="6" fill="#FFD6CC"/>
    <rect x="108" y="76" width="26" height="22" rx="6" fill="#F5604A" opacity=".8"/>
    <rect x="144" y="76" width="26" height="22" rx="6" fill="#FFD6CC"/>
    <rect x="36" y="108" width="26" height="22" rx="6" fill="#FFD6CC"/>
    <rect x="72" y="108" width="26" height="22" rx="6" fill="#FFD6CC"/>
    <rect x="108" y="108" width="26" height="22" rx="6" fill="#FFD6CC"/>
    <text x="121" y="92" font-size="11" fill="#fff" text-anchor="middle" font-weight="700">오늘</text>
    <circle cx="162" cy="50" r="18" fill="#FFB347"/>
    <text x="162" y="56" font-size="18" text-anchor="middle">✨</text>
  </svg>`,

  gallery: `<svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="40" width="80" height="80" rx="12" fill="#E8F4FF"/>
    <rect x="106" y="40" width="78" height="36" rx="10" fill="#E1F5EE"/>
    <rect x="106" y="84" width="36" height="36" rx="10" fill="#FAEEDA"/>
    <rect x="148" y="84" width="36" height="36" rx="10" fill="#EEEDFE"/>
    <circle cx="46" cy="72" r="14" fill="#7EC8E3" opacity=".6"/>
    <path d="M16 100 L40 76 L60 96 L76 82 L96 120 L16 120Z" fill="#4A90D9" opacity=".3"/>
    <circle cx="72" cy="54" r="6" fill="#FFB347"/>
    <rect x="120" y="52" width="50" height="6" rx="3" fill="#9FE1CB"/>
    <rect x="120" y="62" width="36" height="6" rx="3" fill="#9FE1CB" opacity=".5"/>
    <rect x="116" y="94" width="20" height="18" rx="6" fill="#EF9F27" opacity=".8"/>
    <rect x="158" y="94" width="20" height="18" rx="6" fill="#AFA9EC" opacity=".8"/>
    <circle cx="168" cy="28" r="14" fill="#FF6B6B" opacity=".15"/>
    <text x="168" y="34" font-size="16" text-anchor="middle">📷</text>
    <circle cx="30" cy="28" r="10" fill="#7EC8E3" opacity=".2"/>
    <circle cx="180" cy="130" r="8" fill="#FFB347" opacity=".2"/>
  </svg>`,

  dday: `<svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="18" width="140" height="122" rx="18" fill="#FFF0EE"/>
    <rect x="30" y="18" width="140" height="66" rx="18" fill="#F5604A"/>
    <rect x="30" y="52" width="140" height="32" fill="#F5604A"/>
    <text x="100" y="46" font-size="23" text-anchor="middle" fill="#fff" font-weight="900">D-365</text>
    <text x="100" y="68" font-size="12" text-anchor="middle" fill="rgba(255,255,255,.9)">다음 생일까지</text>
    <rect x="50" y="98" width="100" height="10" rx="5" fill="#FFD6CC"/>
    <rect x="50" y="98" width="34" height="10" rx="5" fill="#F5604A"/>
    <circle cx="100" cy="126" r="18" fill="#FFD6CC"/>
    <text x="100" y="132" font-size="18" text-anchor="middle">🎂</text>
    <circle cx="50" cy="30" r="6" fill="rgba(255,255,255,.3)"/>
    <circle cx="158" cy="26" r="4" fill="rgba(255,255,255,.25)"/>
  </svg>`,

  habit: `<svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="30" y="22" width="140" height="116" rx="22" fill="#E1F5EE"/>
    <rect x="50" y="42" width="100" height="76" rx="14" fill="#FFFFFF" opacity=".72"/>
    <circle cx="68" cy="64" r="14" fill="#D6F3E9"/>
    <path d="M62 64 L67 69 L76 58" stroke="#3DBFA0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="90" y="56" width="44" height="8" rx="4" fill="#9FE1CB"/>
    <rect x="90" y="70" width="34" height="7" rx="3.5" fill="#C8ECDF"/>
    <circle cx="68" cy="94" r="14" fill="#D6F3E9"/>
    <path d="M62 94 L67 99 L76 88" stroke="#3DBFA0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="90" y="86" width="52" height="8" rx="4" fill="#9FE1CB"/>
    <rect x="90" y="100" width="26" height="7" rx="3.5" fill="#C8ECDF"/>
    <path d="M146 128 C140 112 128 108 118 116 C132 118 140 122 146 128Z" fill="#52B69A" opacity=".85"/>
    <path d="M146 128 C152 110 164 108 172 116 C160 119 152 123 146 128Z" fill="#3DBFA0" opacity=".7"/>
    <rect x="143" y="124" width="6" height="16" rx="3" fill="#52B69A"/>
  </svg>`,

  stats: `<svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="20" y="100" width="24" height="44" rx="6" fill="#F5604A" opacity=".3"/>
    <rect x="52" y="80" width="24" height="64" rx="6" fill="#F5604A" opacity=".5"/>
    <rect x="84" y="60" width="24" height="84" rx="6" fill="#F5604A" opacity=".7"/>
    <rect x="116" y="40" width="24" height="104" rx="6" fill="#F5604A"/>
    <rect x="148" y="70" width="24" height="74" rx="6" fill="#F5604A" opacity=".6"/>
    <line x1="16" y1="145" x2="184" y2="145" stroke="#F5604A" stroke-width="2" stroke-linecap="round" opacity=".3"/>
    <circle cx="128" cy="30" r="18" fill="#FFF0EE"/>
    <text x="128" y="36" font-size="16" text-anchor="middle">📊</text>
    <rect x="20" y="20" width="60" height="28" rx="8" fill="#FFF0EE"/>
    <text x="50" y="30" font-size="9" text-anchor="middle" fill="#F5604A" font-weight="700">이번 달</text>
    <text x="50" y="42" font-size="10" text-anchor="middle" fill="#F5604A" font-weight="900">0 / 0</text>
  </svg>`,
};

// EmptyState — 데이터 없을 때 보여주는 일러스트 + 안내문 + CTA 버튼(최대 2개) 화면.
const EmptyState = ({ type, title, desc, cta, onCta, cta2, onCta2 }) => {
  return React.createElement('div', {
    style: {
      textAlign: 'center',
      padding: '32px 24px 40px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }
  },
    // SVG 일러스트
    React.createElement('div', {
      dangerouslySetInnerHTML: { __html: EmptyIllust[type] || EmptyIllust.calendar },
      style: { width: 200, height: 160, marginBottom: type === 'dday' ? 30 : 24 },
    }),
    // 제목
    React.createElement('div', {
      style: { fontSize: 18, fontWeight: 900, color: 'var(--txt)', marginBottom: 8, letterSpacing: '-0.3px' }
    }, title),
    // 설명
    React.createElement('div', {
      style: { fontSize: 13, color: 'var(--mut)', lineHeight: 1.8, marginBottom: type === 'feedback' ? 34 : 28, maxWidth: 260 }
    }, desc),
    // CTA 버튼들
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280 }
    },
      React.createElement('button', {
        className: 'btn btn-primary',
        onClick: onCta,
        style: { fontSize: 15, fontWeight: 800 }
      }, cta),
      cta2 && React.createElement('button', {
        className: 'btn btn-secondary',
        onClick: onCta2,
        style: { fontSize: 14 }
      }, cta2),
    ),
  );
};

// Header — 상단 바. 로고, 검색/갤러리/다크모드/계정/설정 진입과 '오늘로' 버튼을 둔다.
const Header = ({ onSearch, onAccount, onSettings, onToday, showToday, user, onGallery }) => {
  const { state, dispatch } = useApp();
  const t = useT();
  // 다크모드 토글: <html data-theme> 즉시 반영 + LS 저장 + 상태 갱신
  const toggleDark = () => {
    const newDark = !state.dark;
    document.documentElement.setAttribute('data-theme', newDark ? 'dark' : state.theme === 'pink' ? '' : state.theme);
    localStorage.setItem(LS.DARK, newDark ? '1' : '0');
    dispatch({ type: 'SET_DARK', dark: newDark });
  };
  const avatar = user ? (user.displayName || user.email || '?')[0].toUpperCase() : '👤';
  return React.createElement('div', {className: 'header'},
    React.createElement('div', {className: 'hdr-logo'}, '✿ 하루봄'),
    React.createElement('div', {className: 'hdr-btns'},
      showToday && React.createElement('button', {id:'today-btn', style:{display:'inline-flex', alignItems:'center', justifyContent:'center', lineHeight:1, padding:'1px 14px 0'}, onClick: onToday}, t('cal.today_btn')),
      React.createElement('button', {className: 'hdr-btn', onClick: onSearch, 'aria-label':'검색'}, '🔍'),
      React.createElement('button', {className: 'hdr-btn', onClick: onGallery, 'aria-label':'갤러리'},
        React.createElement('span', {className:'hdr-gallery-icon', 'aria-hidden':'true'})
      ),
      React.createElement('button', {className: 'hdr-btn', onClick: toggleDark, 'aria-label':'다크모드'}, state.dark ? '🌙' : '☀️'),
      React.createElement('button', {className: 'hdr-btn', onClick: onSettings, 'aria-label':'설정'}, '⚙️'),
      React.createElement('button', {
        className: `hdr-btn${user ? ' logged-in' : ''}`,
        onClick: onAccount, 'aria-label':'계정'
      }, avatar),
    )
  );
};

// BottomNav — 하단 탭 내비게이션. 관리자 계정이면 '유저' 탭을 추가로 노출.
const BottomNav = ({ tab, onChange, user }) => {
  const t = useT();
  const isAdmin = user?.uid === ADMIN_UID; // 관리자 UID 정확 일치 (Firestore 규칙과 동일 기준)
  const tabs = [
    {id:'calendar',    ico:'📅', lbl:t('nav.calendar')},
    {id:'dday',        ico:'🚩', lbl:'D-Day'},
    {id:'goal',        ico:'🎯', lbl:t('nav.goal')},
    {id:'habit',       ico:'💪', lbl:t('nav.habit')},
    {id:'stats',       ico:'📊', lbl:t('nav.stats')},
    {id:'feedback',    ico:'💬', lbl:t('nav.feedback')},
    ...(isAdmin ? [{id:'admin-users', ico:'👥', lbl:t('nav.users')}] : []),
  ];
  return React.createElement('nav', {className: 'bottom-nav'},
    tabs.map(t => React.createElement('button', {
      key: t.id,
      className: `nb${tab === t.id ? ' active' : ''}`,
      onClick: () => onChange(t.id),
      'data-t': t.id,
    },
      React.createElement('span', {className: 'nb-ico'}, t.ico),
      React.createElement('span', {className: 'nb-lbl'}, t.lbl),
    ))
  );
};

// CollapsibleSection — 제목 클릭으로 펼침/접힘 토글되는 섹션(주로 통계 화면에서 사용).
const CollapsibleSection = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  return React.createElement(React.Fragment, null,
    React.createElement('div', {
      className: 'stats-section-title',
      style: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none', marginTop: 16 },
      onClick: () => setOpen(o => !o),
    },
      React.createElement('span', null, title),
      React.createElement('span', {
        style: { fontSize: 12, color: 'var(--mut)', display: 'inline-flex', alignItems: 'center' }
      }, '▾'),
    ),
    open && React.createElement('div', { style: { marginTop: 10 } }, children),
  );
};


// TodaySummaryCard — 오늘 일정 진행도(완료/전체)와 다음 일정을 보여주는 요약 카드.
const TodaySummaryCard = ({ events, onOpenEvent }) => {
  const t = useT();
  const today = todayStr();
  const todayEvs = events[today] || [];
  const total = todayEvs.length;
  const done = todayEvs.filter(e => e.done).length;
  const remaining = todayEvs.filter(e => !e.done && !e.allDay);
  const next = remaining.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))[0]; // 가장 이른 미완료 일정

  if (total === 0) return null; // 오늘 일정이 없으면 카드 숨김

  return React.createElement('div', {
    style: { background: 'linear-gradient(135deg, var(--pri), var(--sec))', borderRadius: 16, padding: '14px 16px', marginBottom: 12, cursor: 'pointer', color: '#fff' },
    onClick: () => onOpenEvent(null, 'add'),
  },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
      React.createElement('div', null,
        React.createElement('div', { style: { fontSize: 12, opacity: 0.85, marginBottom: 4 } }, t('cal.today_events')),
        React.createElement('div', { style: { fontSize: 22, fontWeight: 900 } },
          done === total ? t('cal.all_done') : remaining.length + t('cal.remaining')
        ),
        next && React.createElement('div', { style: { fontSize: 12, opacity: 0.85, marginTop: 4 } },
          t('cal.next') + ': ' + (next.startTime ? next.startTime + ' ' : '') + next.title
        ),
      ),
      React.createElement('div', { style: { textAlign: 'right' } },
        React.createElement('div', { style: { fontSize: 28, fontWeight: 900 } }, `${done}/${total}`),
        React.createElement('div', { style: { fontSize: 11, opacity: 0.85 } }, t('stats.done_label')),
      ),
    ),
    total > 0 && React.createElement('div', { style: { marginTop: 10, height: 4, background: 'rgba(255,255,255,.3)', borderRadius: 2, overflow: 'hidden' } },
      React.createElement('div', { style: { height: '100%', background: '#fff', borderRadius: 2, width: `${Math.round(done / total * 100)}%`, transition: 'width .4s' } })
    ),
  );
};

// QuickDateChips — 오늘/내일/7일 후 등 자주 쓰는 날짜를 빠르게 고르는 칩 버튼들.
const QuickDateChips = ({ onSelect }) => {
  const t = useT();
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
  const chips = [
    { label: t('cal.today'), date: fmtD(today) },
    { label: t('cal.tomorrow'), date: fmtD(tomorrow) },
    { label: t('cal.in7'), date: fmtD(nextWeek) },
  ];
  return React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 } },
    chips.map(c => React.createElement('button', {
      key: c.label,
      style: { flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: '1.5px solid var(--bor)', background: 'var(--sur)', fontSize: 12, fontWeight: 700, color: 'var(--txt)', cursor: 'pointer', fontFamily: 'inherit' },
      onClick: () => onSelect(c.date),
    }, c.label))
  );
};


// ── 오프라인 배너 ──

// OfflineBanner — 네트워크 오프라인일 때 상단에 뜨는 안내 배너(online/offline 이벤트 구독).
const OfflineBanner = () => {
  const t = useT();
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const onOnline  = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);
  if (!offline) return null;
  return React.createElement('div', {
    style: {
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#333', color: '#fff',
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 12, fontWeight: 700,
      paddingTop: 'calc(8px + env(safe-area-inset-top))',
    }
  },
    React.createElement('span', {style:{fontSize:14}}, '📡'),
    t('offline.msg'),
    React.createElement('span', {style:{marginLeft:'auto', opacity:.7, fontSize:11, fontWeight:400}}, t('offline.local')),
  );
};

// NotifBanner — 알림 권한이 아직 미정(default)이고 사용자가 닫은 적 없으면 3초 후 권한 요청 배너를 띄움.
const NotifBanner = () => {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      const dismissed = localStorage.getItem('nhr_notif_dismissed'); // 한 번 닫으면 다시 안 띄움
      if (!dismissed) setTimeout(() => setShow(true), 3000);
    }
  }, []);
  if (!show) return null;
  const request = async () => {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') toast(t('notif.granted'));
    setShow(false);
    localStorage.setItem('nhr_notif_dismissed', '1');
  };
  return React.createElement('div', {
    style: { position: 'fixed', bottom: 'calc(70px + env(safe-area-inset-bottom))', left: 12, right: 12, background: 'var(--sur)', border: '1.5px solid var(--bor)', borderRadius: 16, padding: '12px 14px', zIndex: 80, boxShadow: '0 4px 20px rgba(0,0,0,.12)', display: 'flex', alignItems: 'center', gap: 10 }
  },
    React.createElement('span', { style: { fontSize: 24 } }, '🔔'),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { fontSize: 13, fontWeight: 800, color: 'var(--txt)' } }, t('notif.req_title')),
      React.createElement('div', { style: { fontSize: 11, color: 'var(--mut)' } }, t('notif.req_desc')),
    ),
    React.createElement('button', { onClick: request, style: { background: 'var(--pri)', color: '#fff', border: 'none', borderRadius: 20, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } }, t('notif.allow')),
    React.createElement('button', { onClick: () => { setShow(false); localStorage.setItem('nhr_notif_dismissed', '1'); }, style: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--mut)' } }, '✕'),
  );
};

// UndoToast — useUndo 스택의 가장 최근 항목을 '되돌리기' 버튼과 함께 토스트로 표시.
const UndoToast = ({ undoStack, onUndo }) => {
  if (undoStack.length === 0) return null;
  const latest = undoStack[undoStack.length - 1]; // 스택 맨 위(가장 최근) 액션만 노출
  return React.createElement('div', {
    style: {
      position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom))', left: '50%',
      transform: 'translateX(-50%)', background: 'var(--txt)', color: 'var(--bg)',
      padding: '10px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700,
      zIndex: 9001, display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap',
      boxShadow: '0 4px 20px rgba(0,0,0,.2)',
    }
  },
    React.createElement('span', null, latest.label),
    React.createElement('button', {
      onClick: () => onUndo(latest.id),
      style: { background: 'var(--pri)', color: '#fff', border: 'none', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
    }, '취소'),
  );
};

export { EmptyIllust, EmptyState, Header, BottomNav, CollapsibleSection, TodaySummaryCard, QuickDateChips, OfflineBanner, NotifBanner, UndoToast };
