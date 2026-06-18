/**
 * i18n.jsx — 다국어(국제화) 컨텍스트와 번역 훅.
 *
 * LangCtx로 현재 언어 코드를 흘려보내고, useT()는 'cal.mood' 같은 키를
 * 번역 문자열로 바꿔주는 함수를 돌려준다. 번역이 없으면 한국어 → 키 순으로 폴백.
 * 날짜 포맷은 언어별 표기 규칙이 달라 useDateI18n에서 따로 처리한다.
 */
import { createContext, useContext } from 'react';
import { TRANSLATIONS } from './translations.js';

// 현재 언어 코드를 트리 전체에 전달하는 컨텍스트 (기본 'ko')
export const LangCtx = createContext('ko');
export const useLang = () => useContext(LangCtx);
// useT — 컴포넌트에서 쓰는 번역 함수 t(key)를 반환. 현재 언어를 클로저로 잡는다.
export const useT = () => {
  const lang = useLang();
  return (key) => {
    const tr = TRANSLATIONS[lang] || TRANSLATIONS.ko;
    return tr[key] !== undefined ? tr[key] : TRANSLATIONS.ko[key] !== undefined ? TRANSLATIONS.ko[key] : key;
  };
};
// lookupT — 훅 밖(컴포넌트 외부)에서 직접 번역할 때 쓰는 비-훅 버전.
export const lookupT = (lang, key) => {
  const tr = TRANSLATIONS[lang] || TRANSLATIONS.ko;
  return tr[key] !== undefined ? tr[key] : TRANSLATIONS.ko[key] !== undefined ? TRANSLATIONS.ko[key] : key;
};
// useDateI18n — 언어별 날짜 표기 헬퍼 모음(fmtDate/fmtYrMo/fmtYr/getWd).
// 영어는 "Jan 5", 중/일은 "1月5日", 한국어는 "1월 5일"처럼 규칙이 달라 분기한다.
export const useDateI18n = () => {
  const lang = useLang();
  const t = useT();
  const fmtDate = (dateStr) => {
    if (!dateStr) return '';
    const mm = dateStr.match(/\d{4}-(\d{2})-(\d{2})/);
    if (!mm) return dateStr;
    const mo = parseInt(mm[1]) - 1, day = parseInt(mm[2]);
    const ms = t('mo.' + mo);
    if (lang === 'en') return ms + ' ' + day;
    if (lang === 'zh' || lang === 'ja') return ms + day + '日';
    return ms + ' ' + day + '일';
  };
  const fmtYrMo = (y, m) => { const ms = t('mo.' + m); return lang === 'en' ? ms + ' ' + y : y + t('cal.yr_suffix') + ' ' + ms; };
  const fmtYr = (y) => lang === 'en' ? String(y) : y + t('cal.yr_suffix');
  const getWd = () => Array.from({length:7}, (_, i) => t('wd.' + i));
  return { fmtDate, fmtYrMo, fmtYr, getWd };
};
