/**
 * components/stats/index.jsx — 통계 탭.
 *
 * TrendChart: 최근 8주 일정/습관 완료율 추세를 SVG 라인 차트로.
 * WeeklyReport: 이번 주 요약과 격려 메시지.
 * StatsTab: 월간 달성률·카테고리 분포·목표 현황 등 각종 지표를 모아 보여주는 컨테이너.
 * 모든 집계는 getEventsForDate(반복 전개 포함)와 habitLogs를 기반으로 한다.
 */
import React, { useState } from 'react';
import { CATEGORIES } from '../../constants.js';
import { useT, useDateI18n } from '../../i18n.jsx';
import { todayStr, fmtD, firstDayOfMonth, daysInMonth } from '../../utils.js';
import { getEventsForDate, useApp } from '../../store.js';
import { EmptyState, CollapsibleSection } from '../common/index.jsx';
import { getGoalProgress, getGoalCat } from '../../helpers.js';

// TrendChart — 최근 8주(이번 주 포함)의 일정/습관 완료율을 직접 그린 SVG 라인 차트.
const TrendChart = ({ state }) => {
  const t = useT();
  const todayDs = todayStr();
  const base = new Date();
  const baseDay = base.getDay();
  const baseMonOff = baseDay === 0 ? -6 : 1 - baseDay; // 이번 주 월요일까지의 오프셋(월요일 시작)

  // w=7(8주 전)부터 0(이번 주)까지 주별 완료율 집계. 아직 안 온 미래 날짜는 분모에서 제외.
  const weekData = [];
  for (let w = 7; w >= 0; w--) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + baseMonOff - w * 7 + i);
      days.push(fmtD(d));
    }
    const pastDays = days.filter(ds => ds <= todayDs);
    if (pastDays.length === 0) continue;

    let evT = 0, evD = 0;
    days.forEach(ds => {
      const evs = getEventsForDate(state, ds);
      evT += evs.length; evD += evs.filter(e => e.done).length;
    });

    let hT = 0, hD = 0;
    pastDays.forEach(ds => {
      state.habits.forEach(h => { hT++; if (state.habitLogs[ds]?.[h.id]) hD++; });
    });

    const label = w === 0 ? t('stats.trend.now') : '-' + w + t('stats.trend.week');
    weekData.push({
      label,
      evPct: evT > 0 ? Math.round(evD / evT * 100) : null,
      habPct: hT > 0 ? Math.round(hD / hT * 100) : null,
    });
  }

  const hasEv = weekData.some(w => w.evPct !== null);
  const hasHab = weekData.some(w => w.habPct !== null);
  if (!hasEv && !hasHab) return null;

  // SVG 차트 치수/패딩(L/R/T/B)과 데이터→좌표 변환 함수. CW/CH는 패딩 제외 실제 그리기 영역.
  const n = weekData.length;
  const SW = 280, SH = 100, PL = 26, PR = 8, PT = 8, PB = 22;
  const CW = SW - PL - PR, CH = SH - PT - PB;
  const xOf = i => PL + (n <= 1 ? CW / 2 : (i / (n - 1)) * CW);
  const yOf = pct => PT + (1 - pct / 100) * CH; // 0%가 아래, 100%가 위가 되도록 뒤집음

  // buildSegs — 데이터가 없는 주(null)에서 선을 끊어 여러 선분(segment)으로 나눈다.
  const buildSegs = key => {
    const segs = []; let seg = [];
    weekData.forEach((d, i) => {
      if (d[key] !== null) { seg.push([xOf(i), yOf(d[key])]); }
      else { if (seg.length) { segs.push(seg); seg = []; } }
    });
    if (seg.length) segs.push(seg);
    return segs;
  };
  const pts = seg => seg.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' ');

  return React.createElement('div', { style: { padding: '4px 14px 12px' } },
    React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--mut)', marginBottom: 6 } }, t('stats.trend.title')),
    React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 6 } },
      hasEv && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
        React.createElement('div', { style: { width: 14, height: 2, background: 'var(--pri)', borderRadius: 1 } }),
        React.createElement('span', { style: { fontSize: 10, color: 'var(--mut)' } }, t('stats.trend.event')),
      ),
      hasHab && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
        React.createElement('div', { style: { width: 14, height: 2, background: '#3DBFA0', borderRadius: 1 } }),
        React.createElement('span', { style: { fontSize: 10, color: 'var(--mut)' } }, t('stats.trend.habit')),
      ),
    ),
    React.createElement('svg', { viewBox: `0 0 ${SW} ${SH}`, style: { width: '100%', height: 'auto', overflow: 'visible' } },
      [100, 50, 0].map(y =>
        React.createElement(React.Fragment, { key: y },
          React.createElement('line', { x1: PL, y1: yOf(y), x2: SW - PR, y2: yOf(y), stroke: 'var(--bor)', strokeWidth: 0.5, strokeDasharray: y === 0 ? '0' : '2,2' }),
          React.createElement('text', { x: PL - 3, y: yOf(y), textAnchor: 'end', dominantBaseline: 'middle', fontSize: 7, fill: 'var(--mut)' }, y + '%'),
        )
      ),
      buildSegs('evPct').map((seg, si) =>
        React.createElement('polyline', { key: 'ev' + si, points: pts(seg), fill: 'none', stroke: 'var(--pri)', strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' })
      ),
      buildSegs('habPct').map((seg, si) =>
        React.createElement('polyline', { key: 'h' + si, points: pts(seg), fill: 'none', stroke: '#3DBFA0', strokeWidth: 1.8, strokeLinejoin: 'round', strokeLinecap: 'round' })
      ),
      hasEv && weekData.map((d, i) => d.evPct !== null &&
        React.createElement('circle', { key: 'ed' + i, cx: xOf(i), cy: yOf(d.evPct), r: 2.5, fill: '#fff', stroke: 'var(--pri)', strokeWidth: 1.5 })
      ),
      hasHab && weekData.map((d, i) => d.habPct !== null &&
        React.createElement('circle', { key: 'hd' + i, cx: xOf(i), cy: yOf(d.habPct), r: 2.5, fill: '#fff', stroke: '#3DBFA0', strokeWidth: 1.5 })
      ),
      weekData.map((d, i) =>
        React.createElement('text', { key: 'xl' + i, x: xOf(i), y: SH - 4, textAnchor: 'middle', fontSize: 7, fill: 'var(--mut)' }, d.label)
      ),
    ),
  );
};

// WeeklyReport — 이번 주 일정/습관 달성 요약과 지난 주 대비 격려 메시지를 보여주는 카드.
const WeeklyReport = ({ state }) => {
  const t = useT();
  const { fmtDate } = useDateI18n();
  const today = new Date();
  const todayDs = todayStr();

  // 이번 주 월~일 날짜 배열(월요일 시작)
  const weekDays = [];
  const dow = today.getDay(); // 0=일요일
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    weekDays.push(fmtD(d));
  }
  const weekStart = weekDays[0];
  const weekEnd   = weekDays[6];

  // 지난 주 날짜 (비교용)
  const lastWeekDays = weekDays.map(ds => {
    const d = new Date(ds + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    return fmtD(d);
  });

  // ── 일정 통계 ──
  let evTotal = 0, evDone = 0;
  const dayEvCount = {}; // 요일별 완료 수
  weekDays.forEach(ds => {
    const evs = getEventsForDate(state, ds);
    const dayDone = evs.filter(e => e.done).length;
    evTotal += evs.length;
    evDone  += dayDone;
    dayEvCount[ds] = { total: evs.length, done: dayDone };
  });
  const evPct = evTotal ? Math.round(evDone / evTotal * 100) : 0;

  // 지난주 완료율
  let lwTotal = 0, lwDone = 0;
  lastWeekDays.forEach(ds => {
    const evs = getEventsForDate(state, ds);
    lwTotal += evs.length;
    lwDone  += evs.filter(e => e.done).length;
  });
  const lwPct = lwTotal ? Math.round(lwDone / lwTotal * 100) : 0;
  const evDiff = evPct - lwPct;

  // ── 습관 통계 ──
  let habChecked = 0, habTotal = 0;
  const passedDays = weekDays.filter(ds => ds <= todayDs);
  state.habits.forEach(h => {
    passedDays.forEach(ds => {
      habTotal++;
      if (state.habitLogs[ds]?.[h.id]) habChecked++;
    });
  });
  const habPct = habTotal ? Math.round(habChecked / habTotal * 100) : 0;

  // 습관 연속 달성 챔피언 찾기
  let bestHabit = null, bestStreak = 0;
  state.habits.forEach(h => {
    let streak = 0;
    const d = new Date(todayDs + 'T00:00:00');
    while (true) {
      const ds = fmtD(d);
      if (state.habitLogs[ds]?.[h.id]) { streak++; d.setDate(d.getDate()-1); }
      else break;
    }
    if (streak > bestStreak) { bestStreak = streak; bestHabit = h; }
  });

  // ── 기분 통계 ──
  const weekMoods = weekDays.map(ds => state.moods[ds]).filter(Boolean);
  const moodMap = {};
  weekMoods.forEach(m => { if (m?.emoji) moodMap[m.emoji] = (moodMap[m.emoji]||0)+1; });
  const topMood = Object.entries(moodMap).sort((a,b)=>b[1]-a[1])[0];

  // ── 목표 통계 ──
  const goals = state.goals || [];
  const activeGoals = goals.filter(g => {
    const { current, target } = getGoalProgress(g, state);
    return target > 0;
  });
  const goalStats = activeGoals.map(g => {
    const { current, target } = getGoalProgress(g, state);
    const pct = target ? Math.min(Math.round(current / target * 100), 100) : 0;
    const isDone = current >= target;
    const cat = getGoalCat(g.category);
    return { g, current, target, pct, isDone, cat };
  });
  const goalDone = goalStats.filter(gs => gs.isDone).length;
  const goalTotal = activeGoals.length;
  const goalAvgPct = goalTotal
    ? Math.round(goalStats.reduce((s, gs) => s + gs.pct, 0) / goalTotal)
    : 0;

  // ── 가장 바쁜 날 ──
  const busiest = weekDays.reduce((best, ds) => {
    const cnt = (dayEvCount[ds]?.total||0);
    return cnt > (dayEvCount[best]?.total||0) ? ds : best;
  }, weekDays[0]);
  const busiestName = t('wd.full.' + new Date(busiest+'T00:00:00').getDay());

  // getMessage — 이번 주 달성률 구간에 따라 응원 문구/이모지를 골라준다(위쪽이 높은 성취).
  const getMessage = () => {
    if (evPct === 100 && habPct >= 80 && goalAvgPct >= 80)
      return { emoji:'🏆', msg: t('weekly.msg.perfect') };
    if (evPct >= 80 && goalAvgPct >= 60)
      return { emoji:'🔥', msg: t('weekly.msg.great') };
    if (evPct >= 80) return { emoji:'🔥', msg: t('weekly.msg.good_ev') };
    if (goalDone > 0) return { emoji:'🎯', msg: goalDone + t('weekly.msg.goal_suffix') };
    if (evPct >= 60) return { emoji:'💪', msg: t('weekly.msg.ok') };
    if (evTotal === 0) return { emoji:'🌱', msg: t('weekly.msg.start') };
    return { emoji:'🌟', msg: t('weekly.msg.default') };
  };
  const { emoji: msgEmoji, msg } = getMessage();

  // ── 요일 라벨 (월~일 순서, weekDays 배열 순서와 일치) ──
  const WD_SHORT = weekDays.map(ds => t('wd.' + new Date(ds + 'T00:00:00').getDay()));

  return React.createElement('div', {
    style: { background: 'var(--sur)', borderRadius: 20, overflow: 'hidden', marginBottom: 14, boxShadow: 'var(--sh-card)' }
  },
    // 헤더
    React.createElement('div', {
      style: { background: 'linear-gradient(135deg, var(--pri), var(--sec))', padding: '16px 16px 20px' }
    },
      React.createElement('div', { style: { fontSize: 11, color: 'rgba(255,255,255,.8)', fontWeight: 600, marginBottom: 4 } },
        fmtDate(weekStart) + ' ~ ' + fmtDate(weekEnd)
      ),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 2 } }, t('stats.weekly')),
          React.createElement('div', { style: { fontSize: 12, color: 'rgba(255,255,255,.85)' } }, msgEmoji + ' ' + msg),
        ),
        React.createElement('div', { style: { textAlign: 'right' } },
          React.createElement('div', { style: { fontSize: 36, fontWeight: 900, color: '#fff', lineHeight: 1 } }, evPct + '%'),
          React.createElement('div', { style: { fontSize: 10, color: 'rgba(255,255,255,.75)', marginTop: 2 } }, t('weekly.completion_rate')),
          evDiff !== 0 && React.createElement('div', { style: { fontSize: 10, color: evDiff > 0 ? '#A8FFD8' : '#FFB3B3', fontWeight: 700, marginTop: 1 } },
            (evDiff > 0 ? '▲' : '▼') + Math.abs(evDiff) + '% ' + t('weekly.vs_last')
          ),
        ),
      ),
      // 진행바
      React.createElement('div', { style: { marginTop: 12, height: 5, background: 'rgba(255,255,255,.25)', borderRadius: 3, overflow: 'hidden' } },
        React.createElement('div', { style: { height: '100%', background: '#fff', borderRadius: 3, width: evPct + '%', transition: 'width .6s ease' } })
      ),
    ),

    // 요일별 달성 현황
    React.createElement('div', { style: { padding: '14px 14px 6px' } },
      React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--mut)', marginBottom: 10 } }, t('stats.events_by_day')),
      React.createElement('div', { style: { display: 'flex', gap: 4, justifyContent: 'space-between' } },
        weekDays.map((ds, i) => {
          const { total, done } = dayEvCount[ds] || { total: 0, done: 0 };
          const isFuture = ds > todayDs;
          const isToday  = ds === todayDs;
          const allDone  = total > 0 && done === total;
          const pct      = total ? done / total : 0;
          return React.createElement('div', { key: ds, style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 } },
            React.createElement('div', { style: { fontSize: 9, fontWeight: 700, color: isToday ? 'var(--pri)' : 'var(--mut)' } }, WD_SHORT[i]),
            React.createElement('div', { style: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: isFuture ? 'var(--sur2)' : allDone ? 'var(--pri)' : total > 0 ? 'var(--pri-light)' : 'var(--sur2)', color: allDone ? '#fff' : 'var(--pri)', border: isToday ? '2px solid var(--pri)' : 'none' } },
              isFuture ? '' : total === 0 ? '·' : allDone ? '✓' : done + '/' + total
            ),
          );
        })
      ),
    ),

    // 핵심 지표 4개 (목표 추가)
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '10px 14px' } },
      // 일정 완료
      React.createElement('div', { style: { background: 'var(--sur2)', borderRadius: 12, padding: '10px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 22, fontWeight: 900, color: 'var(--pri)' } }, evDone),
        React.createElement('div', { style: { fontSize: 10, color: 'var(--mut)', marginTop: 2, fontWeight: 600 } }, t('stats.events_done')),
        React.createElement('div', { style: { fontSize: 9, color: 'var(--mut)', marginTop: 1 } }, '/' + evTotal + t('weekly.ev_cnt')),
      ),
      // 습관 달성
      React.createElement('div', { style: { background: 'var(--sur2)', borderRadius: 12, padding: '10px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 22, fontWeight: 900, color: '#3DBFA0' } }, habPct + '%'),
        React.createElement('div', { style: { fontSize: 10, color: 'var(--mut)', marginTop: 2, fontWeight: 600 } }, t('stats.habit_rate')),
        React.createElement('div', { style: { fontSize: 9, color: 'var(--mut)', marginTop: 1 } }, habChecked + '/' + habTotal + t('weekly.hab_cnt')),
      ),
      // 기분
      React.createElement('div', { style: { background: 'var(--sur2)', borderRadius: 12, padding: '10px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 22 } }, topMood ? topMood[0] : '—'),
        React.createElement('div', { style: { fontSize: 10, color: 'var(--mut)', marginTop: 2, fontWeight: 600 } }, t('stats.mood')),
        React.createElement('div', { style: { fontSize: 9, color: 'var(--mut)', marginTop: 1 } }, weekMoods.length + t('weekly.mood_rec')),
      ),
      // 목표
      React.createElement('div', { style: { background: 'var(--sur2)', borderRadius: 12, padding: '10px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 22, fontWeight: 900, color: '#9B7FD4' } },
          goalTotal === 0 ? '—' : goalAvgPct + '%'
        ),
        React.createElement('div', { style: { fontSize: 10, color: 'var(--mut)', marginTop: 2, fontWeight: 600 } }, t('stats.goal_rate')),
        React.createElement('div', { style: { fontSize: 9, color: 'var(--mut)', marginTop: 1 } },
          goalTotal === 0 ? t('weekly.no_goal') : goalDone + '/' + goalTotal + t('weekly.goal_stat')
        ),
      ),
    ),

    // 스트릭 챔피언 & 가장 바쁜 날
    // 목표 진행 현황
    goalTotal > 0 && React.createElement('div', { style: { padding: '0 14px 10px' } },
      React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--mut)', marginBottom: 8 } }, t('stats.goal_progress')),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        goalStats.slice(0, 3).map(({ g, current, target, pct, isDone, cat }) =>
          React.createElement('div', { key: g.id,
            style: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--sur2)', borderRadius: 10, padding: '8px 10px' }
          },
            React.createElement('div', {
              style: { width: 30, height: 30, borderRadius: 8, background: cat.color+'22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }
            }, g.emoji || cat.emoji),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--txt)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, g.title),
              React.createElement('div', { style: { height: 5, background: 'var(--bor)', borderRadius: 3, overflow: 'hidden' } },
                React.createElement('div', { style: { height: '100%', background: isDone ? cat.color : 'var(--pri)', width: pct+'%', borderRadius: 3, transition: 'width .5s' } })
              ),
            ),
            React.createElement('div', { style: { fontSize: 12, fontWeight: 900, color: isDone ? cat.color : 'var(--pri)', flexShrink: 0, minWidth: 36, textAlign: 'right' } },
              isDone ? '🏆' : pct+'%'
            ),
          )
        ),
        goalTotal > 3 && React.createElement('div', {
          style: { fontSize: 11, color: 'var(--mut)', textAlign: 'center', paddingTop: 2 }
        }, '+ ' + (goalTotal - 3) + t('weekly.more')),
      ),
    ),

    (bestHabit || evTotal > 0) && React.createElement('div', { style: { padding: '0 14px 14px', display: 'flex', gap: 8 } },
      bestHabit && bestStreak > 0 && React.createElement('div', {
        style: { flex: 1, background: '#FFF8E6', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }
      },
        React.createElement('span', { style: { fontSize: 20 } }, '🔥'),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 11, fontWeight: 800, color: '#633806' } }, bestStreak + t('weekly.streak_days')),
          React.createElement('div', { style: { fontSize: 10, color: '#854F0B' } }, bestHabit.emoji + ' ' + bestHabit.name),
        ),
      ),
      evTotal > 0 && React.createElement('div', {
        style: { flex: 1, background: 'var(--pri-light)', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }
      },
        React.createElement('span', { style: { fontSize: 20 } }, '📅'),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 11, fontWeight: 800, color: '#712B13' } }, t('weekly.busiest')),
          React.createElement('div', { style: { fontSize: 10, color: 'var(--pri)' } }, busiestName + ' · ' + (dayEvCount[busiest]?.total || 0) + t('weekly.ev_cnt')),
        ),
      ),
    ),
    React.createElement(TrendChart, { state }),
  );
};

// StatsTab — 통계 탭 컨테이너. 선택한 월의 달성률·카테고리 분포·기분 통계와 주간 리포트를 보여준다.
const StatsTab = () => {
  const { state, dispatch } = useApp();
  const t = useT();
  const { fmtYrMo, getWd, fmtDate } = useDateI18n();
  const [statsYr, setStatsYr] = useState(new Date().getFullYear());
  const [statsMo, setStatsMo] = useState(new Date().getMonth());
  const today = todayStr();

  // 월 이동. 단 미래 달로는 넘어가지 못하게 막는다(아직 데이터가 없으므로).
  const moveStats = (dir) => {
    const now = new Date();
    let nm = statsMo + dir, ny = statsYr;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    if (ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth())) return;
    setStatsMo(nm); setStatsYr(ny);
  };

  const y = statsYr, m = statsMo;
  const nd = daysInMonth(y, m);
  const fd = firstDayOfMonth(y, m);
  const days = [];
  for (let d = 1; d <= nd; d++) {
    days.push(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  }
  const passed = days.filter(ds => ds <= today);

  // 이번 달 일정 집계: 총/완료 수, 카테고리별·날짜별 개수.
  let total = 0, done = 0;
  const catCount = {}, dayCount = {};
  days.forEach(ds => {
    const evs = getEventsForDate(state, ds);
    evs.forEach(ev => {
      // 멀티데이/반복 연속분 중복 집계를 피하려고 '시작일이 그날인' 것만 총계에 넣는다
      if ((ev.startDate||ds) === ds) {
        total++; if (ev.done) done++;
        catCount[ev.category||'personal'] = (catCount[ev.category||'personal']||0)+1;
      }
      dayCount[ds] = (dayCount[ds]||0)+1;
    });
  });
  const maxDay = Math.max(...Object.values(dayCount), 1);
  const moods = days.map(ds => state.moods[ds]).filter(Boolean);
  const moodCount = {};
  moods.forEach(v => { if (v?.emoji) moodCount[v.emoji] = (moodCount[v.emoji]||0)+1; });

  // 이번 달 데이터가 전혀 없으면 빈 상태
  if (total === 0 && state.habits.length === 0 && moods.length === 0 && (state.goals||[]).length === 0) {
    return React.createElement('div', {className:'pane active', id:'pane-stats'},
      React.createElement(EmptyState, {
        type: 'stats',
        title: t('stats.empty.title'),
        desc: t('stats.empty.desc'),
        cta: t('stats.empty.cta'),
        onCta: () => dispatch({ type: 'SET_TAB', tab: 'calendar' }),
      })
    );
  }

  return React.createElement('div', {className:'pane active', id:'pane-stats'},
    React.createElement(WeeklyReport, { state }),
    React.createElement('div', {className:'stats-card'},
      React.createElement('div', {className:'stats-nav'},
        React.createElement('button', {className:'stats-nav-btn', onClick:()=>moveStats(-1)}, '‹'),
        React.createElement('div', {className:'stats-mo'}, fmtYrMo(y, m)),
        React.createElement('button', {
          className:'stats-nav-btn',
          onClick:()=>moveStats(1),
          disabled: y > new Date().getFullYear() || (y === new Date().getFullYear() && m >= new Date().getMonth()),
        }, '›'),
      ),
      React.createElement('div', {className:'stats-nums'},
        React.createElement('div', {className:'stats-num-box'},
          React.createElement('div', {className:'stats-big-num'}, total),
          React.createElement('div', {className:'stats-num-lbl'}, t('stats.total')),
        ),
        React.createElement('div', {className:'stats-num-box'},
          React.createElement('div', {className:'stats-big-num', style:{color:'#3DBFA0'}}, done),
          React.createElement('div', {className:'stats-num-lbl'}, t('stats.done_label')),
        ),
        React.createElement('div', {className:'stats-num-box'},
          React.createElement('div', {className:'stats-big-num', style:{color:'#FFB347'}}, total-done),
          React.createElement('div', {className:'stats-num-lbl'}, t('stats.undone')),
        ),
      ),
      // 히트맵
      React.createElement(CollapsibleSection, { title: t('stats.heatmap') },
        React.createElement(React.Fragment, null,
          React.createElement('div', {style:{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:8}},
            getWd().map((w,i) => React.createElement('div', {key:i, style:{textAlign:'center',fontSize:9,fontWeight:700,color:i===0?'var(--pri)':'var(--mut)',padding:'2px 0'}}, w))
          ),
          React.createElement('div', {className:'stats-heatmap'},
            Array(fd).fill(null).map((_,i) => React.createElement('div', {key:'e'+i, className:'shm-cell', style:{background:'var(--sur2)'}})),
            days.map(ds => {
              const cnt = dayCount[ds]||0;
              const alpha = cnt ? 0.2+0.8*(cnt/maxDay) : 0;
              return React.createElement('div', {key:ds, className:'shm-cell',
                style:{background:cnt?`rgba(245,96,74,${alpha.toFixed(2)})`:'var(--sur2)',borderRadius:4,aspectRatio:1}});
            })
          ),
        ),
      ),

      // 카테고리 바
      CATEGORIES.filter(cat => catCount[cat.id]).length > 0 &&
      React.createElement(CollapsibleSection, { title: t('stats.categories') },
        React.createElement(React.Fragment, null,
          CATEGORIES.filter(cat => catCount[cat.id]).sort((a,b) => (catCount[b.id]||0)-(catCount[a.id]||0)).map(cat =>
            React.createElement('div', {key:cat.id, className:'stats-bar-row'},
              React.createElement('div', {style:{width:22,textAlign:'center'}}, cat.emoji),
              React.createElement('div', {style:{flex:1}},
                React.createElement('div', {style:{fontSize:11,fontWeight:600,color:'var(--txt)',marginBottom:3}}, t('cat.' + cat.id) + ' ' + (catCount[cat.id]||0) + t('weekly.ev_cnt')),
                React.createElement('div', {className:'stats-bar-bg'},
                  React.createElement('div', {className:'stats-bar-fill', style:{width:((catCount[cat.id]||0)/total*100).toFixed(1)+'%',background:cat.color}}),
                ),
              ),
            )
          ),
        ),
      ),

      // 태그 통계
      (() => {
        const tagCount = {};
        days.forEach(ds => {
          (state.events[ds]||[]).forEach(ev => {
            (ev.tags||[]).forEach(t => { tagCount[t] = (tagCount[t]||0) + 1; });
          });
        });
        const topTags = Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
        if (!topTags.length) return null;
        return React.createElement(CollapsibleSection, { title: t('stats.by_tag') },
          React.createElement('div', {style:{display:'flex',gap:6,flexWrap:'wrap'}},
            topTags.map(([t, n]) => React.createElement('div', {
              key: t,
              style:{background:'var(--pri-light)',color:'var(--pri)',borderRadius:99,padding:'5px 12px',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:5}
            },
              '#'+t,
              React.createElement('span', {style:{background:'var(--pri)',color:'#fff',borderRadius:99,padding:'1px 6px',fontSize:10,fontWeight:800}}, n)
            ))
          ),
        );
      })(),

      // 습관 달성률
      state.habits.length > 0 &&
      React.createElement(CollapsibleSection, { title: t('stats.habit_achievement') },
        React.createElement(React.Fragment, null,
          state.habits.map(h => {
            const dc = passed.filter(ds => state.habitLogs[ds]?.[h.id]).length;
            const pct = passed.length ? Math.round(dc/passed.length*100) : 0;
            return React.createElement('div', {key:h.id, className:'stats-bar-row'},
              React.createElement('div', {style:{width:22,textAlign:'center'}}, h.emoji||'💪'),
              React.createElement('div', {style:{flex:1}},
                React.createElement('div', {style:{fontSize:11,fontWeight:600,color:'var(--txt)',marginBottom:3}}, `${h.name} ${pct}%`),
                React.createElement('div', {className:'stats-bar-bg'},
                  React.createElement('div', {className:'stats-bar-fill', style:{width:pct+'%',background:h.color||'var(--pri)'}}),
                ),
              ),
            );
          }),
        ),
      ),

      // 기분 기록
      moods.length > 0 &&
      React.createElement(CollapsibleSection, { title: t('stats.mood_log') },
        React.createElement('div', {style:{display:'flex',gap:6,flexWrap:'wrap'}},
          Object.entries(moodCount).sort((a,b)=>b[1]-a[1]).map(([e,n]) =>
            React.createElement('div', {key:e, style:{background:'var(--sur2)',borderRadius:20,padding:'4px 10px',fontSize:13,display:'flex',alignItems:'center',gap:4}},
              e, React.createElement('span', {style:{fontSize:11,color:'var(--mut)'}}, n+t('weekly.hab_cnt')),
            )
          ),
        ),
      ),

      // 🔗 연결 인사이트
      (() => {
        const linked = (state.goals||[]).map(g => {
          if (g.type === 'habit' && g.habitId) {
            const h = state.habits.find(h => h.id === g.habitId);
            if (!h) return null;
            const { current, target } = getGoalProgress(g, state);
            const pct = target ? Math.min(100, Math.round(current/target*100)) : 0;
            const cat = getGoalCat(g.category);
            return { g, label: h.emoji+' '+h.name, pct, catColor: cat.color, type: 'habit' };
          }
          if (g.type === 'event' && g.eventCategory) {
            const evCat = CATEGORIES.find(c => c.id === g.eventCategory);
            const label = evCat ? evCat.emoji+' '+t('cat.'+evCat.id) : g.eventCategory;
            const { current, target } = getGoalProgress(g, state);
            const pct = target ? Math.min(100, Math.round(current/target*100)) : 0;
            const cat = getGoalCat(g.category);
            return { g, label, pct, catColor: cat.color, type: 'event' };
          }
          return null;
        }).filter(Boolean);
        if (!linked.length) return null;
        return React.createElement(CollapsibleSection, { title: t('stats.connections') },
          React.createElement('div', {style:{display:'flex',flexDirection:'column',gap:8}},
            linked.map(({g, label, pct, catColor, type}) =>
              React.createElement('div', {key:g.id, style:{background:'var(--sur2)',borderRadius:12,padding:'10px 12px'}},
                React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}},
                  React.createElement('div', {style:{display:'flex',alignItems:'center',gap:8}},
                    React.createElement('span', {style:{fontSize:18}}, g.emoji||'🎯'),
                    React.createElement('div', null,
                      React.createElement('div', {style:{fontSize:12,fontWeight:700,color:'var(--txt)'}}, g.title),
                      React.createElement('span', {style:{fontSize:11,background:type==='habit'?'#3DBFA022':'var(--pri-light)',color:type==='habit'?'#3DBFA0':'var(--pri)',borderRadius:99,padding:'1px 8px',fontWeight:700}}, label),
                    ),
                  ),
                  React.createElement('span', {style:{fontSize:14,fontWeight:900,color:catColor}}, pct+'%'),
                ),
                React.createElement('div', {style:{height:4,background:'var(--bor)',borderRadius:2,overflow:'hidden'}},
                  React.createElement('div', {style:{height:'100%',background:catColor,width:pct+'%',borderRadius:2,transition:'width .5s'}}),
                ),
              )
            ),
          ),
        );
      })(),

      // 📖 되돌아보기 기록
      (() => {
        const reviewList = days.map(ds => ({ ds, r: (state.reviews||{})[ds] })).filter(d => d.r).reverse();
        if (!reviewList.length) return null;
        return React.createElement(CollapsibleSection, { title: t('stats.reviews') },
          React.createElement('div', {style:{display:'flex',flexDirection:'column',gap:8}},
            reviewList.slice(0,5).map(({ds, r}) =>
              React.createElement('div', {key:ds, style:{background:'var(--sur2)',borderRadius:12,padding:'10px 14px'}},
                React.createElement('div', {style:{fontSize:11,color:'var(--mut)',fontWeight:700,marginBottom:4}}, fmtDate(ds)),
                React.createElement('div', {style:{fontSize:13,color:'var(--txt)',lineHeight:1.6}}, '✍️ '+r.text),
              )
            ),
          ),
        );
      })(),
    ),
  );
};

// ══════════════════════════════════════
// 모달: 일정 추가/수정
// ══════════════════════════════════════

export { TrendChart, WeeklyReport, StatsTab };
