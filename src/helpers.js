/**
 * helpers.js — 목표(goal) 도메인 전용 헬퍼 모음.
 *
 * 목표 카테고리/기간 프리셋, 기간→날짜 범위 변환, 진행률 계산(getGoalProgress),
 * 일정 정렬(sortEvs), 그리고 달성 축하용 공유 카드를 canvas로 그리는 drawGoalShareCard를 export.
 * store의 getEventsForDate에 의존해 'event' 타입 목표의 진행도를 집계한다.
 */
import { todayStr, fmtD } from './utils.js';
import { getEventsForDate } from './store.js';

// drawGoalShareCard — 목표 달성 시 SNS 공유용 카드 이미지를 canvas에 그려 반환.
// goal(목표), cat(카테고리 메타), t(번역 함수)를 받아 560x700 캔버스를 그린다.
const drawGoalShareCard = (goal, cat, t) => {
  const W = 560, H = 700;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');

  // 둥근 모서리 사각형 패스 헬퍼 (canvas에 roundRect 미지원 환경 대비해 직접 구현)
  const rrect = (x, y, w, h, r) => {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  };

  // Background gradient
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, cat.color); bg.addColorStop(1, '#1a0816');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);

  // Decorative circles
  c.globalAlpha = 0.08; c.fillStyle = '#fff';
  c.beginPath(); c.arc(0, 0, 220, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(W, H, 260, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 1;

  // White card
  c.fillStyle = '#fff';
  rrect(28, 88, W - 56, 512, 26); c.fill();

  // Emoji circle
  c.fillStyle = cat.color + '18';
  c.beginPath(); c.arc(W / 2, 218, 64, 0, Math.PI * 2); c.fill();
  c.font = '60px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#000'; c.fillText(goal.emoji || '🏆', W / 2, 218);

  // Celebrate label
  c.fillStyle = cat.color;
  c.font = 'bold 13px -apple-system,system-ui,sans-serif';
  c.textBaseline = 'top';
  c.fillText(t('goal.celebrate').toUpperCase(), W / 2, 300);

  // Goal title — 카드 폭을 넘으면 한 글자씩 잘라내고 말줄임표(…)를 붙인다
  c.fillStyle = '#111'; c.font = 'bold 24px -apple-system,system-ui,sans-serif';
  let titleTxt = goal.title;
  const maxTW = W - 80;
  while (c.measureText(titleTxt).width > maxTW && titleTxt.length > 1) titleTxt = titleTxt.slice(0, -1);
  if (titleTxt !== goal.title) titleTxt += '…';
  c.fillText(titleTxt, W / 2, 334);

  // Category · stat
  c.fillStyle = '#888'; c.font = '13px -apple-system,system-ui,sans-serif';
  c.fillText(cat.emoji + ' ' + t('gcat.' + cat.id) + '  ·  ' + (goal.current || 0) + (goal.unit ? ' ' + goal.unit : '') + t('goal.achieve_stat'), W / 2, 374);

  // Divider
  c.strokeStyle = '#eee'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(68, 410); c.lineTo(W - 68, 410); c.stroke();

  // Message (2 lines max) — 글자 단위로 폭을 재며 줄바꿈해 최대 2줄까지만 표시
  c.fillStyle = '#555'; c.font = '12px -apple-system,system-ui,sans-serif';
  const fullMsg = t('goal.achieve_msg').replace(/["""'"']/g, '');
  const maxMW = W - 100; const msgLines = []; let line = '';
  for (const ch of fullMsg) {
    const test = line + ch;
    if (c.measureText(test).width > maxMW && line) {
      msgLines.push(line); line = ch;
      if (msgLines.length >= 2) break;
    } else { line = test; }
  }
  if (msgLines.length < 2 && line) msgLines.push(line);
  msgLines.forEach((l, i) => c.fillText(l, W / 2, 428 + i * 22));

  // Stars
  c.font = '16px serif'; c.textBaseline = 'middle';
  c.fillText('⭐️⭐️⭐️', W / 2, 490);

  // Branding
  c.fillStyle = 'rgba(255,255,255,.92)'; c.font = 'bold 18px -apple-system,system-ui,sans-serif';
  c.textBaseline = 'middle'; c.fillText('✿ Harubom', W / 2, H - 48);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.font = '12px -apple-system,system-ui,sans-serif';
  c.fillText(new Date().toLocaleDateString(), W / 2, H - 24);

  return cv;
};

// 목표 카테고리 프리셋(id가 저장 키, label은 폴백용 한국어). 번역은 'gcat.<id>' 키 사용.
const GOAL_CATEGORIES = [
  {id:'health',  emoji:'🏃', label:'건강·운동', color:'#3DBFA0'},
  {id:'study',   emoji:'📚', label:'학습·성장', color:'#9B7FD4'},
  {id:'work',    emoji:'💼', label:'업무·커리어', color:'#4A90D9'},
  {id:'habit',   emoji:'💪', label:'습관 형성', color:'#F5604A'},
  {id:'finance', emoji:'💰', label:'재정·저축', color:'#FFB347'},
  {id:'social',  emoji:'🤝', label:'인간관계', color:'#FF6CAE'},
  {id:'hobby',   emoji:'🎨', label:'취미·여가', color:'#52B69A'},
  {id:'other',   emoji:'⭐', label:'기타', color:'#888'},
];

// 목표 달성 기간 프리셋. custom은 사용자가 직접 시작/종료일을 지정.
const GOAL_PERIODS = [
  {id:'week',    label:'이번 주'},
  {id:'month',   label:'이번 달'},
  {id:'quarter', label:'이번 분기'},
  {id:'year',    label:'올해'},
  {id:'custom',  label:'직접 설정'},
];

// getGoalPeriodDates — 기간 id를 받아 {start, end} 날짜 문자열 범위로 변환.
const getGoalPeriodDates = (period) => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch(period) {
    case 'week': {
      // 월요일 시작 주: 일요일(getDay()===0)이면 6일 뒤로 빼서 같은 주의 월요일을 잡는다
      const d = now.getDay(), diff = d === 0 ? -6 : 1 - d;
      const mon = new Date(now); mon.setDate(now.getDate() + diff);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: fmtD(mon), end: fmtD(sun) };
    }
    case 'month':
      return { start: `${y}-${String(m+1).padStart(2,'0')}-01`, end: fmtD(new Date(y, m+1, 0)) };
    case 'quarter': {
      const q = Math.floor(m/3); // 0~3 분기. 시작 월 = q*3+1, 종료일 = 다음 분기 0일(=말일)

      return { start: `${y}-${String(q*3+1).padStart(2,'0')}-01`, end: fmtD(new Date(y, q*3+3, 0)) };
    }
    case 'year':
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    default:
      return { start: todayStr(), end: todayStr() };
  }
};

// getGoalProgress — 목표 타입별 현재 진행도/목표치를 계산해 {current, target} 반환.
// count: 사용자가 직접 누적, habit: 기간 내 습관 완료일 수, event: 기간 내 완료한 일정 수.
const getGoalProgress = (goal, state) => {
  if (goal.type === 'count') return { current: goal.current || 0, target: goal.target };
  if (goal.type === 'habit') {
    const h = (state.habits||[]).find(h => h.id === goal.habitId);
    if (!h) return { current: 0, target: goal.target };
    const { start, end } = goal.customEnd ? { start: goal.startDate, end: goal.customEnd } : getGoalPeriodDates(goal.period);
    let cnt = 0;
    const today = todayStr();
    let d = new Date(start+'T00:00:00');
    const endD = new Date(end+'T00:00:00');
    // 기간 시작일부터 종료일까지 하루씩 순회하되 오늘 이후 미래는 세지 않는다
    while (d <= endD && fmtD(d) <= today) {
      if (state.habitLogs[fmtD(d)]?.[h.id]) cnt++;
      d.setDate(d.getDate()+1);
    }
    return { current: cnt, target: goal.target };
  }
  if (goal.type === 'event') {
    const { start, end } = goal.customEnd ? { start: goal.startDate, end: goal.customEnd } : getGoalPeriodDates(goal.period);
    const cat = goal.eventCategory;
    let cnt = 0;
    const today = todayStr();
    let d = new Date(start+'T00:00:00');
    const endD = new Date(end+'T00:00:00');
    while (d <= endD && fmtD(d) <= today) {
      const ds = fmtD(d);
      // 반복 일정까지 전개한 그날의 일정 중, 완료됐고 (지정 시) 카테고리가 맞는 것만 집계
      const evs = getEventsForDate(state, ds);
      cnt += evs.filter(ev => ev.done && (!cat || ev.category === cat)).length;
      d.setDate(d.getDate()+1);
    }
    return { current: cnt, target: goal.target };
  }
  return { current: goal.current || 0, target: goal.target };
};

// 일정 목록 정렬 옵션 (id가 sortEvs에 전달되는 값).
const SORT_OPTS = [
  { id: 'default',    label: '기본',     icon: '↕' },
  { id: 'time',       label: '시간순',   icon: '🕐' },
  { id: 'priority',   label: '우선순위', icon: '🔴' },
  { id: 'done_last',  label: '미완료 먼저', icon: '⬜' },
  { id: 'done_first', label: '완료 먼저',   icon: '✅' },
];

// sortEvs — 정렬 옵션에 따라 일정 배열을 정렬(원본 불변, 사본 반환).
const sortEvs = (evs, sortOrder) => {
  const arr = [...evs];
  const priOrder = { high: 0, normal: 1, low: 2 }; // 우선순위 → 정렬 가중치(낮을수록 위)
  switch (sortOrder) {
    case 'time':
      return arr.sort((a, b) => (a.startTime||'99:99').localeCompare(b.startTime||'99:99'));
    case 'priority':
      return arr.sort((a, b) => (priOrder[a.priority||'normal']??1) - (priOrder[b.priority||'normal']??1));
    case 'done_last':
      return arr.sort((a, b) => (a.done===b.done ? 0 : a.done ? 1 : -1));
    case 'done_first':
      return arr.sort((a, b) => (a.done===b.done ? 0 : a.done ? -1 : 1));
    default:
      // 기본 정렬: 고정(pinned) 우선 → 우선순위 → 시작시간 순
      return arr.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (priOrder[a.priority||'normal']??1) - (priOrder[b.priority||'normal']??1)
          || (a.startTime||'').localeCompare(b.startTime||'');
      });
  }
};

export { drawGoalShareCard, GOAL_CATEGORIES, GOAL_PERIODS, getGoalPeriodDates, getGoalProgress, SORT_OPTS, sortEvs };
