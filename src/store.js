/**
 * store.js — 앱 전역 상태(useReducer)와 localStorage 영속화 계층.
 *
 * INIT_STATE로 LS에서 초기 상태를 복원하고, reducer가 모든 액션을 처리한 뒤
 * saveToLS로 자동 저장한다(SET_TAB 제외). getEventsForDate는 원본 일정에서
 * 반복/멀티데이 인스턴스를 전개해 특정 날짜의 일정 목록을 만들어준다.
 * AppCtx로 {state, dispatch}를 트리 전체에 공급한다.
 */
import { createContext, useContext } from 'react';
import { LS } from './constants.js';
import { todayStr, fmtD, uid } from './utils.js';

// INIT_STATE — localStorage에서 저장본을 읽어 초기 상태를 구성. 파싱 실패 시 빈 기본 상태로 폴백.
export const INIT_STATE = () => {
  try {
    const raw = localStorage.getItem(LS.DATA);
    if (raw) {
      const d = JSON.parse(raw);
      // 사진 원본(dataUrl)은 IndexedDB/Storage에 있으므로 LS 복원 시엔 메타데이터만 남긴다(용량 절감)
      const cleanGallery = (d.gallery || []).map(photo => {
        const { dataUrl, ...meta } = photo;
        return meta;
      });
      return {
        tab: 'calendar',
        yr: new Date().getFullYear(),
        mo: new Date().getMonth(),
        sel: todayStr(),
        calView: d.calView || 'month',
        events: d.events || {},
        ddays: d.ddays || [],
        habits: d.habits || [],
        habitLogs: d.habitLogs || {},
        moods: d.moods || {},
        gallery: cleanGallery,
        recurDone: d.recurDone || {},
        repeatExceptions: d.repeatExceptions || {},
        goals: d.goals || [],
        photoCalendars: d.photoCalendars || [],
        reviews: d.reviews || {},
        theme: localStorage.getItem(LS.THEME) || 'pink',
        dark: localStorage.getItem(LS.DARK) === '1',
        lang: localStorage.getItem(LS.LANG) || 'ko',
        evCatFilter: 'all',
        evColorFilter: 'all',
        recentTags: JSON.parse(localStorage.getItem(LS.TAGS) || '[]'),
      };
    }
  } catch(_) {}
  return {
    tab: 'calendar', yr: new Date().getFullYear(), mo: new Date().getMonth(),
    sel: todayStr(), calView: 'month',
    events: {}, ddays: [], habits: [], habitLogs: {}, moods: {}, gallery: [],
    recurDone: {}, repeatExceptions: {}, reviews: {},
    theme: localStorage.getItem(LS.THEME) || 'pink',
    dark: localStorage.getItem(LS.DARK) === '1',
    lang: localStorage.getItem(LS.LANG) || 'ko',
    goals: [],
    photoCalendars: [],
    evCatFilter: 'all', evColorFilter: 'all',
    recentTags: JSON.parse(localStorage.getItem(LS.TAGS) || '[]'),
  };
};

// saveToLS — 영속화가 필요한 슬라이스만 골라 LS.DATA에 직렬화 저장.
// (tab/yr/mo/sel 같은 휘발성 UI 상태는 저장하지 않음)
export const saveToLS = (state) => {
  try {
    localStorage.setItem(LS.DATA, JSON.stringify({
      calView: state.calView, events: state.events, ddays: state.ddays,
      habits: state.habits, habitLogs: state.habitLogs, moods: state.moods,
      // 갤러리는 원본 이미지 제외, 썸네일/보정값/스토리지 키 등 메타만 저장
      gallery: state.gallery.map(p => ({ id:p.id, thumb:p.thumb, storageKey:p.storageKey, filter:p.filter, br:p.br, co:p.co, sa:p.sa, rot:p.rot, stk:p.stk, uploaded:p.uploaded, edited:p.edited })),
      goals: state.goals || [],
      photoCalendars: state.photoCalendars || [],
      reviews: state.reviews || {},
      recurDone: state.recurDone, repeatExceptions: state.repeatExceptions,
    }));
  } catch(e) {
    if (e.name === 'QuotaExceededError') {
      // 용량 초과 시 가장 무거운 갤러리를 비우고 한 번 더 시도(데이터 손실보다 저장 실패 방지 우선)
      console.warn('localStorage 용량 초과. 갤러리 데이터 제외 후 재시도');
      try {
        const slim = {...state, gallery: []};
        localStorage.setItem(LS.DATA, JSON.stringify(slim));
      } catch(_) {}
    }
  }
};

// reducer — 모든 상태 변경의 단일 진입점. 액션 타입별로 next 상태를 만들고
// 끝에서 saveToLS로 영속화한다(SET_TAB만 저장 생략). 상태는 항상 불변 갱신.
export const reducer = (state, action) => {
  let next = state;
  switch(action.type) {
    case 'SET_TAB': next = {...state, tab: action.tab}; break;
    case 'SET_DATE': next = {...state, yr: action.yr, mo: action.mo, sel: action.sel}; break;
    case 'SET_SEL': next = {...state, sel: action.sel}; break;
    case 'SET_CAL_VIEW': next = {...state, calView: action.view}; break;
    case 'SAVE_EVENT': {
      // 일정 생성/수정. 일정은 events[시작날짜] 버킷에 저장된다.
      const { ev, mode, prevDate } = action;
      const events = {...state.events};
      // 수정 중 날짜가 바뀌었으면 이전 날짜 버킷에서 먼저 제거(중복 방지)
      if (mode === 'edit' && prevDate && prevDate !== ev.startDate) {
        events[prevDate] = (events[prevDate]||[]).filter(e => e.id !== ev.id);
      }
      events[ev.startDate] = mode === 'edit'
        ? (events[ev.startDate]||[]).map(e => e.id === ev.id ? ev : e)
        : [...(events[ev.startDate]||[]), ev];
      const d = new Date(ev.startDate+'T00:00:00');
      next = {...state, events, sel: ev.startDate, yr: d.getFullYear(), mo: d.getMonth()};
      break;
    }
    case 'TOGGLE_DONE': {
      if (action.ds && action.originDate) {
        // 반복 일정은 원본 1개만 저장되므로, 인스턴스별 완료 여부는 recurDone[id_날짜]로 따로 기록
        const key = action.id + '_' + action.ds;
        const recurDone = {...(state.recurDone||{}), [key]: !(state.recurDone||{})[key]};
        next = {...state, recurDone};
        break;
      }
      const events = {...state.events};
      let found = false;
      const sel = state.sel;
      // 보통은 선택 날짜 버킷에 있지만, 못 찾으면 전체 버킷을 훑어 토글(멀티데이/날짜 불일치 대비)
      if ((events[sel]||[]).find(e => e.id === action.id)) {
        events[sel] = events[sel].map(e => e.id === action.id ? {...e, done: !e.done} : e);
        found = true;
      }
      if (!found) {
        Object.keys(events).forEach(ds => {
          if ((events[ds]||[]).find(e => e.id === action.id)) {
            events[ds] = events[ds].map(e => e.id === action.id ? {...e, done: !e.done} : e);
          }
        });
      }
      next = {...state, events};
      break;
    }
    case 'DELETE_RECUR_ONE': {
      // 반복 일정 중 '이 날짜만' 삭제: 원본은 두고 repeatExceptions에 예외 키만 등록 → 전개 시 건너뜀
      const key = action.originDate + '_' + action.id + '_' + action.ds;
      next = {...state, repeatExceptions: {...(state.repeatExceptions||{}), [key]: true}};
      break;
    }
    case 'DELETE_RECUR_FUTURE': {
      // '이 날짜 이후 모두' 삭제: 반복 종료일(repeatUntil)을 전날로 당겨 그 이후 전개를 막음
      const events = {...state.events};
      const prevDay = new Date(action.ds + 'T00:00:00');
      prevDay.setDate(prevDay.getDate() - 1);
      const until = fmtD(prevDay);
      events[action.originDate] = (events[action.originDate]||[]).map(e =>
        e.id === action.id ? {...e, repeatUntil: until} : e
      );
      next = {...state, events};
      break;
    }
    case 'COPY_EVENT': {
      // 다른 날짜로 복사: 새 id를 부여하고 완료 상태는 초기화
      const { ev, toDs } = action;
      const newEv = { ...ev, id: uid(), startDate: toDs, endDate: toDs, done: false };
      const events = { ...state.events };
      events[toDs] = [...(events[toDs] || []), newEv];
      const d = new Date(toDs + 'T00:00:00');
      next = { ...state, events, sel: toDs, yr: d.getFullYear(), mo: d.getMonth() };
      break;
    }
    case 'MOVE_EVENT': {
      // 일정을 다른 날짜로 이동(드래그). 원래 버킷에서 빼고 대상 버킷으로 옮김(id 유지)
      const { evId, fromDs, toDs } = action;
      const events = { ...state.events };
      const ev = (events[fromDs] || []).find(e => e.id === evId);
      if (!ev) { next = state; break; }
      events[fromDs] = (events[fromDs] || []).filter(e => e.id !== evId);
      const movedEv = { ...ev, startDate: toDs, endDate: toDs };
      events[toDs] = [...(events[toDs] || []), movedEv];
      const d = new Date(toDs + 'T00:00:00');
      next = { ...state, events, sel: toDs, yr: d.getFullYear(), mo: d.getMonth() };
      break;
    }
    case 'DELETE_EVENT': {
      // 어느 날짜 버킷에 있든 같은 id를 모두 제거(멀티데이/이동 이력 대비 전체 순회)
      const events = {...state.events};
      Object.keys(events).forEach(dt => { events[dt] = (events[dt]||[]).filter(e => e.id !== action.id); });
      next = {...state, events};
      break;
    }
    case 'TOGGLE_PIN': {
      const events = {...state.events};
      events[state.sel] = (events[state.sel]||[]).map(e => e.id === action.id ? {...e, pinned: !e.pinned} : e);
      next = {...state, events};
      break;
    }
    case 'SAVE_DDAY': {
      const ddays = action.mode === 'edit'
        ? state.ddays.map(d => d.id === action.dd.id ? action.dd : d)
        : [...state.ddays, action.dd];
      next = {...state, ddays};
      break;
    }
    case 'DELETE_DDAY': next = {...state, ddays: state.ddays.filter(d => d.id !== action.id)}; break;
    case 'SAVE_HABIT': {
      const habits = action.mode === 'edit'
        ? state.habits.map(h => h.id === action.h.id ? action.h : h)
        : [...state.habits, action.h];
      next = {...state, habits};
      break;
    }
    case 'DELETE_HABIT': {
      // 습관 삭제 시 모든 날짜의 해당 습관 기록(habitLogs)도 함께 정리
      const habitLogs = {...state.habitLogs};
      Object.keys(habitLogs).forEach(ds => { if (habitLogs[ds]) delete habitLogs[ds][action.id]; });
      next = {...state, habits: state.habits.filter(h => h.id !== action.id), habitLogs};
      break;
    }
    case 'TOGGLE_HAB_LOG': {
      const habitLogs = {...state.habitLogs};
      if (!habitLogs[action.ds]) habitLogs[action.ds] = {};
      habitLogs[action.ds][action.id] = !habitLogs[action.ds][action.id];
      next = {...state, habitLogs};
      break;
    }
    case 'SAVE_MOOD': {
      next = {...state, moods: {...state.moods, [action.ds]: action.mood}};
      break;
    }
    case 'ADD_PHOTO': next = {...state, gallery: [action.photo, ...state.gallery]}; break;
    case 'UPDATE_PHOTO': next = {...state, gallery: state.gallery.map(p => p.id === action.photo.id ? action.photo : p)}; break;
    case 'DELETE_PHOTO': next = {...state, gallery: state.gallery.filter(p => p.id !== action.id)}; break;
    case 'REORDER_GALLERY': next = {...state, gallery: action.gallery}; break;
    case 'SET_THEME': next = {...state, theme: action.theme}; break;
    case 'SET_DARK': next = {...state, dark: action.dark}; break;
    case 'SET_LANG': next = {...state, lang: action.lang}; localStorage.setItem(LS.LANG, action.lang); break;
    case 'SET_EV_FILTER': next = {...state, evCatFilter: action.cat, evColorFilter: action.color}; break;
    case 'ADD_RECENT_TAG': {
      // 최근 태그를 맨 앞으로(중복 제거) 최대 20개 유지 — 자동완성 추천용
      const tag = action.tag.trim().replace(/^#/, '');
      if (!tag) { next = state; break; }
      const recent = [tag, ...(state.recentTags || []).filter(t => t !== tag)].slice(0, 20);
      localStorage.setItem(LS.TAGS, JSON.stringify(recent));
      next = {...state, recentTags: recent};
      break;
    }
    case 'SAVE_PHOTO_CALENDAR': {
      const cals = state.photoCalendars || [];
      const exists = cals.find(c => c.id === action.cal.id);
      next = {...state, photoCalendars: exists
        ? cals.map(c => c.id === action.cal.id ? action.cal : c)
        : [...cals, action.cal]};
      break;
    }
    case 'DELETE_PHOTO_CALENDAR':
      next = {...state, photoCalendars: (state.photoCalendars||[]).filter(c => c.id !== action.id)};
      break;
    case 'SAVE_GOAL': {
      const goals = action.mode === 'edit'
        ? (state.goals||[]).map(g => g.id === action.goal.id ? action.goal : g)
        : [...(state.goals||[]), action.goal];
      next = {...state, goals};
      break;
    }
    case 'DELETE_GOAL':
      next = {...state, goals: (state.goals||[]).filter(g => g.id !== action.id)};
      break;
    case 'UPDATE_GOAL_PROGRESS': {
      // 진행도 직접 입력. 목표치를 넘지 않도록 상한 클램프
      const goals = (state.goals||[]).map(g =>
        g.id === action.id ? {...g, current: Math.min(action.value, g.target)} : g
      );
      next = {...state, goals};
      break;
    }
    case 'CLOUD_RESTORE': {
      // 클라우드 백업 복원. 필드별 타입을 검증해 올바른 형태일 때만 덮어쓴다(손상 데이터 방어)
      const d = action.data || {};
      next = {...state,
        events:        (typeof d.events === 'object' && !Array.isArray(d.events)) ? d.events : state.events,
        ddays:         Array.isArray(d.ddays)    ? d.ddays    : state.ddays,
        habits:        Array.isArray(d.habits)   ? d.habits   : state.habits,
        habitLogs:     (typeof d.habitLogs === 'object') ? d.habitLogs : state.habitLogs,
        moods:         (typeof d.moods === 'object')     ? d.moods     : state.moods,
        gallery:       Array.isArray(d.gallery)  ? d.gallery  : state.gallery,
        goals:         Array.isArray(d.goals)    ? d.goals    : state.goals,
        photoCalendars:Array.isArray(d.photoCalendars) ? d.photoCalendars : state.photoCalendars,
      };
      break;
    }
    case 'SAVE_REVIEW': {
      next = {...state, reviews: {...(state.reviews||{}), [action.ds]: { text: action.text, ts: Date.now() }}};
      break;
    }
    default: next = state;
  }
  // 탭 전환은 휘발성 UI 상태라 저장하지 않음. 그 외 모든 변경은 즉시 영속화.
  if (action.type !== 'SET_TAB') saveToLS(next);
  return next;
};

// getEventsForDate — 특정 날짜(ds)에 표시할 일정 목록을 만든다.
// 세 종류를 합친다: ① 그 날 직접 등록된 일정 ② 원본을 전개한 반복 인스턴스 ③ 멀티데이 일정의 연속분.
export const getEventsForDate = (state, ds) => {
  // ① 해당 날짜에 직접 저장된 비반복 일정
  const direct = (state.events[ds]||[]).filter(ev => !ev.repeat || ev.repeat === 'none');
  // ② 모든 원본 일정을 훑어 ds에 해당하는 반복 인스턴스를 생성
  const recurring = [];
  Object.values(state.events).flat().forEach(ev => {
    if (!ev.repeat || ev.repeat === 'none') return;
    const key = `${ev.startDate}_${ev.id}_${ds}`;
    if (state.repeatExceptions[key]) return; // '이 날짜만 삭제'된 예외는 건너뜀
    const start = new Date(ev.startDate+'T00:00:00');
    const target = new Date(ds+'T00:00:00');
    if (ds <= ev.startDate) return;                       // 원본 시작일 당일/이전은 ①에서 처리
    if (ev.repeatUntil && ds > ev.repeatUntil) return;    // 반복 종료일을 넘긴 날짜는 제외
    // 주기별 도래 조건: 매일=항상, 매주=같은 요일, 매월=같은 일, 매년=같은 월/일
    let match = false;
    if (ev.repeat === 'daily') match = true;
    else if (ev.repeat === 'weekly') match = target.getDay() === start.getDay();
    else if (ev.repeat === 'monthly') match = target.getDate() === start.getDate();
    else if (ev.repeat === 'yearly') match = target.getMonth() === start.getMonth() && target.getDate() === start.getDate();
    // 완료 여부는 인스턴스별 recurDone에서 읽어와 done에 주입
    if (match) recurring.push({...ev, isRecurring: true, originDate: ev.startDate, id: ev.id, done: !!(state.recurDone||{})[ev.id+'_'+ds]});
  });
  // ③ 여러 날에 걸친 일정의 '중간 날짜'분(시작일은 ①에서 이미 표시되므로 그 이후만)
  const multiDay = [];
  Object.values(state.events).flat().forEach(ev => {
    if (!ev.endDate || ev.endDate <= ev.startDate) return;
    if (ds > ev.startDate && ds <= ev.endDate) multiDay.push({...ev, isMultiDayContinued: true});
  });
  return [...direct, ...recurring, ...multiDay].sort((a,b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const po = {high:0,normal:1,low:2};
    return (po[a.priority||'normal']??1) - (po[b.priority||'normal']??1) || (a.startTime||'').localeCompare(b.startTime||'');
  });
};

// ══════════════════════════════════════
// Context — {state, dispatch}를 트리 전체에 공급. useApp()으로 소비.
// ══════════════════════════════════════
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
