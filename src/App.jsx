/**
 * App.jsx — 루트 컴포넌트. 전역 상태/컨텍스트와 화면 전체 레이아웃을 조립한다.
 *
 * useReducer(store.js)로 앱 상태를 보유하고 AppCtx/LangCtx로 하위에 공급한다.
 * 현재 탭(state.tab)에 따라 캘린더/갤러리/D-Day 등 탭 컴포넌트를 스위칭하고,
 * 모달(modal state)·검색·온보딩·PWA 설치 배너를 띄운다.
 * Firebase 인증/클라우드 동기화, 서비스워커 등록, 스플래시 제거 같은 부수효과도 여기서 묶어 처리.
 */
import React, { useState, useEffect, useRef, useReducer } from 'react';
import { LS } from './constants.js';
import { LangCtx, lookupT } from './i18n.jsx';
import { todayStr, vib, toast } from './utils.js';
import { INIT_STATE, reducer, AppCtx } from './store.js';
import { Header, BottomNav, OfflineBanner, NotifBanner } from './components/common/index.jsx';
import { CalendarTabUpgraded } from './components/calendar/index.jsx';
import { GalleryTabUpgraded } from './components/gallery/index.jsx';
import { DDayTab, DDayModal } from './components/dday/index.jsx';
import { GoalTab, GoalModal } from './components/goals/index.jsx';
import { HabitTab, HabitModal } from './components/habits/index.jsx';
import { StatsTab } from './components/stats/index.jsx';
import { FeedbackTab, AdminUserTab } from './components/feedback/index.jsx';
import { EventModal, MoodModal, SearchModal } from './components/modals/index.jsx';
import { AccountModal } from './components/account/index.jsx';
import { SettingsModal } from './components/settings/index.jsx';
import { Onboarding } from './components/onboarding/index.jsx';

const AppUpgraded = () => {
  const [state, dispatch] = useReducer(reducer, null, INIT_STATE); // 초기 상태는 LS에서 lazy 복원
  const T = (key) => lookupT(state.lang, key); // App은 LangCtx 바깥이라 훅 대신 lookupT로 직접 번역
  const [user, setUser] = useState(null);
  const [modal, setModal] = useState(null);
  // 온보딩은 처음 방문(완료 플래그 없음 + 기존 데이터 없음)일 때만 노출
  const [showOnboarding, setShowOnboarding] = useState(
    !localStorage.getItem(LS.ONBOARDED) && !localStorage.getItem(LS.DATA)
  );
  const [showSearch, setShowSearch] = useState(false);
  const [pwaDeferred, setPwaDeferred] = useState(null);
  const [showPwa, setShowPwa] = useState(false);
  const [scrollTopVisible, setScrollTopVisible] = useState(false);
  const tabContentRef = useRef(null);
  const backRef = useRef();
  backRef.current = { modal, showSearch, tab: state.tab };
  const syncToCloudRef = useRef(null); // 항상 최신 syncToCloud를 가리키는 ref (클로저 stale 방지)
  const autoSyncTimer = useRef(null);  // 디바운스 타이머 핸들

  // 테마/다크모드를 <html data-theme>에 반영(핑크는 기본값이라 빈 문자열). 최초 마운트 1회.
  useEffect(() => {
    const theme = state.theme || 'pink';
    if (state.dark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.setAttribute('data-theme', theme === 'pink' ? '' : theme);
  }, []);

  // Firebase 인증 구독. 로그인 상태가 잡히면 세션당 1회 클라우드에서 복원(syncFromCloud).
  useEffect(() => {
    const initAuth = () => {
      if (!window._FB?.enabled) return;
      // 이미 로그인된 유저 즉시 반영
      if (window._currentUser !== undefined) {
        setUser(window._currentUser);
        if (window._currentUser && !sessionStorage.getItem('nhr_synced')) {
          sessionStorage.setItem('nhr_synced', '1');
          syncFromCloud();
        }
      }
      window.addEventListener('auth-changed', e => {
        setUser(e.detail.user);
        if (e.detail.user) {
          if (!sessionStorage.getItem('nhr_synced')) {
            sessionStorage.setItem('nhr_synced', '1');
            syncFromCloud();
          }
        } else {
          // 로그아웃 시 항상 홈(캘린더)으로 이동
          dispatch({ type: 'SET_TAB', tab: 'calendar' });
          sessionStorage.removeItem('nhr_synced');
        }
      });
    };
    // Firebase가 이미 초기화됐으면 즉시 실행, 아니면 이벤트 대기
    if (window._FB?.enabled) {
      initAuth();
    } else {
      window.addEventListener('firebase-ready', initAuth, { once: true });
    }
  }, []);

  // PWA 설치 프롬프트를 가로채 보류해 두고, 자체 배너에서 원하는 시점에 띄운다
  useEffect(() => {
    const handler = e => { e.preventDefault(); setPwaDeferred(e); setShowPwa(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // 서비스워커 등록 + 자동 업데이트. 새 워커가 설치되면 즉시 활성화(SKIP_WAITING)하고
  // controllerchange 시 한 번만 새로고침해 최신 버전을 띄운다(무한 리로드 방지 플래그).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then(reg => {
        reg.onupdatefound = () => {
          const sw = reg.installing;
          sw.onstatechange = () => { if (sw.state === 'installed' && navigator.serviceWorker.controller) sw.postMessage({ type: 'SKIP_WAITING' }); };
        };
        reg.update();
      }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!sessionStorage.getItem('sw_reloaded')) { sessionStorage.setItem('sw_reloaded', '1'); window.location.reload(); }
    });
  }, []);

  // 스플래시 화면을 1.45초 뒤 페이드아웃하고 제거. t2는 혹시 남아있을 때를 위한 안전장치.
  useEffect(() => {
    const t1 = setTimeout(() => {
      const sp = document.getElementById('splash');
      if (sp) { sp.classList.add('hide'); setTimeout(() => sp.remove(), 500); }
    }, 1450);
    const t2 = setTimeout(() => { const sp = document.getElementById('splash'); if (sp) sp.remove(); }, 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Android 뒤로가기 버튼 — popstate로 가로채 모달→검색→탭 순서로 닫음.
  // 캘린더 홈에서 아무것도 열려 있지 않으면 pushState 없이 통과시켜 앱을 종료.
  useEffect(() => {
    window.history.pushState(null, '');
    const onPop = () => {
      const { modal, showSearch, tab } = backRef.current;
      if (modal) { window.history.pushState(null, ''); setModal(null); }
      else if (showSearch) { window.history.pushState(null, ''); setShowSearch(false); }
      else if (tab !== 'calendar') { window.history.pushState(null, ''); dispatch({ type: 'SET_TAB', tab: 'calendar' }); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 탭 콘텐츠를 300px 넘게 내리면 '맨 위로' 버튼 노출
  useEffect(() => {
    const el = tabContentRef.current;
    if (!el) return;
    const handler = () => setScrollTopVisible(el.scrollTop > 300);
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, []);

  // 키보드 올라올 때 sheet-footer 위로 이동
  useEffect(() => {
    if (!window.visualViewport) return;
    const vp = window.visualViewport;
    const onResize = () => {
      // 모바일 키보드가 올라오면 visualViewport가 줄어든다. 그 차이만큼 시트 푸터를 띄워 가려지지 않게 함.
      const offset = window.innerHeight - vp.height - vp.offsetTop;
      const footers = document.querySelectorAll('.sheet-footer');
      footers.forEach(footer => {
        footer.style.paddingBottom = offset > 10
          ? (offset + 8) + 'px'
          : '';
      });
    };
    vp.addEventListener('resize', onResize);
    vp.addEventListener('scroll', onResize);
    return () => {
      vp.removeEventListener('resize', onResize);
      vp.removeEventListener('scroll', onResize);
    };
  }, []);

  // syncToCloud — 현재 상태를 Firestore users/{uid} 문서에 백업(merge). 갤러리는 메타만.
  const syncToCloud = async (silent = false) => {
    if (!user || !window._FB?.enabled) return;
    const { fs, doc, setDoc } = window._FB;
    try {
      await setDoc(doc(fs, 'users', user.uid), {
        updatedAt: new Date().toISOString(),
        email: user.email || '',
        displayName: user.displayName || '',
        lang: state.lang,
        events: state.events, ddays: state.ddays, habits: state.habits,
        habitLogs: state.habitLogs, moods: state.moods, goals: state.goals || [],
        gallery: state.gallery.map(p => ({ id: p.id, thumb: p.thumb, storageKey: p.storageKey, filter: p.filter, br: p.br, co: p.co, sa: p.sa, rot: p.rot, stk: p.stk, uploaded: p.uploaded, edited: p.edited })),
      }, { merge: true });
      if (!silent) toast('클라우드에 백업됐어요', '☁️');
    } catch (e) { if (!silent) toast('백업 실패: ' + e.message, '⚠️'); }
  };

  // syncFromCloud — 클라우드 문서를 읽어 상태로 복원. 문서가 없으면(첫 로그인) 현재 상태를 올려 초기화.
  const syncFromCloud = async (silent = false) => {
    if (!user || !window._FB?.enabled) return;
    const { fs, doc, getDoc } = window._FB;
    try {
      const snap = await getDoc(doc(fs, 'users', user.uid));
      if (!snap.exists()) { await syncToCloud(true); return; }
      const d = snap.data();
      dispatch({ type: 'CLOUD_RESTORE', data: { events: d.events || {}, ddays: d.ddays || [], habits: d.habits || [], habitLogs: d.habitLogs || {}, moods: d.moods || {}, gallery: d.gallery || [], goals: d.goals || [], photoCalendars: d.photoCalendars || [] } });
      if (!silent) toast(T('toast.restored'), '📥');
    } catch (e) { if (!silent) toast('복원 실패: ' + e.message, '⚠️'); }
  };

  // syncToCloudRef — 렌더마다 최신 syncToCloud로 갱신. 30초 타이머에서 stale 클로저 없이 최신 state를 백업하기 위함.
  syncToCloudRef.current = syncToCloud;

  // 자동 클라우드 백업 — 로그인 상태에서 데이터가 바뀌면 30초 디바운스 후 조용히 백업.
  // 탭/날짜 같은 휘발성 UI 상태는 제외하고 실제 데이터 필드만 감시한다.
  useEffect(() => {
    if (!user || !window._FB?.enabled) return;
    clearTimeout(autoSyncTimer.current);
    autoSyncTimer.current = setTimeout(() => syncToCloudRef.current(true), 30_000);
    return () => clearTimeout(autoSyncTimer.current);
  }, [
    state.events, state.ddays, state.habits, state.habitLogs,
    state.moods, state.goals, state.gallery, state.photoCalendars, state.reviews,
    state.lang,
    user,
  ]);

  const goToday = () => {
    const now = new Date();
    dispatch({ type: 'SET_DATE', yr: now.getFullYear(), mo: now.getMonth(), sel: todayStr() });
    vib(20);
    toast(T('toast.today_nav'), '📅');
  };

  // '오늘로' 버튼은 캘린더 탭에서 오늘이 아닌 날짜/월을 보고 있을 때만 노출
  const showToday = state.tab === 'calendar' && (
    state.sel !== todayStr() || state.yr !== new Date().getFullYear() || state.mo !== new Date().getMonth()
  );

  const changeTab = (tab) => {
    dispatch({ type: 'SET_TAB', tab });
    if (tabContentRef.current) tabContentRef.current.scrollTop = 0;
  };

  const handleGoTo = (tab, ds) => {
    dispatch({ type: 'SET_TAB', tab });
    if (ds) dispatch({ type: 'SET_SEL', sel: ds });
  };

  // 일정 저장 후 모달 닫고 토스트 표시. 알림 설정(notifyBefore)에 따라 서비스워커에 예약/취소 메시지 전송.
  const handleSaveEvent = (ev, mode, prevDate) => {
    dispatch({ type: 'SAVE_EVENT', ev, mode, prevDate });
    setModal(null);
    setTimeout(() => toast(mode === 'edit' ? T('toast.saved') : T('toast.added'), mode === 'edit' ? '✏️' : '✅'), 0);
    navigator.serviceWorker?.ready.then(reg => {
      if (ev.notifyBefore != null && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        reg.active?.postMessage({ type: 'SCHEDULE_NOTIF', ev: { id: ev.id, title: ev.title, startTime: ev.startTime || '08:00', date: ev.startDate, notifyBefore: ev.notifyBefore } });
      } else {
        reg.active?.postMessage({ type: 'CANCEL_NOTIF', ev: { id: ev.id } });
      }
    });
  };
  const handleSaveDDay = (dd, mode) => { dispatch({ type: 'SAVE_DDAY', dd, mode }); setModal(null); setTimeout(() => toast(mode === 'edit' ? T('toast.saved') : T('toast.added'), '🚩'), 0); };
  const handleSaveHabit = (h, mode) => { dispatch({ type: 'SAVE_HABIT', h, mode }); setModal(null); setTimeout(() => toast(mode === 'edit' ? T('toast.saved') : T('toast.added'), '💪'), 0); };
  const handleSaveMood = (ds, mood) => { dispatch({ type: 'SAVE_MOOD', ds, mood }); setModal(null); };
  const handleCloudSync = async (direction) => { if (direction === 'up') await syncToCloud(); else await syncFromCloud(); };

  const ctxValue = { state, dispatch };

  // 온보딩 중이면 메인 UI 대신 온보딩 화면만 렌더
  if (showOnboarding) {
    return React.createElement(Onboarding, { onFinish: () => setShowOnboarding(false) });
  }

  // AppCtx(상태)·LangCtx(언어)로 감싼 뒤, 헤더 / 탭 콘텐츠 / 하단 내비 / 모달들을 렌더
  return React.createElement(AppCtx.Provider, { value: ctxValue },
    React.createElement(LangCtx.Provider, { value: state.lang },
    React.createElement('div', { className: 'app' },
      React.createElement(Header, { onSearch: () => setShowSearch(true), onAccount: () => setModal({ type: 'account' }), onSettings: () => setModal({ type: 'settings' }), onGallery: () => changeTab('gallery'), onToday: goToday, showToday, user }),
      React.createElement('div', { className: 'tab-content', ref: tabContentRef },
        state.tab === 'calendar' && React.createElement(CalendarTabUpgraded, { onOpenEvent: (ev, mode) => setModal({ type: 'event', ev, mode }), onOpenMood: (initEmoji) => setModal({ type: 'mood', initEmoji }) }),
        state.tab === 'gallery' && React.createElement(GalleryTabUpgraded),
        state.tab === 'dday' && React.createElement(DDayTab, { onOpen: (dd) => setModal({ type: 'dday', dd }) }),
        state.tab === 'goal' && React.createElement(GoalTab, { onOpen: (g) => setModal({ type: 'goal', g }) }),
        state.tab === 'habit' && React.createElement(HabitTab, { onOpen: (h) => setModal({ type: 'habit', h }) }),
        state.tab === 'stats'       && React.createElement(StatsTab),
        state.tab === 'feedback'    && React.createElement(FeedbackTab),
        state.tab === 'admin-users' && React.createElement(AdminUserTab),
      ),
      React.createElement(BottomNav, { tab: state.tab, onChange: changeTab, user }),
      modal?.type === 'event' && React.createElement(EventModal, { event: modal.ev, mode: modal.mode, onClose: () => setModal(null), onSave: handleSaveEvent, onDelete: (id) => { dispatch({ type: 'DELETE_EVENT', id }); setModal(null); setTimeout(() => toast(T('toast.deleted'), '🗑️'), 0); navigator.serviceWorker?.ready.then(reg => reg.active?.postMessage({ type: 'CANCEL_NOTIF', ev: { id } })); } }),
      modal?.type === 'dday' && React.createElement(DDayModal, { dd: modal.dd, onClose: () => setModal(null), onSave: handleSaveDDay }),
      modal?.type === 'habit' && React.createElement(HabitModal, { habit: modal.h, onClose: () => setModal(null), onSave: handleSaveHabit }),
      modal?.type === 'mood' && React.createElement(MoodModal, { sel: state.sel, moods: state.moods, initEmoji: modal.initEmoji, onClose: () => setModal(null), onSave: handleSaveMood }),
      modal?.type === 'goal' && React.createElement(GoalModal, {
        goal: modal.g, onClose: () => setModal(null),
        onSave: (goal, mode) => {
          dispatch({ type: 'SAVE_GOAL', goal, mode });
          setModal(null);
          setTimeout(() => toast(mode==='edit'?T('toast.saved'):T('toast.goal_added'), '🎯'), 0);
        },
      }),
      modal?.type === 'account' && React.createElement(AccountModal, { user, onClose: () => setModal(null), onCloudSync: handleCloudSync }),
      modal?.type === 'settings' && React.createElement(SettingsModal, { onClose: () => setModal(null) }),
      showSearch && React.createElement(SearchModal, { onClose: () => setShowSearch(false), onGo: handleGoTo }),
      showPwa && React.createElement('div', { className: 'pwa-banner' },
        React.createElement('div', { className: 'pwa-logo' }, '✿'),
        React.createElement('div', { className: 'pwa-text' },
          React.createElement('div', { className: 'pwa-title' }, T('pwa.title')),
          React.createElement('div', { className: 'pwa-sub' }, T('pwa.sub')),
        ),
        React.createElement('button', { className: 'pwa-install-btn', onClick: async () => { if (pwaDeferred) { pwaDeferred.prompt(); const { outcome } = await pwaDeferred.userChoice; if (outcome === 'accepted') setShowPwa(false); } } }, T('pwa.install')),
        React.createElement('button', { style: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--mut)', marginLeft: 8 }, onClick: () => setShowPwa(false) }, '✕'),
      ),
      React.createElement(OfflineBanner),
      React.createElement(NotifBanner),
      React.createElement('button', {
        className: `scroll-top-btn${scrollTopVisible ? ' visible' : ''}`,
        onClick: () => tabContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }, '↑'),
    )
    )
  );
};

export default AppUpgraded;
