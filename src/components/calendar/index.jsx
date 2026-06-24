/**
 * components/calendar/index.jsx — 캘린더 탭(앱의 메인 화면)과 그 하위 UI.
 *
 * CalendarTabUpgraded: 월/주 그리드 + 선택 날짜의 일정/기분/회고를 묶는 컨테이너.
 * EventListUpgraded: 선택 날짜 일정 목록(정렬/스와이프 삭제/복사/언두).
 * SwipeableEventItem: 스와이프로 편집·삭제하는 개별 일정 행.
 * MoodSection/DailyReview/CopyDateModal: 기분 기록·하루 회고·일정 복사 보조 UI.
 * 반복/멀티데이 전개는 store의 getEventsForDate에 위임한다.
 */
import React, { useState, useRef } from 'react';
import { LS, getHoliday, CATEGORIES, MOOD_EMOJIS } from '../../constants.js';
import { useT, useDateI18n } from '../../i18n.jsx';
import { todayStr, fmtD, firstDayOfMonth, daysInMonth, toast, vib, burstAt } from '../../utils.js';
import { getEventsForDate, useApp } from '../../store.js';
import { EmptyState } from '../common/index.jsx';
import { UndoToast, TodaySummaryCard, QuickDateChips } from '../common/index.jsx';
import { useUndo, useSwipeCal } from '../../hooks.jsx';
import { SORT_OPTS, sortEvs } from '../../helpers.js';
import { PhotoCalendarView } from '../gallery/index.jsx';

// MoodSection — 선택 날짜의 기분. 기록이 있으면 표시, 없으면 이모지 선택 프롬프트.
const MoodSection = ({ sel, moods, onOpen }) => {
  const t = useT();
  const mood = moods[sel];
  if (mood) {
    return React.createElement('div', {className:'mood-wrap mb11'},
      React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
        React.createElement('div', {style:{fontSize:13,fontWeight:700,color:'var(--txt)'}}, t('cal.mood')),
        React.createElement('button', {className:'ev-act-btn', onClick:onOpen}, '✏️'),
      ),
      React.createElement('div', {style:{fontSize:28,marginTop:8}}, mood.emoji),
      mood.note && React.createElement('div', {style:{fontSize:13,color:'var(--mut)',marginTop:4}}, mood.note),
    );
  }
  return React.createElement('div', {className:'mood-wrap mb11'},
    React.createElement('div', {className:'mood-title'}, t('cal.mood_prompt')),
    React.createElement('div', {className:'mood-btns'},
      MOOD_EMOJIS.map(e => React.createElement('span', {key:e, className:'mood-btn', onClick:()=>onOpen(e), style:{fontSize:26,cursor:'pointer'}}, e))
    ),
  );
};

// CopyDateModal — 일정을 다른 날짜로 복사. 시간/메모 유지 여부를 선택할 수 있다.
const CopyDateModal = ({ ev, onClose, onCopy }) => {
  const t = useT();
  const { fmtDate } = useDateI18n();
  const today = todayStr();
  const [targetDate, setTargetDate] = useState(today);
  const [keepTime, setKeepTime] = useState(true);
  const [keepMemo, setKeepMemo] = useState(true);

  const QUICK = [
    { label: t('cal.today'), date: today },
    { label: t('cal.tomorrow'), date: fmtD((() => { const d = new Date(); d.setDate(d.getDate()+1); return d; })()) },
    { label: t('cal.in1w'), date: fmtD((() => { const d = new Date(); d.setDate(d.getDate()+7); return d; })()) },
    { label: t('cal.in1m'), date: fmtD((() => { const d = new Date(); d.setMonth(d.getMonth()+1); return d; })()) },
  ];

  const handleCopy = () => {
    const copied = {
      ...ev,
      startTime: keepTime ? ev.startTime : '',
      endTime: keepTime ? ev.endTime : '',
      memo: keepMemo ? ev.memo : '',
    };
    onCopy(copied, targetDate);
    toast('"' + ev.title + '" ' + t('toast.copied'), '📋');
    vib(30);
    onClose();
  };

  return React.createElement('div', { className: 'overlay open', onClick: onClose },
    React.createElement('div', { className: 'sheet', onClick: e => e.stopPropagation() },
      React.createElement('div', { className: 'sheet-handle' }),
      React.createElement('div', { className: 'sheet-header' },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement('div', { className: 'sheet-title' }, t('event.copy_title')),
          React.createElement('button', { style: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--mut)' }, onClick: onClose }, '✕'),
        ),
      ),
      React.createElement('div', { className: 'sheet-body' },
        // 원본 일정 미리보기
        React.createElement('div', {
          style: { background: 'var(--pri-light)', borderRadius: 12, padding: '12px 14px', marginBottom: 18, borderLeft: '3px solid var(--pri)' }
        },
          React.createElement('div', { style: { fontSize: 12, color: 'var(--mut)', marginBottom: 4 } }, t('event.copy_src')),
          React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--txt)' } }, ev.emoji || '' + ev.title),
          ev.startDate && React.createElement('div', { style: { fontSize: 12, color: 'var(--mut)', marginTop: 2 } },
            fmtDate(ev.startDate) + (ev.startTime ? ' · ' + ev.startTime : '')
          ),
        ),
        // 빠른 날짜 선택
        React.createElement('div', { className: 'fi-label', style: { marginBottom: 8 } }, t('event.copy_date')),
        React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' } },
          QUICK.map(q => React.createElement('button', {
            key: q.label,
            style: {
              padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              border: '1.5px solid ' + (targetDate === q.date ? 'var(--pri)' : 'var(--bor)'),
              background: targetDate === q.date ? 'var(--pri-light)' : 'none',
              color: targetDate === q.date ? 'var(--pri)' : 'var(--mut)',
            },
            onClick: () => setTargetDate(q.date),
          }, q.label))
        ),
        React.createElement('div', { className: 'fi-row' },
          React.createElement('input', {
            className: 'fi', type: 'date', value: targetDate,
            onChange: e => setTargetDate(e.target.value),
          }),
        ),
        // 옵션
        React.createElement('div', { className: 'fi-row-inline' },
          React.createElement('span', { style: { fontSize: 14, color: 'var(--txt)' } }, '🕐 시간 유지'),
          React.createElement('button', { className: 'fi-toggle' + (keepTime ? ' on' : ''), onClick: () => setKeepTime(v => !v) }),
        ),
        React.createElement('div', { className: 'fi-row-inline' },
          React.createElement('span', { style: { fontSize: 14, color: 'var(--txt)' } }, '💬 메모 유지'),
          React.createElement('button', { className: 'fi-toggle' + (keepMemo ? ' on' : ''), onClick: () => setKeepMemo(v => !v) }),
        ),
      ),
      React.createElement('div', { className: 'sheet-footer' },
        React.createElement('button', { className: 'btn btn-primary', onClick: handleCopy }, '📋 이 날짜에 복사하기'),
      ),
    ),
  );
};


// SwipeableEventItem — 개별 일정 행. 왼쪽으로 스와이프하면 수정/복사/삭제 액션이 드러나고,
// 데스크톱에선 드래그로 다른 날짜에 떨어뜨려 일정 이동도 가능하다.
const SwipeableEventItem = ({ ev, sel, onEdit, onDelete, onToggle, onCopy }) => {
  const t = useT();
  const touchRef = useRef(null);
  const itemRef = useRef(null);
  const [offset, setOffset] = useState(0);     // 현재 가로 이동량(px, 음수 = 왼쪽)
  const [revealed, setRevealed] = useState(false); // 액션 버튼이 열린 상태인지
  const ACTION_W = 200; // 뒤에 숨겨진 액션 영역 너비

  const onTouchStart = (e) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, moved: false };
  };
  const onTouchMove = (e) => {
    if (!touchRef.current) return;
    const dx = e.touches[0].clientX - touchRef.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchRef.current.y);
    // 세로 움직임이 더 크면 스크롤로 보고 스와이프 시작 안 함
    if (!touchRef.current.moved && dy > Math.abs(dx)) return;
    touchRef.current.moved = true;
    e.preventDefault();
    // 이동량을 0 ~ -ACTION_W 범위로 클램프(오른쪽 초과/액션폭 초과 방지)
    const newOffset = Math.max(-ACTION_W, Math.min(0, (revealed ? -ACTION_W : 0) + dx));
    setOffset(newOffset);
  };
  const onTouchEnd = () => {
    if (!touchRef.current?.moved) return;
    // 절반 이상 끌었으면 액션을 완전히 열고, 아니면 닫는다(스냅)
    if (offset < -ACTION_W / 2) { setOffset(-ACTION_W); setRevealed(true); }
    else { setOffset(0); setRevealed(false); }
    touchRef.current = null;
  };

  const close = () => { setOffset(0); setRevealed(false); };

  const cat = CATEGORIES.find(c => c.id === (ev.category || 'personal'));

  return React.createElement('div', {
    style: { position: 'relative', overflow: 'hidden', borderRadius: 12, marginBottom: 6 },
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.setData('evId', ev.id);
      e.dataTransfer.setData('fromDs', sel);
      e.dataTransfer.effectAllowed = 'move';
    },
  },
    // 뒤에 있는 액션 버튼들
    React.createElement('div', {
      style: { position: 'absolute', right: 0, top: 0, height: '100%', display: 'flex', width: ACTION_W }
    },
      React.createElement('div', {
        style: { flex: 1, background: '#3D9EF0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, gap: 3 },
        onClick: () => { close(); onEdit(ev); }
      }, React.createElement('span', { style: { fontSize: 17 } }, '✏️'), t('btn.modify')),
      React.createElement('div', {
        style: { flex: 1, background: '#52B69A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, gap: 3 },
        onClick: () => { close(); onCopy && onCopy(ev); }
      }, React.createElement('span', { style: { fontSize: 17 } }, '📋'), t('btn.copy')),
      React.createElement('div', {
        style: { flex: 1, background: '#FF4B4B', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 11, fontWeight: 700, gap: 3 },
        onClick: () => { close(); onDelete(ev.id); }
      }, React.createElement('span', { style: { fontSize: 17 } }, '🗑️'), t('btn.del')),
    ),
    // 일정 카드
    React.createElement('div', {
      ref: itemRef,
      style: { transform: `translateX(${offset}px)`, transition: touchRef.current ? 'none' : 'transform .25s ease', position: 'relative', zIndex: 1 },
      onTouchStart, onTouchMove, onTouchEnd,
    },
      React.createElement('div', {
        className: `ev-item${ev.done ? ' done' : ''}${ev.pinned ? ' pinned' : ''}`,
        style: { background: 'var(--sur2)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }
      },
        React.createElement('div', {
          style: { width: 22, height: 22, borderRadius: '50%', border: `2px solid ${ev.done ? 'var(--pri)' : 'var(--bor2)'}`, background: ev.done ? 'var(--pri)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 1, color: '#fff', fontSize: 12 },
          onClick: (e) => { e.stopPropagation(); onToggle(ev.id); }
        }, ev.done ? '✓' : ''),
        React.createElement('div', { style: { flex: 1, minWidth: 0, cursor: 'pointer' }, onClick: () => onEdit(ev) },
          React.createElement('div', { className: 'ev-title' }, ev.title),
          React.createElement('div', { className: 'ev-meta' },
            ev.startTime && React.createElement('span', null, '🕐 ' + ev.startTime + (ev.endTime ? ' ~ ' + ev.endTime : '')),
            ev.location && React.createElement('span', null, '📍 ' + ev.location),
            cat && React.createElement('span', { className: 'ev-cat-badge', style: { background: cat.color + '22', color: cat.color } }, cat.emoji + ' ' + t('cat.' + cat.id)),
            ev.repeat && ev.repeat !== 'none' && React.createElement('span', null, '🔄 ' + t('repeat.' + ev.repeat)),
          ),
        ),
        React.createElement('div', { style: { width: 8, height: 8, borderRadius: 4, background: ev.color || 'var(--pri)', flexShrink: 0, marginTop: 4 } }),
      )
    )
  );
};

// EventListUpgraded — 선택 날짜의 일정 목록. 태그 필터·정렬, 스와이프 삭제/편집/복사, 언두를 지원.
const EventListUpgraded = ({ sel, evs, onOpenEvent, pushUndo, dispatch }) => {
  const t = useT();
  const { fmtDate } = useDateI18n();
  const today = todayStr();
  const [activeTag, setActiveTag] = useState(null);
  const [copyTarget, setCopyTarget] = useState(null);
  const [sortOrder, setSortOrder] = useState('default');
  const [showSort, setShowSort] = useState(false);
  const [recurDelTarget, setRecurDelTarget] = useState(null);

  // 일정에 달린 태그 모으기 → 선택 태그로 필터 → 정렬 옵션 적용
  const allTags = [...new Set(evs.flatMap(ev => ev.tags || []))];
  const filtered = activeTag ? evs.filter(ev => (ev.tags||[]).includes(activeTag)) : evs;
  const filteredEvs = sortEvs(filtered, sortOrder);
  const isToday = sel === today;
  const dow = new Date(sel + 'T12:00:00').getDay();

  // 완료 토글. 반복 일정은 인스턴스 단위(ds/originDate)로 토글한다.
  const handleToggle = (id) => {
    const ev = evs.find(e => e.id === id);
    const wasDone = ev?.done;
    if (ev?.isRecurring) {
      dispatch({ type: 'TOGGLE_DONE', id, ds: sel, originDate: ev.originDate });
    } else {
      dispatch({ type: 'TOGGLE_DONE', id });
    }
    vib([20, 15, 20]);
    setTimeout(() => {
      if (!wasDone) {
        // 방금 완료로 바꾼 경우, 그날 모든 일정이 끝났으면 축하 파티클을 터뜨린다
        const updatedEvs = filteredEvs.map(e => e.id === id ? {...e, done: true} : e);
        const allDone = updatedEvs.length > 0 && updatedEvs.every(e => e.done);
        if (allDone) {
          toast(t('cal.all_done'), '');
          vib([30, 20, 30, 20, 80]);
          const colors = ['var(--pri)', '#FFD700', '#7EC8E3', '#FF6B6B', '#98D8C8'];
          let count = 0;
          const burst = () => {
            if (count >= 5) return;
            const x = 40 + Math.random() * (window.innerWidth - 80);
            const y = window.innerHeight * 0.4 + Math.random() * 100;
            burstAt(x, y, colors[count % colors.length]);
            count++;
            setTimeout(burst, 160);
          };
          burst();
        } else {
          toast(t('cal.complete'));
        }
      } else {
        toast(t('cal.uncomplete'));
      }
    }, 0);
  };

  // 삭제. 반복 일정이면 '이 날짜/이후/전체' 선택을 위해 별도 모달을 띄운다.
  const handleDelete = (id) => {
    const ev = evs.find(e => e.id === id);
    if (ev?.isRecurring) {
      setRecurDelTarget(ev);
      return;
    }
    const snapshot = JSON.parse(localStorage.getItem(LS.DATA) || '{}');
    dispatch({ type: 'DELETE_EVENT', id });
    toast(t('toast.deleted'), '🗑️');
    // 5초 안에 되돌릴 수 있도록 언두 등록(삭제했던 일정을 다시 추가)
    pushUndo(`"${ev?.title}"`, () => {
      if (ev && snapshot.events) {
        dispatch({ type: 'SAVE_EVENT', ev, mode: 'add', prevDate: null });
      }
    });
  };

  // 반복 일정 삭제 분기: this(이 날짜만)/future(이후 전부)/all(원본 삭제).
  const handleRecurDelete = (mode) => {
    const ev = recurDelTarget;
    if (!ev) return;
    setRecurDelTarget(null);
    if (mode === 'this') {
      dispatch({ type: 'DELETE_RECUR_ONE', id: ev.id, originDate: ev.originDate, ds: sel });
    } else if (mode === 'future') {
      dispatch({ type: 'DELETE_RECUR_FUTURE', id: ev.id, originDate: ev.originDate, ds: sel });
    } else {
      dispatch({ type: 'DELETE_EVENT', id: ev.id });
    }
    toast(t('toast.deleted'), '🗑️');
  };

  const done = filteredEvs.filter(e => e.done).length;
  const pct = filteredEvs.length ? Math.round(done / filteredEvs.length * 100) : 0;

  return React.createElement('div', { className: 'ev-wrap' },
    React.createElement('div', { className: 'ev-date-hdr', style: { position: 'relative' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
        React.createElement('div', { className: 'ev-day-lbl' }, fmtDate(sel) + ' ' + t('cal.events')),
        React.createElement('span', { className: `ev-day-wd${isToday ? ' today' : ''}` }, isToday ? t('cal.today') : t('wd.full.' + dow)),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 6, alignItems: 'center', paddingBottom: 12 } },
        // 정렬 버튼
        React.createElement('div', { style: { position: 'relative' } },
          React.createElement('button', {
            style: {
              padding: '6px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', border: '1.5px solid ' + (sortOrder !== 'default' ? 'var(--pri)' : 'var(--bor)'),
              background: sortOrder !== 'default' ? 'var(--pri-light)' : 'var(--sur2)',
              color: sortOrder !== 'default' ? 'var(--pri)' : 'var(--mut)',
              display: 'flex', alignItems: 'center', gap: 3,
            },
            onClick: () => setShowSort(v => !v),
          },
            React.createElement('span', null, SORT_OPTS.find(o => o.id === sortOrder)?.icon || '↕'),
            React.createElement('span', null, t('sort.' + sortOrder)),
          ),
          showSort && React.createElement('div', {
            style: {
              position: 'absolute', right: 0, top: 'calc(100% + 14px)', zIndex: 200,
              background: 'var(--sur)', border: '1.5px solid var(--bor)',
              borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,.12)',
              overflow: 'hidden', minWidth: 140,
            }
          },
            SORT_OPTS.map(opt => React.createElement('div', {
              key: opt.id,
              style: {
                padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 8,
                cursor: 'pointer', fontSize: 13, fontWeight: sortOrder === opt.id ? 800 : 500,
                color: sortOrder === opt.id ? 'var(--pri)' : 'var(--txt)',
                background: sortOrder === opt.id ? 'var(--pri-light)' : 'none',
                borderBottom: '0.5px solid var(--bor)',
              },
              onClick: () => { setSortOrder(opt.id); setShowSort(false); vib(10); },
            },
              React.createElement('span', { style: { fontSize: 14 } }, opt.icon),
              t('sort.' + opt.id),
              sortOrder === opt.id && React.createElement('span', { style: { marginLeft: 'auto', fontSize: 12 } }, '✓'),
            ))
          ),
          // 드롭다운 닫기 (외부 클릭)
          showSort && React.createElement('div', {
            style: { position: 'fixed', inset: 0, zIndex: 199 },
            onClick: () => setShowSort(false),
          }),
        ),
        React.createElement('button', { className: 'pill pill-pri', onClick: () => onOpenEvent(null, 'add') }, t('btn.add')),
      ),
    ),
    allTags.length > 0 && React.createElement('div', {
      style:{display:'flex',gap:6,overflowX:'auto',padding:'8px 14px 0',scrollbarWidth:'none'}
    },
      React.createElement('button', {
        style:{flexShrink:0,padding:'5px 12px',borderRadius:99,border:'1.5px solid '+(activeTag===null?'var(--pri)':'var(--bor)'),background:activeTag===null?'var(--pri-light)':'none',color:activeTag===null?'var(--pri)':'var(--mut)',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'},
        onClick:()=>setActiveTag(null)
      }, t('stats.total')),
      allTags.map(t => React.createElement('button', {
        key:t,
        style:{flexShrink:0,padding:'5px 12px',borderRadius:99,border:'1.5px solid '+(activeTag===t?'var(--pri)':'var(--bor)'),background:activeTag===t?'var(--pri-light)':'none',color:activeTag===t?'var(--pri)':'var(--mut)',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'},
        onClick:()=>setActiveTag(activeTag===t?null:t)
      }, '#'+t))
    ),
    React.createElement('div', { className: 'ev-list' },
      filteredEvs.length > 0 && React.createElement('div', null,
        React.createElement('div', { className: 'ev-progress-label' },
          React.createElement('span', null, `${done}/${filteredEvs.length} ${t('stats.done_label')}`),
          React.createElement('span', null, pct + '%'),
        ),
        React.createElement('div', { className: 'ev-progress-bar' },
          React.createElement('div', { className: 'ev-progress-fill', style: { width: pct + '%' } }),
        ),
      ),
      filteredEvs.length === 0
        ? React.createElement(EmptyState, {
            type: 'calendar',
            title: activeTag ? '#' + activeTag + ' ' + t('cal.tag_empty') : t('cal.no_events'),
            desc: activeTag ? t('cal.tag_empty_desc') : t('cal.no_events_desc'),
            cta: activeTag ? t('cal.view_all') : t('cal.add_event_cta'),
            onCta: activeTag ? () => setActiveTag(null) : () => onOpenEvent(null,'add'),
            cta2: activeTag ? null : null,
          })
        : filteredEvs.map(ev =>
            React.createElement(SwipeableEventItem, {
              key: ev.id + sel,
              ev, sel,
              onEdit: (ev) => onOpenEvent(ev, 'edit'),
              onDelete: handleDelete,
              onToggle: handleToggle,
              onCopy: (ev) => setCopyTarget(ev),
            })
          )
    ),

    // 복사 모달
    copyTarget && React.createElement(CopyDateModal, {
      ev: copyTarget,
      onClose: () => setCopyTarget(null),
      onCopy: (ev, toDs) => {
        dispatch({ type: 'COPY_EVENT', ev, toDs });
        setCopyTarget(null);
      },
    }),

    // 반복 일정 삭제 다이얼로그
    recurDelTarget && React.createElement('div', {
      style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' },
      onClick: () => setRecurDelTarget(null),
    },
      React.createElement('div', {
        style: { background: 'var(--sur)', borderRadius: 20, padding: '20px 16px', width: '100%', maxWidth: 340 },
        onClick: e => e.stopPropagation(),
      },
        React.createElement('div', { style: { fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 4 } }, '🔁 ' + t('repeat.del.title')),
        React.createElement('div', { style: { fontSize: 12, color: 'var(--mut)', marginBottom: 16 } }, recurDelTarget.title),
        [
          { mode: 'this', label: t('repeat.del.this') },
          { mode: 'future', label: t('repeat.del.future') },
          { mode: 'all', label: t('repeat.del.all') },
        ].map(({ mode, label }) =>
          React.createElement('button', {
            key: mode,
            style: { display: 'block', width: '100%', padding: '12px 14px', marginBottom: 8, background: mode === 'all' ? '#FF4B4B12' : 'var(--sur2)', border: mode === 'all' ? '1.5px solid #FF4B4B44' : '1.5px solid var(--bor)', borderRadius: 12, fontSize: 14, fontWeight: 700, color: mode === 'all' ? '#FF4B4B' : 'var(--txt)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' },
            onClick: () => handleRecurDelete(mode),
          }, label)
        ),
        React.createElement('button', {
          style: { display: 'block', width: '100%', padding: '10px', background: 'none', border: 'none', fontSize: 13, color: 'var(--mut)', cursor: 'pointer', fontFamily: 'inherit' },
          onClick: () => setRecurDelTarget(null),
        }, t('modal.close')),
      )
    ),
  );
};

// DailyReview — 오늘에 한해 보여주는 '하루 되돌아보기' 카드. 일정/습관/기분 요약 칩과 회고 메모.
const DailyReview = ({ sel }) => {
  const { state, dispatch } = useApp();
  const t = useT();
  const { fmtDate } = useDateI18n();
  const today = todayStr();
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);

  if (sel !== today) return null; // 회고는 오늘 날짜에서만 노출

  const review = (state.reviews || {})[sel];
  const evs = getEventsForDate(state, sel);
  const evDone = evs.filter(e => e.done).length;
  const habTotal = state.habits.length;
  const habDone = state.habits.filter(h => state.habitLogs[sel]?.[h.id]).length;
  const mood = state.moods[sel];

  const handleSave = () => {
    if (!text.trim()) return;
    dispatch({ type: 'SAVE_REVIEW', ds: sel, text: text.trim() });
    setText(''); setEditing(false);
    toast(t('review.toast'), '📖');
  };

  const pillStyle = { fontSize: 11, background: 'var(--sur2)', borderRadius: 99, padding: '3px 10px', color: 'var(--txt)', fontWeight: 600 };

  // 저장된 상태
  if (review && !editing) {
    return React.createElement('div', {
      style: { margin: '10px 12px 4px', padding: '13px 15px', background: 'var(--sur)', borderRadius: 16, border: '1.5px solid var(--bor)', boxShadow: 'var(--sh-card)' }
    },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
        React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: 'var(--pri)' } }, '📖 ' + t('review.title')),
        React.createElement('button', {
          style: { fontSize: 11, color: 'var(--mut)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
          onClick: () => { setText(review.text); setEditing(true); }
        }, t('review.edit')),
      ),
      React.createElement('div', { style: { fontSize: 14, color: 'var(--txt)', lineHeight: 1.6 } }, '✍️ ' + review.text),
    );
  }

  // 입력 상태
  return React.createElement('div', {
    style: { margin: '10px 12px 4px', padding: '13px 15px', background: 'var(--sur)', borderRadius: 16, border: '1.5px solid var(--pri)', boxShadow: '0 0 0 3px var(--pri)11' }
  },
    React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--pri)', marginBottom: 10 } }, '📖 ' + t('review.title')),
    // 오늘 자동 요약 칩
    React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' } },
      evs.length > 0 && React.createElement('span', { style: pillStyle }, '✅ ' + evDone + '/' + evs.length + ' ' + t('review.summary')),
      habTotal > 0 && React.createElement('span', { style: pillStyle }, '💪 ' + habDone + '/' + habTotal + ' ' + t('review.habit_done')),
      mood && React.createElement('span', { style: pillStyle }, mood.emoji),
    ),
    React.createElement('textarea', {
      value: text,
      onChange: e => setText(e.target.value),
      placeholder: t('review.ph'),
      maxLength: 200, rows: 2,
      style: {
        width: '100%', border: '1.5px solid var(--bor)', borderRadius: 10,
        padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
        color: 'var(--txt)', background: 'var(--sur2)', resize: 'none',
        outline: 'none', boxSizing: 'border-box', lineHeight: 1.5,
      }
    }),
    React.createElement('button', {
      className: 'btn btn-primary',
      style: { width: '100%', marginTop: 8, opacity: text.trim() ? 1 : .5 },
      onClick: handleSave,
    }, t('review.save')),
  );
};

// CalendarTabUpgraded — 캘린더 메인 화면. 월/주 그리드, 스와이프 월 이동, 사진 캘린더,
// 선택 날짜의 요약·기분·일정 목록·하루 회고를 한데 묶는다.
const CalendarTabUpgraded = ({ onOpenEvent, onOpenMood }) => {
  const { state, dispatch } = useApp();
  const t = useT();
  const { fmtYr, fmtYrMo, getWd } = useDateI18n();
  const { yr, mo, sel, calView, events, moods } = state;
  const today = todayStr();
  const { undoStack, pushUndo, execUndo } = useUndo();
  const [showPhotoCalendar, setShowPhotoCalendar] = useState(false);

  // 월 이동(dir: -1 이전, +1 다음). 12월↔1월 경계에서 연도까지 보정하고 1일을 선택일로.
  const move = (dir) => {
    let nm = mo + dir, ny = yr;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    dispatch({ type: 'SET_DATE', yr: ny, mo: nm, sel: `${ny}-${String(nm + 1).padStart(2, '0')}-01` });
  };

  const swipeRef = useSwipeCal(() => move(-1), () => move(1)); // 좌우 스와이프 = 이전/다음 달
  const selDate = (ds) => { dispatch({ type: 'SET_SEL', sel: ds }); vib(10); };

  const evs = getEventsForDate(state, sel);
  const fd = firstDayOfMonth(yr, mo), nd = daysInMonth(yr, mo);
  const calId = `${yr}-${String(mo+1).padStart(2,'0')}`;
  const photoCalendar = (state.photoCalendars||[]).find(c => c.id === calId);

  // CalGrid — 월간 격자. 1일 앞에 빈 칸을 넣어 요일을 맞추고, 각 날짜에 공휴일/기분/일정 점을 표시.
  // 날짜 칸은 드롭 타깃이라 일정을 드래그해 다른 날로 이동(MOVE_EVENT)할 수 있다.
  const CalGrid = () => {
    const [dragOverDs, setDragOverDs] = useState(null);
    const cells = [];
    for (let i = 0; i < fd; i++) cells.push(React.createElement('div', { key: 'e' + i })); // 1일 시작 요일까지 빈 칸
    for (let d = 1; d <= nd; d++) {
      const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = (fd + d - 1) % 7;
      const dayEvs = getEventsForDate(state, ds);
      const hasMood = !!moods[ds];
      const isTd = ds === today, isSel = ds === sel;
      const holiday = getHoliday(ds);
      const isDragOver = dragOverDs === ds;
      let cls = 'cal-day';
      if (isTd) cls += ' is-today';
      else if (isSel) cls += ' is-sel';
      if (dow === 0 || holiday) cls += ' is-sun';
      else if (dow === 6) cls += ' is-sat';
      if (hasMood) cls += ' has-mood';
      if (isDragOver) cls += ' drag-over';
      cells.push(React.createElement('button', {
        key: ds, className: cls,
        onClick: () => selDate(ds),
        onDragOver: (e) => { e.preventDefault(); setDragOverDs(ds); },
        onDragLeave: () => setDragOverDs(null),
        onDrop: (e) => {
          e.preventDefault();
          setDragOverDs(null);
          const evId = e.dataTransfer.getData('evId');
          const fromDs = e.dataTransfer.getData('fromDs');
          if (!evId || !fromDs || fromDs === ds) return;
          const ev = (events[fromDs] || []).find(ev => ev.id === evId);
          if (!ev) return;
          dispatch({ type: 'MOVE_EVENT', evId, fromDs, toDs: ds });
          toast('"' + ev.title + '" 이동됐어요', '📅');
          vib(30);
        },
      },
        d,
        holiday && !isTd && React.createElement('div', {
          style: { fontSize: 7, color: '#FF4B4B', fontWeight: 700, lineHeight: 1, marginTop: 1, maxWidth: 30, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
        }, holiday),
        holiday && isTd && React.createElement('div', {
          style: { fontSize: 7, color: 'rgba(255,255,255,.85)', fontWeight: 700, lineHeight: 1, marginTop: 1 }
        }, holiday),
        moods[ds]?.emoji && React.createElement('div', {
          style: {fontSize: 9, lineHeight: 1, textAlign: 'center', marginTop: 0}
        }, moods[ds].emoji),
        React.createElement('div', { className: 'cal-dots' },
          dayEvs.slice(0, 3).map((ev, i) => React.createElement('div', { key: i, className: 'cal-dot', style: { background: ev.color || 'var(--pri)' } }))
        ),
      ));
    }
    return React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'cal-wds' },
        getWd().map((w, i) => React.createElement('div', { key: i, className: 'cal-wd', style: { color: i === 0 ? 'var(--pri)' : i === 6 ? 'var(--acc)' : 'var(--mut)' } }, w))
      ),
      React.createElement('div', { className: 'cal-grid', style: { position: 'relative', zIndex: 1 } }, cells),
    );
  };

  // WeekView — 선택 날짜가 속한 주(일~토)를 가로로 펼친 주간 뷰.
  const WeekView = () => {
    const base = new Date(sel + 'T12:00:00'); // 정오 기준 — DST/타임존 경계에서 날짜가 밀리는 것 방지
    const dayOfWeek = base.getDay();
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(base); d.setDate(d.getDate() - dayOfWeek + i);
      const ds = fmtD(d);
      days.push({ ds, dow: i, dayEvs: getEventsForDate(state, ds), isTd: ds === today, isSel: ds === sel, date: d.getDate() });
    }
    return React.createElement('div', { className: 'week-view' },
      days.map(({ ds, dow, dayEvs, isTd, isSel, date }) => {
        const holiday = getHoliday(ds);
        const moodEmoji = moods[ds]?.emoji;
        const isRed = dow === 0 || !!holiday;
        let numCls = 'week-day-num';
        if (isTd) numCls += ' is-today';
        else if (isSel) numCls += ' is-sel';
        return React.createElement('div', { key: ds, className: 'week-col' },
          React.createElement('div', {
            className: 'week-day-lbl',
            style: { color: isRed ? 'var(--pri)' : dow === 6 ? 'var(--sec)' : 'var(--mut)' }
          }, getWd()[dow]),
          React.createElement('div', {
            className: numCls,
            style: (!isTd && !isSel && isRed) ? { color: 'var(--pri)' } : {},
            onClick: () => selDate(ds)
          }, date),
          moodEmoji && React.createElement('div', { style: { fontSize: 10, lineHeight: 1, textAlign: 'center' } }, moodEmoji),
          React.createElement('div', { className: 'week-dots' },
            dayEvs.slice(0, 3).map((ev, i) => React.createElement('div', { key: i, className: 'cal-dot', style: { background: ev.color || 'var(--pri)' } }))
          ),
        );
      })
    );
  };;

  return React.createElement('div', { className: 'pane active', id: 'pane-calendar' },
    // 오늘 요약 카드
    React.createElement(TodaySummaryCard, { events, onOpenEvent }),

    // 캘린더 카드 (스와이프 가능)
    React.createElement('div', {
      className: 'cal-card', ref: swipeRef,
      style: photoCalendar?.coverThumb ? {
        backgroundImage: 'url(' + photoCalendar.coverThumb + ')',
        backgroundSize: 'cover', backgroundPosition: 'center',
        position: 'relative',
      } : {},
    },
      photoCalendar?.coverThumb && React.createElement('div', {
        style: { position: 'absolute', inset: 0, background: 'rgba(255,255,255,.82)', borderRadius: 'inherit', zIndex: 0, pointerEvents: 'none' }
      }),
      React.createElement('div', { className: 'cal-view-row' },
        React.createElement('button', { className: `cal-view-btn${calView === 'month' ? ' active' : ''}`, onClick: () => dispatch({ type: 'SET_CAL_VIEW', view: 'month' }) }, t('cal.monthly')),
        React.createElement('button', { className: `cal-view-btn${calView === 'week' ? ' active' : ''}`, onClick: () => dispatch({ type: 'SET_CAL_VIEW', view: 'week' }) }, t('cal.weekly')),
      ),
      React.createElement('div', { className: 'cal-hdr' },
        React.createElement('button', { className: 'cal-arr', onClick: () => move(-1) }, '‹'),
        React.createElement('div', { style: { textAlign: 'center' } },
          photoCalendar?.titleText && React.createElement('div', {
            style: { fontSize: 11, fontWeight: 800, color: photoCalendar.titleColor || 'var(--pri)', marginBottom: 2, zIndex: 2, position: 'relative' }
          }, photoCalendar.titleText),
          React.createElement('div', { className: 'cal-yr', style: { position: 'relative', zIndex: 2 } }, fmtYr(yr)),
          React.createElement('div', { className: 'cal-mo', style: { position: 'relative', zIndex: 2 } }, t('mo.' + mo)),
        ),
        React.createElement('button', { className: 'cal-arr', onClick: () => move(1) }, '›'),
      ),
      calView === 'month' ? React.createElement(CalGrid) : React.createElement(WeekView),

      // 포토캘린더 메모
      photoCalendar?.memo && React.createElement('div', {
        style: {
          padding: '10px 16px',
          fontSize: 12, fontWeight: 700, fontStyle: 'italic',
          color: '#fff',
          textAlign: 'center',
          background: 'rgba(245,96,74,.85)',
          borderRadius: '0 0 var(--r) var(--r)',
          position: 'relative', zIndex: 2,
          letterSpacing: '.3px',
        }
      }, '✦ ' + photoCalendar.memo + ' ✦'),
    ),

    // 포토캘린더 버튼 (우측 하단 플로팅)
    React.createElement('div', {
      style: { display: 'flex', justifyContent: 'flex-end', padding: '0 12px 4px' }
    },
      React.createElement('button', {
        style: {
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'var(--pri-light)', border: '1.5px solid var(--pri)',
          borderRadius: 99, padding: '5px 12px', fontSize: 11, fontWeight: 700,
          color: 'var(--pri)', cursor: 'pointer', fontFamily: 'inherit',
        },
        onClick: () => setShowPhotoCalendar(true),
      },
        t('cal.photo'),
      ),
    ),

    // 빠른 날짜 칩
    React.createElement(QuickDateChips, { onSelect: (ds) => { selDate(ds); const d = new Date(ds + 'T12:00'); dispatch({ type: 'SET_DATE', yr: d.getFullYear(), mo: d.getMonth(), sel: ds }); } }),

    // 기분 섹션
    React.createElement(MoodSection, { sel, moods, onOpen: onOpenMood }),

    // 개선된 일정 목록 (스와이프 + 언두)
    React.createElement(EventListUpgraded, { sel, evs, onOpenEvent, pushUndo, dispatch }),

    // 하루 되돌아보기 (오늘만)
    React.createElement(DailyReview, { sel }),

    // 언두 토스트
    React.createElement(UndoToast, { undoStack, onUndo: execUndo }),

    showPhotoCalendar && React.createElement(PhotoCalendarView, {
      state, dispatch,
      onClose: () => setShowPhotoCalendar(false),
    }),
  );
};

// ⑫ 개선된 GalleryTab (드래그 정렬)


// ══════════════════════════════════════
// 포토 캘린더 — 메인 컴포넌트
// ══════════════════════════════════════

export { MoodSection, CopyDateModal, SwipeableEventItem, EventListUpgraded, DailyReview, CalendarTabUpgraded };
