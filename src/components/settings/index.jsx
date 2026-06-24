/**
 * components/settings/index.jsx — 설정 모달.
 *
 * 테마/언어, 푸시 알림(FCM 토큰 발급/해제) 설정을 담는다.
 */
import React, { useState, useEffect } from 'react';
import { THEMES } from '../../constants.js';
import { useT } from '../../i18n.jsx';
import { toast } from '../../utils.js';
import { useApp } from '../../store.js';

// SettingsModal — 설정 화면 전체. 알림/테마/언어 섹션을 담는다.
const SettingsModal = ({ onClose }) => {
  const { state, dispatch } = useApp();
  const t = useT();
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifHour, setNotifHour] = useState(9); // 기본 09:00 KST

  // 로그인 상태면 서버에 저장된 알림 on/off + 시각을 읽어와 동기화
  useEffect(() => {
    const user = window._currentUser;
    if (!user || !window._FB?.enabled) return;
    const { fs, doc, getDoc } = window._FB;
    getDoc(doc(fs, 'users', user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setNotifEnabled(!!data.notifEnabled);
        if (data.notifHour != null) setNotifHour(data.notifHour);
      }
    }).catch(() => {});
  }, []);

  // saveNotifHour — 알림 시각 변경 즉시 Firestore에 저장
  const saveNotifHour = async (hour) => {
    setNotifHour(hour);
    const user = window._currentUser;
    if (!user || !window._FB?.enabled) return;
    const { fs, doc, setDoc } = window._FB;
    await setDoc(doc(fs, 'users', user.uid), { notifHour: hour }, { merge: true }).catch(() => {});
  };

  const NOTIF_HOURS = [6, 7, 8, 9, 10, 11, 12, 18, 20, 22];
  const supportsNotif = typeof Notification !== 'undefined';

  // toggleNotif — 푸시 알림 켜기/끄기. 켤 때 권한 요청 → FCM 토큰 발급 → 서버 저장, 끌 때 토큰 제거.
  const toggleNotif = async () => {
    const user = window._currentUser;
    if (!user) { toast(t('settings.notif.need_login'), '🔐'); return; }
    if (!window._FB?.enabled || !window._FB?.messaging) { toast(t('settings.notif.error'), '⚠️'); return; }

    setNotifLoading(true);
    try {
      const { fs, doc, setDoc, getToken, messaging } = window._FB;

      if (notifEnabled) {
        await setDoc(doc(fs, 'users', user.uid), { notifEnabled: false, fcmToken: null }, { merge: true });
        setNotifEnabled(false);
        toast(t('settings.notif.off'), '🔕');
      } else {
        const permission = await Notification.requestPermission();
        if (permission === 'denied') { toast(t('settings.notif.blocked'), '🚫'); setNotifLoading(false); return; }
        if (permission !== 'granted') { setNotifLoading(false); return; }

        const reg = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, { vapidKey: window.VAPID_KEY, serviceWorkerRegistration: reg });
        if (!token) throw new Error('No token');

        await setDoc(doc(fs, 'users', user.uid), { notifEnabled: true, fcmToken: token }, { merge: true });
        setNotifEnabled(true);
        toast(t('settings.notif.on'), '🔔');
      }
    } catch (e) {
      console.error('notif toggle:', e);
      toast(t('settings.notif.error'), '⚠️');
    }
    setNotifLoading(false);
  };

  // applyTheme — 테마 변경. 다크모드 중엔 data-theme를 건드리지 않고 값만 저장(다크 우선).
  const applyTheme = (id) => {
    dispatch({ type: 'SET_THEME', theme: id });
    if (!state.dark) {
      document.documentElement.setAttribute('data-theme', id === 'pink' ? '' : id);
    }
  };

  const LANG_OPTIONS = [
    { id: 'ko', label: '한국어', flag: '🇰🇷' },
    { id: 'en', label: 'English', flag: '🇺🇸' },
    { id: 'zh', label: '中文', flag: '🇨🇳' },
    { id: 'ja', label: '日本語', flag: '🇯🇵' },
  ];

  return React.createElement('div', {className:'overlay open', onClick:onClose},
    React.createElement('div', {className:'sheet', onClick:e=>e.stopPropagation()},
      React.createElement('div', {className:'sheet-handle'}),
      React.createElement('div', {className:'sheet-header'},
        React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('div', {className:'sheet-title'}, t('settings.title')),
          React.createElement('button', {style:{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--mut)'}, onClick:onClose}, '✕'),
        ),
      ),
      React.createElement('div', {className:'sheet-body'},
        React.createElement('div', {className:'settings-section'},
          React.createElement('div', {className:'settings-section-title'}, t('settings.theme')),
          React.createElement('div', {className:'theme-row'},
            THEMES.map(th => React.createElement('button', {key:th.id, className:`theme-btn${state.theme===th.id?' active':''}`, onClick:()=>applyTheme(th.id)},
              React.createElement('div', {className:'theme-circle', style:{background:th.color}}),
              React.createElement('div', {className:'theme-lbl'}, t('theme.'+th.id)),
            ))
          ),
        ),
        React.createElement('div', {className:'settings-section'},
          React.createElement('div', {className:'settings-section-title'}, t('settings.lang')),
          React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}},
            LANG_OPTIONS.map(lo => React.createElement('button', {
              key: lo.id,
              onClick: () => dispatch({ type: 'SET_LANG', lang: lo.id }),
              style: {
                padding: '12px 8px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                border: `2px solid ${state.lang === lo.id ? 'var(--pri)' : 'var(--bor)'}`,
                background: state.lang === lo.id ? 'var(--pri-light)' : 'var(--sur2)',
                color: state.lang === lo.id ? 'var(--pri)' : 'var(--txt)',
                fontWeight: state.lang === lo.id ? 800 : 500,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              },
            },
              React.createElement('span', {style:{fontSize:22}}, lo.flag),
              React.createElement('span', {style:{fontSize:13}}, lo.label),
            ))
          ),
        ),
        supportsNotif && React.createElement('div', { className: 'settings-section' },
          React.createElement('div', { className: 'settings-section-title' }, t('settings.notif')),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--mut)', marginBottom: 12 } }, t('settings.notif.desc')),
          React.createElement('button', {
            onClick: toggleNotif,
            disabled: notifLoading,
            style: {
              width: '100%', padding: '13px 16px', borderRadius: 14, border: 'none', cursor: notifLoading ? 'default' : 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              background: notifEnabled ? 'var(--pri)' : 'var(--sur2)',
              color: notifEnabled ? '#fff' : 'var(--txt)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: notifLoading ? 0.6 : 1,
              transition: 'all .2s',
            },
          },
            notifLoading ? '⏳ 처리 중...' : notifEnabled ? '🔔 ' + t('settings.notif.off') : '🔕 ' + t('settings.notif.on'),
          ),
          notifEnabled && React.createElement(React.Fragment, null,
            React.createElement('div', { style: { fontSize: 12, color: 'var(--mut)', margin: '14px 0 8px', fontWeight: 700 } }, '알림 시각 (KST)'),
            React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
              NOTIF_HOURS.map(h => React.createElement('button', {
                key: h,
                onClick: () => saveNotifHour(h),
                style: {
                  padding: '8px 14px', borderRadius: 99, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  background: notifHour === h ? 'var(--pri)' : 'var(--sur2)',
                  color: notifHour === h ? '#fff' : 'var(--txt)',
                  transition: 'all .15s',
                },
              }, String(h).padStart(2, '0') + ':00')),
            ),
          ),
        ),
        React.createElement('div', {style:{textAlign:'center',marginTop:24,fontSize:12,color:'var(--mut)'}},
          '✿ 하루봄 v2.0',
          React.createElement('br'),
          'naharu-app.firebaseapp.com',
        ),
      ),
    ),
  );
};

export { SettingsModal };
