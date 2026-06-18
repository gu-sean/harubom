/**
 * components/onboarding/index.jsx — 첫 실행 시 보여주는 온보딩 슬라이드.
 *
 * ONBOARDING_SLIDES를 한 장씩 넘기며 앱 소개를 보여주고, 마지막/건너뛰기에서
 * LS.ONBOARDED 플래그를 세운 뒤 onFinish로 본 화면으로 넘긴다.
 */
import React, { useState } from 'react';
import { LS } from '../../constants.js';
import { useT } from '../../i18n.jsx';

// 온보딩 슬라이드 정의. 문구는 번역 키로, 배경은 슬라이드별 그라데이션.
const ONBOARDING_SLIDES = [
  { emoji: '🌸', titleKey: 'onboard.0.title', descKey: 'onboard.0.desc', color: 'linear-gradient(135deg, #F5604A, #FF9A7B)' },
  { emoji: '📅', titleKey: 'onboard.1.title', descKey: 'onboard.1.desc', color: 'linear-gradient(135deg, #4A90D9, #7EC8E3)' },
  { emoji: '🎯', titleKey: 'onboard.2.title', descKey: 'onboard.2.desc', color: 'linear-gradient(135deg, #9B7FD4, #FF6CAE)' },
  { emoji: '💪', titleKey: 'onboard.3.title', descKey: 'onboard.3.desc', color: 'linear-gradient(135deg, #52B69A, #95D44A)' },
  { emoji: '🖼', titleKey: 'onboard.4.title', descKey: 'onboard.4.desc', color: 'linear-gradient(135deg, #FFB347, #FF6CAE)' },
];

// Onboarding — 슬라이드 캐러셀. next로 다음 장, 마지막이면 완료 처리.
const Onboarding = ({ onFinish }) => {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const slide = ONBOARDING_SLIDES[idx];
  const isLast = idx === ONBOARDING_SLIDES.length - 1;

  // 다음 장으로. 마지막 장이면 온보딩 완료 플래그를 저장하고 종료.
  const next = () => {
    if (isLast) {
      localStorage.setItem(LS.ONBOARDED, '1');
      onFinish();
    } else {
      setIdx(i => i + 1);
    }
  };

  const skip = () => {
    localStorage.setItem(LS.ONBOARDED, '1');
    onFinish();
  };

  return React.createElement('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: slide.color, transition: 'background 0.4s ease',
      padding: '32px 28px',
    }
  },
    // 건너뛰기
    idx < ONBOARDING_SLIDES.length - 1 && React.createElement('button', {
      onClick: skip,
      style: { position: 'absolute', top: 52, right: 20, background: 'rgba(255,255,255,.25)', border: 'none', borderRadius: 20, padding: '6px 14px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }
    }, t('onboard.skip')),

    // 슬라이드 내용
    React.createElement('div', { style: { textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' } },
      React.createElement('div', { style: { fontSize: 88, marginBottom: 28, lineHeight: 1 } }, slide.emoji),
      React.createElement('div', { style: { fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 14, letterSpacing: '-0.5px', lineHeight: 1.3 } }, t(slide.titleKey)),
      React.createElement('div', { style: { fontSize: 15, color: 'rgba(255,255,255,.85)', lineHeight: 1.8 } }, t(slide.descKey)),
    ),

    // 인디케이터
    React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 28 } },
      ONBOARDING_SLIDES.map((_, i) => React.createElement('div', {
        key: i,
        style: {
          height: 6, borderRadius: 3,
          width: i === idx ? 24 : 6,
          background: i === idx ? '#fff' : 'rgba(255,255,255,.35)',
          transition: 'all .3s',
        }
      }))
    ),

    // 버튼
    React.createElement('button', {
      onClick: next,
      style: {
        width: '100%', maxWidth: 320, padding: '16px', borderRadius: 999,
        background: '#fff', border: 'none',
        color: '#F5604A', fontSize: 16, fontWeight: 900,
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: '0 4px 20px rgba(0,0,0,.15)',
        transition: 'transform .1s',
      },
      onMouseDown: e => e.currentTarget.style.transform = 'scale(.97)',
      onMouseUp: e => e.currentTarget.style.transform = '',
      onTouchStart: e => e.currentTarget.style.transform = 'scale(.97)',
      onTouchEnd: e => e.currentTarget.style.transform = '',
    }, isLast ? t('onboard.start') : t('onboard.next')),
  );
};

export { ONBOARDING_SLIDES, Onboarding };
