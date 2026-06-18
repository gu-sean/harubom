/**
 * components/habits/index.jsx — 습관 추적 탭과 편집 모달.
 *
 * HabitTab: 주간/월간 격자로 습관 체크 상태를 보여주고 연속 달성(streak)을 계산.
 * HabitModal: 습관 생성/수정 폼. 체크 기록은 habitLogs[날짜][습관id]에 저장된다.
 */
import React, { useState } from 'react';
import { MS_PER_DAY, COLORS } from '../../constants.js';
import { useT } from '../../i18n.jsx';
import { todayStr, fmtD, uid, firstDayOfMonth, daysInMonth, toast, vib } from '../../utils.js';
import { useApp } from '../../store.js';
import { EmptyState } from '../common/index.jsx';

// HabitTab — 습관 목록 + 주/월 체크 격자. 추가/수정은 onOpen으로 모달을 띄운다.
const HabitTab = ({ onOpen }) => {
  const { state, dispatch } = useApp();
  const t = useT();
  const twd = (d) => t('wd.' + d.getDay());
  const { habits, habitLogs } = state;
  const today = todayStr();
  const [viewMode, setViewMode] = useState('week');

  // getStreak — 오늘(또는 오늘 미체크면 어제)부터 거꾸로 연속 달성한 일수를 센다.
  const getStreak = (habId) => {
    let streak = 0;
    const d = new Date();
    if (!habitLogs[fmtD(d)]?.[habId]) d.setDate(d.getDate() - 1); // 오늘 아직 안 했으면 어제 기준으로 시작
    while (true) {
      const ds = fmtD(d);
      if (habitLogs[ds]?.[habId]) { streak++; d.setDate(d.getDate()-1); }
      else break;
    }
    return streak;
  };

  // getBestStreak — 전체 기록 중 가장 길었던 연속 달성 구간을 찾는다.
  const getBestStreak = (habId) => {
    const allDates = Object.keys(habitLogs).filter(ds => habitLogs[ds]?.[habId]).sort();
    if (allDates.length === 0) return 0;
    let best = 1, cur = 1;
    for (let i = 1; i < allDates.length; i++) {
      const prev = new Date(allDates[i-1] + 'T00:00:00');
      const curr = new Date(allDates[i] + 'T00:00:00');
      // 정확히 하루 차이면 연속, 아니면 끊긴 것으로 보고 카운터 리셋
      if ((curr - prev) / MS_PER_DAY === 1) { cur++; if (cur > best) best = cur; }
      else cur = 1;
    }
    return best;
  };

  // getWeekDays — 이번 주 월~일 7일을 {날짜, 요일, 오늘여부}로 반환(월요일 시작).
  const getWeekDays = () => {
    const days = [];
    const base = new Date();
    const dow = base.getDay(); // 0=일요일
    const mondayOffset = dow === 0 ? -6 : 1 - dow; // 일요일이면 6일 전으로 당겨 같은 주 월요일을 잡음
    for (let i = 0; i < 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + mondayOffset + i);
      days.push({ ds: fmtD(d), wd: twd(d), isToday: fmtD(d) === today });
    }
    return days;
  };

  // getMonthDays — 이번 달 격자용 배열. 1일 앞 빈칸(null)으로 요일을 맞춘 뒤 날짜 문자열을 채운다.
  const getMonthDays = () => {
    const n = new Date(), y = n.getFullYear(), m = n.getMonth();
    const nd = daysInMonth(y,m), fd = firstDayOfMonth(y,m);
    const days = [];
    for (let i = 0; i < fd; i++) days.push(null); // 1일이 시작되는 요일까지 빈칸 채우기
    for (let d = 1; d <= nd; d++) {
      const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      days.push(ds);
    }
    return days;
  };

  const weekDays = getWeekDays();
  const monthDays = getMonthDays();

  // thisMonthDone — 이번 달 해당 습관 달성 횟수
  const thisMonthDone = (habId) => {
    const n = new Date(); const y=n.getFullYear(), m=n.getMonth();
    const nd = daysInMonth(y,m);
    let cnt=0;
    for (let d=1;d<=nd;d++){
      const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if(habitLogs[ds]?.[habId]) cnt++;
    }
    return cnt;
  };

  const handleDelete = (id) => {
    if (confirm(t('habit.delete.confirm'))) {
      dispatch({ type: 'DELETE_HABIT', id });
      toast(t('toast.deleted'),'🗑️');
    }
  };

  return React.createElement('div', {className:'pane active', id:'pane-habit'},
    React.createElement('div', {className:'row'},
      React.createElement('h2', {style:{fontSize:17,fontWeight:700,color:'var(--txt)'}}, t('habit.title')),
      React.createElement('button', {className:'pill pill-pri', onClick:()=>onOpen(null)}, t('btn.add')),
    ),
    React.createElement('div', {style:{display:'flex',gap:6,marginBottom:14}},
      React.createElement('button', {
        className:`pill${viewMode==='week'?' pill-pri':' pill-sec'}`,
        onClick:()=>setViewMode('week')
      }, t('habit.weekly')),
      React.createElement('button', {
        className:`pill${viewMode==='month'?' pill-pri':' pill-sec'}`,
        onClick:()=>setViewMode('month')
      }, t('habit.monthly')),
    ),
    habits.length === 0
      ? React.createElement(EmptyState, {
          type: 'habit',
          title: t('habit.empty.title'),
          desc: t('habit.empty.desc'),
          cta: '💪 첫 습관 만들기',
          onCta: () => onOpen(null),
          cta2: '📚 추천 습관 둘러보기',
          onCta2: () => {
            const presets = ['📚 독서 30분', '🏃 운동하기', '💧 물 8잔', '🧘 명상 10분', '✍️ 일기 쓰기'];
            const picked = presets[Math.floor(Math.random()*presets.length)];
            const parts = picked.match(/^(\S+)\s+(.+)$/);
            if (parts) onOpen({ emoji: parts[1], name: parts[2] });
          },
        })
      : habits.map(h => {
          const streak = getStreak(h.id);
          const bestStreak = getBestStreak(h.id);
          const done = thisMonthDone(h.id);
          const nd = new Date().getDate();
          const pct = Math.round(done/nd*100);
          return React.createElement('div', {key:h.id, className:'hab-card fade-up'},
            React.createElement('div', {style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}},
              React.createElement('div', {className:'hab-header'},
                React.createElement('span', {className:'hab-emoji'}, h.emoji||'💪'),
                React.createElement('div', {},
                  React.createElement('div', {className:'hab-name'}, h.name),
                  React.createElement('div', {className:'hab-streak'},
                    React.createElement('span', null, streak > 0 ? '🔥 ' + streak + t('habit.streak_days') : t('habit.streak_start')),
                    bestStreak > 0 && React.createElement('span', {style:{marginLeft:8,opacity:.6}}, '🏆 ' + t('habit.best') + ' ' + bestStreak + t('habit.days')),
                  ),
                ),
              ),
              React.createElement('div', {style:{display:'flex',gap:4}},
                React.createElement('button', {className:'ev-act-btn', onClick:()=>onOpen(h)}, '✏️'),
                React.createElement('button', {className:'ev-act-btn', onClick:()=>handleDelete(h.id)}, '🗑️'),
              ),
            ),
            viewMode === 'week'
              ? React.createElement('div', {className:'hab-week'},
                  weekDays.map(({ds,wd,isToday}) => {
                    const isDone = !!habitLogs[ds]?.[h.id];
                    const isFuture = ds > today;
                    return React.createElement('div', {
                      key:ds,
                      className:`hab-day${isDone?' done':''}${isToday?' today':''}`,
                      style:{background:isDone?h.color:'',opacity:isFuture?.4:1},
                      onClick:()=>{ if(!isFuture){dispatch({type:'TOGGLE_HAB_LOG',id:h.id,ds});vib(20);}}
                    }, wd);
                  })
                )
              : React.createElement('div', {className:'hab-month'},
                  monthDays.map((ds,i) => {
                    if (!ds) return React.createElement('div', {key:'e'+i,className:'hab-month-day',style:{background:'transparent'}});
                    const isDone = !!habitLogs[ds]?.[h.id];
                    const isFuture = ds > today;
                    return React.createElement('div', {
                      key:ds, className:'hab-month-day',
                      style:{background:isDone?h.color:'var(--sur2)',opacity:isFuture?.4:1,cursor:isFuture?'default':'pointer'},
                      onClick:()=>{ if(!isFuture){dispatch({type:'TOGGLE_HAB_LOG',id:h.id,ds});vib(20);}}
                    });
                  })
                ),
            React.createElement('div', {className:'hab-prog-wrap', style:{marginTop:10}},
              React.createElement('div', {className:'hab-prog-bar'},
                React.createElement('div', {className:'hab-prog-fill', style:{width:pct+'%',background:h.color||'var(--pri)'}}),
              ),
              React.createElement('span', {className:'hab-prog-pct'}, pct+'%'),
            ),
          );
        })
  );
};


// HabitModal — 습관 생성/수정 폼(이름·이모지·색상). habit이 있으면 수정 모드.
const HabitModal = ({ habit, onClose, onSave }) => {
  const t = useT();
  const isEditing = !!habit?.id;
  const [name, setName] = useState(habit?.name||'');
  const [emoji, setEmoji] = useState(habit?.emoji||'💪');
  const [color, setColor] = useState(habit?.color||'#52B69A');
  const EMOJIS = ['💪','🏃','📚','🧘','💊','🥗','😴','💧','🎯','✍️'];

  const handleSave = () => {
    if (!name.trim()) { toast(t('habit.name_req'),'⚠️'); return; }
    onSave({ id: habit?.id||uid(), name: name.trim(), emoji, color }, isEditing ? 'edit' : 'add');
    vib(40);
  };

  return React.createElement('div', {className:'overlay open', onClick:onClose},
    React.createElement('div', {className:'sheet', onClick:e=>e.stopPropagation()},
      React.createElement('div', {className:'sheet-handle'}),
      React.createElement('div', {className:'sheet-header'},
        React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('div', {className:'sheet-title'}, isEditing ? t('habit.modal.edit') : t('habit.modal.add')),
          React.createElement('button', {style:{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--mut)'}, onClick:onClose}, '✕'),
        ),
      ),
      React.createElement('div', {className:'sheet-body'},
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('habit.name_label')),
          React.createElement('input', {className:'fi mb8',type:'text',value:name,onChange:e=>setName(e.target.value),placeholder:t('habit.name.ph'),autoFocus:true}),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('habit.emoji_label')),
          React.createElement('div', {style:{display:'flex',gap:8,flexWrap:'wrap'}},
            EMOJIS.map(e => React.createElement('span', {
              key:e, style:{fontSize:24,cursor:'pointer',padding:4,borderRadius:8,
                background:emoji===e?'var(--pri-light)':'none',border:`2px solid ${emoji===e?'var(--pri)':'transparent'}`},
              onClick:()=>setEmoji(e)
            }, e))
          ),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('habit.color_label')),
          React.createElement('div', {className:'color-row'},
            COLORS.map(c => React.createElement('div', {key:c, className:`color-swatch${color===c?' sel':''}`,
              style:{background:c}, onClick:()=>setColor(c)}))
          ),
        ),
      ),
      React.createElement('div', {className:'sheet-footer'},
        React.createElement('button', {className:'btn btn-primary', onClick:handleSave}, isEditing ? t('modal.edit_done') : t('modal.create')),
      ),
    ),
  );
};

// ══════════════════════════════════════
// 모달: 기분 기록
// ══════════════════════════════════════

export { HabitTab, HabitModal };
