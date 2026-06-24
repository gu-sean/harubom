/**
 * components/modals/index.jsx — 일정/기분/검색 모달 모음.
 *
 * EventModal: 일정 생성·수정 폼(날짜·시간·반복·태그·알림 등 입력).
 * MoodModal: 선택 날짜의 기분(이모지/메모) 기록.
 * SearchModal: 전체 일정/D-Day 등을 검색해 해당 날짜로 이동.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { REPEAT, CATEGORIES, COLORS, MOOD_EMOJIS } from '../../constants.js';
import { useT, useDateI18n } from '../../i18n.jsx';
import { todayStr, uid, requestNotificationPermission, toast, vib } from '../../utils.js';
import { useApp } from '../../store.js';
import { getGoalProgress, getGoalCat } from '../../helpers.js';

// EventModal — 일정 생성/수정 폼. mode가 'edit'이면 수정. 저장 시 onSave(ev, mode, 원래시작일) 호출.
const EventModal = ({ event, mode, onClose, onSave, onDelete }) => {
  const t = useT();
  const today = todayStr();
  const [title, setTitle] = useState(event?.title||'');
  const [startDate, setStartDate] = useState(event?.startDate||today);
  const [endDate, setEndDate] = useState(event?.endDate||event?.startDate||today);
  const [startTime, setStartTime] = useState(event?.startTime||'');
  const [endTime, setEndTime] = useState(event?.endTime||'');
  const [allDay, setAllDay] = useState(event?.allDay||false);
  const [location, setLocation] = useState(event?.location||'');
  const [memo, setMemo] = useState(event?.memo||'');
  const [color, setColor] = useState(event?.color||'#FF6B6B');
  const [category, setCategory] = useState(event?.category||'personal');
  const [priority, setPriority] = useState(event?.priority||'normal');
  const [repeat, setRepeat] = useState(event?.repeat||'none');
  const [repeatUntil, setRepeatUntil] = useState(event?.repeatUntil||'');
  const [pinned, setPinned] = useState(event?.pinned||false);
  const [tags, setTags] = useState(event?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [notifyBefore, setNotifyBefore] = useState(event?.notifyBefore ?? null);

  // 저장 전 검증(제목 필수/길이/날짜 순서) 후 일정 객체를 만들어 onSave에 넘긴다.
  const handleSave = () => {
    if (!title.trim()) { toast(t('event.name_req'),'⚠️'); return; }
    if (title.trim().length > 100) { toast(t('event.title_len'),'⚠️'); return; }
    if (endDate < startDate) { toast(t('event.date_err'),'⚠️'); return; }
    const ev = {
      id: event?.id || uid(),
      title: title.trim(), startDate, endDate: endDate > startDate ? endDate : startDate,
      // 하루 종일이면 시간 필드는 비운다
      allDay, startTime: allDay?'':startTime, endTime: allDay?'':endTime,
      time: allDay?'':startTime, location, memo, color, category, priority, repeat, repeatUntil, pinned,
      tags: tags.filter(t => t.trim()),
      notifyBefore,
      done: event?.done||false,
    };
    onSave(ev, mode, event?.startDate);
    vib(40);
  };

  return React.createElement('div', {className:'overlay open', onClick:onClose},
    React.createElement('div', {className:'sheet', onClick:e=>e.stopPropagation()},
      React.createElement('div', {className:'sheet-handle'}),
      React.createElement('div', {className:'sheet-header'},
        React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('div', {className:'sheet-title'}, mode==='edit'?t('event.edit'):t('event.new')),
          React.createElement('button', {style:{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--mut)'}, onClick:onClose}, '✕'),
        ),
      ),
      React.createElement('div', {className:'sheet-body'},
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('event.name')),
          React.createElement('input', {className:'fi mb8',type:'text',value:title,onChange:e=>setTitle(e.target.value),placeholder:t('event.name.ph'),autoFocus:true}),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('event.date')),
          React.createElement('div', {className:'fi-2col'},
            React.createElement('input', {className:'fi',type:'date',value:startDate,onChange:e=>setStartDate(e.target.value)}),
            React.createElement('input', {className:'fi',type:'date',value:endDate,onChange:e=>setEndDate(e.target.value)}),
          ),
        ),
        React.createElement('div', {className:'fi-row-inline'},
          React.createElement('span', {style:{fontSize:14,color:'var(--txt)'}}, t('event.allday')),
          React.createElement('button', {className:`fi-toggle${allDay?' on':''}`, onClick:()=>setAllDay(!allDay)}),
        ),
        !allDay && React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('event.time')),
          React.createElement('div', {className:'fi-2col'},
            React.createElement('input', {className:'fi',type:'time',value:startTime,onChange:e=>setStartTime(e.target.value)}),
            React.createElement('input', {className:'fi',type:'time',value:endTime,onChange:e=>setEndTime(e.target.value)}),
          ),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('event.category')),
          React.createElement('div', {style:{display:'flex',gap:6,flexWrap:'wrap'}},
            CATEGORIES.map(cat => React.createElement('button', {
              key:cat.id,
              style:{padding:'6px 12px',borderRadius:20,border:`1.5px solid ${category===cat.id?cat.color:' var(--bor)'}`,
                background:category===cat.id?cat.color+'22':'none',color:category===cat.id?cat.color:'var(--mut)',
                fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'},
              onClick:()=>setCategory(cat.id)
            }, cat.emoji+' '+t('cat.' + cat.id)))
          ),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('event.color')),
          React.createElement('div', {className:'color-row'},
            COLORS.map(c => React.createElement('div', {key:c, className:`color-swatch${color===c?' sel':''}`,
              style:{background:c}, onClick:()=>setColor(c)}))
          ),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('event.priority')),
          React.createElement('div', {style:{display:'flex',gap:6}},
            [['high','event.priority.high'],['normal','event.priority.normal'],['low','event.priority.low']].map(([v,k]) =>
              React.createElement('button', {key:v,
                style:{flex:1,padding:'8px',borderRadius:20,border:`1.5px solid ${priority===v?'var(--pri)':'var(--bor)'}`,
                  background:priority===v?'var(--pri-light)':'none',color:priority===v?'var(--pri)':'var(--mut)',
                  fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'},
                onClick:()=>setPriority(v)
              }, t(k))
            )
          ),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('event.repeat')),
          React.createElement('select', {className:'fi',value:repeat,onChange:e=>setRepeat(e.target.value)},
            REPEAT.map(v => React.createElement('option', {key:v,value:v}, t('repeat.' + v)))
          ),
        ),
        repeat !== 'none' && React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('event.repeat.until')),
          React.createElement('input', {className:'fi',type:'date',value:repeatUntil,onChange:e=>setRepeatUntil(e.target.value)}),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('input', {className:'fi',type:'text',value:location,onChange:e=>setLocation(e.target.value),placeholder:t('event.location')}),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('textarea', {className:'fi',value:memo,onChange:e=>setMemo(e.target.value),placeholder:t('event.memo'),rows:3,style:{resize:'none'}}),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('event.tags')),
          React.createElement('div', {style:{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}},
            (tags||[]).map(tg => React.createElement('span', {
              key: tg,
              style:{display:'inline-flex',alignItems:'center',gap:4,background:'var(--pri-light)',color:'var(--pri)',borderRadius:99,padding:'4px 10px',fontSize:12,fontWeight:700}
            },
              '#' + tg,
              React.createElement('span', {
                style:{cursor:'pointer',fontSize:14,lineHeight:1,marginLeft:2},
                onClick: () => setTags(tags.filter(x => x !== tg))
              }, '×')
            ))
          ),
          React.createElement('div', {style:{display:'flex',gap:6}},
            React.createElement('input', {
              className:'fi', style:{flex:1},
              value: tagInput, placeholder:t('event.tags.ph'),
              onChange: e => setTagInput(e.target.value),
              onKeyDown: e => {
                if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                  e.preventDefault();
                  const tag = tagInput.trim().replace(/^#/, '').replace(/,/g,'').trim();
                  if (tag && !tags.includes(tag)) setTags([...tags, tag]);
                  setTagInput('');
                }
                if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                  setTags(tags.slice(0,-1));
                }
              },
            }),
            React.createElement('button', {
              style:{background:'var(--pri)',color:'#fff',border:'none',borderRadius:99,padding:'0 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'},
              onClick: () => {
                const tag = tagInput.trim().replace(/^#/,'').trim();
                if (tag && !tags.includes(tag)) setTags([...tags, tag]);
                setTagInput('');
              }
            }, t('event.tags.add'))
          ),
        ),
        React.createElement('div', {className:'fi-row-inline'},
          React.createElement('span', {style:{fontSize:14,color:'var(--txt)'}}, t('event.pinned')),
          React.createElement('button', {className:`fi-toggle${pinned?' on':''}`, onClick:()=>setPinned(!pinned)}),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('event.notify')),
          React.createElement('div', {style:{display:'flex',gap:6,flexWrap:'wrap'}},
            [
              {v: null,  k: 'event.notify.none'},
              {v: 10,    k: 'event.notify.10'},
              {v: 30,    k: 'event.notify.30'},
              {v: 60,    k: 'event.notify.60'},
              {v: 1440,  k: 'event.notify.1440'},
            ].map(opt => React.createElement('button', {
              key: String(opt.v),
              style: {
                padding: '6px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${notifyBefore === opt.v ? 'var(--pri)' : 'var(--bor)'}`,
                background: notifyBefore === opt.v ? 'var(--pri-light)' : 'none',
                color: notifyBefore === opt.v ? 'var(--pri)' : 'var(--mut)',
              },
              onClick: async () => {
                if (opt.v !== null) {
                  const allowed = await requestNotificationPermission();
                  if (!allowed) { toast(t('toast.notif_denied'), '🔔'); return; }
                }
                setNotifyBefore(opt.v);
              },
            }, t(opt.k)))
          ),
        ),
      ),
      React.createElement('div', {className:'sheet-footer'},
        mode === 'edit'
          ? React.createElement('div', { style: { display: 'flex', gap: 8, width: '100%' } },
              React.createElement('button', { className: 'btn btn-primary', style: { flex: 1 }, onClick: handleSave }, t('btn.edit')),
              React.createElement('button', { className: 'btn', style: { flex: 1, background: '#FF4B4B', color: '#fff', border: 'none' }, onClick: () => onDelete && onDelete(event.id) }, t('btn.delete')),
            )
          : React.createElement('button', { className: 'btn btn-primary', onClick: handleSave }, t('btn.save')),
      ),
    ),
  );
};

// MoodModal — 선택 날짜(sel)의 기분을 이모지+메모로 기록. moods[날짜]에 저장.
const MoodModal = ({ sel, moods, initEmoji, onClose, onSave }) => {
  const t = useT();
  const [moodSel, setMoodSel] = useState(initEmoji||moods[sel]?.emoji||'');
  const [note, setNote] = useState(moods[sel]?.note||'');

  const handleSave = () => {
    if (!moodSel) { toast(t('mood.emoji_req'),'⚠️'); return; }
    onSave(sel, { emoji: moodSel, note, ts: Date.now() });
    toast(t('toast.mood_saved'),'📓');
    vib(30);
    onClose();
  };

  return React.createElement('div', {className:'overlay open', onClick:onClose},
    React.createElement('div', {className:'sheet', onClick:e=>e.stopPropagation()},
      React.createElement('div', {className:'sheet-handle'}),
      React.createElement('div', {className:'sheet-header'},
        React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('div', {className:'sheet-title'}, t('mood.title')),
          React.createElement('button', {style:{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--mut)'}, onClick:onClose}, '✕'),
        ),
      ),
      React.createElement('div', {className:'sheet-body'},
        React.createElement('div', {
          style:{
            display:'flex', flexWrap:'wrap', gap:10,
            justifyContent:'center',
            marginBottom:16,
          }},
          MOOD_EMOJIS.map(e => React.createElement('span', {
            key:e, className:`mood-btn${moodSel===e?' sel':''}`,
            style:{
              fontSize:32, cursor:'pointer', padding:'8px',
              borderRadius:12,
              background: moodSel===e ? 'var(--pri-light)' : 'none',
              border: moodSel===e ? '2px solid var(--pri)' : '2px solid transparent',
              transition:'all .15s',
              lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center',
              width:52, height:52,
            },
            onClick:()=>setMoodSel(e)
          }, e))
        ),
        React.createElement('textarea', {
          className:'fi', value:note, onChange:e=>setNote(e.target.value.slice(0,200)),
          placeholder:t('mood.ph'), rows:3, style:{resize:'none'},
          maxLength:200
        }),
      ),
      React.createElement('div', {className:'sheet-footer'},
        React.createElement('button', {className:'btn btn-primary', onClick:handleSave}, t('modal.record')),
      ),
    ),
  );
};

// SearchModal — 검색어로 일정 등을 찾아 결과 선택 시 onGo(탭, 날짜)로 이동.
const SearchModal = ({ onClose, onGo }) => {
  const { state } = useApp();
  const t = useT();
  const { fmtDate, fmtYrMo } = useDateI18n();
  const [q, setQ] = useState('');
  const inpRef = useRef(null);
  useEffect(() => { setTimeout(() => inpRef.current?.focus(), 100); }, []); // 모달 열리면 입력창 자동 포커스

  // 검색어가 바뀔 때만 결과 재계산. 입력이 비면 빈 배열.
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const lq = q.toLowerCase();
    const evResults = [];
    Object.entries(state.events).forEach(([ds, evs]) => {
      (evs||[]).forEach(ev => {
        const tagMatch = (ev.tags||[]).some(t => t.toLowerCase().includes(lq) || ('#'+t).toLowerCase().includes(lq));
        if (ev.title.toLowerCase().includes(lq) || tagMatch) evResults.push({ type:'event', ev, ds });
      });
    });
    const ddResults = state.ddays.filter(d => d.label.toLowerCase().includes(lq)).map(d => ({type:'dday',d}));
    const habResults = state.habits.filter(h => h.name.toLowerCase().includes(lq)).map(h => ({type:'habit',h}));
    const goalResults = (state.goals||[]).filter(g => g.title.toLowerCase().includes(lq) || (g.memo||'').toLowerCase().includes(lq)).map(g => ({type:'goal',g}));
    const calResults = (state.photoCalendars||[]).filter(c => (c.titleText||'').toLowerCase().includes(lq) || (c.memo||'').toLowerCase().includes(lq)).map(c => ({type:'photocal',c}));
    return [...evResults, ...ddResults, ...habResults, ...goalResults, ...calResults].slice(0, 25);
  }, [q, state]);

  const highlight = (text) => {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return React.createElement(React.Fragment, null,
      text.slice(0,idx),
      React.createElement('mark', null, text.slice(idx, idx+q.length)),
      text.slice(idx+q.length),
    );
  };

  return React.createElement('div', {className:'search-overlay'},
    React.createElement('div', {className:'search-bar'},
      React.createElement('input', {className:'search-inp', ref:inpRef, value:q, onChange:e=>setQ(e.target.value), placeholder:t('search.ph')}),
      React.createElement('button', {style:{background:'none',border:'none',fontSize:16,cursor:'pointer',color:'var(--mut)',padding:'4px 8px'}, onClick:onClose}, '✕'),
    ),
    React.createElement('div', {className:'search-results'},
      results.length === 0 && q && React.createElement('div', {style:{textAlign:'center',padding:'40px 20px'}},
        React.createElement('div', {style:{fontSize:36,marginBottom:12}}, '🔍'),
        React.createElement('div', {style:{fontSize:14,fontWeight:700,color:'var(--txt)',marginBottom:6}}, t('search.empty')),
        React.createElement('div', {style:{fontSize:12,color:'var(--mut)'}}, '"'+q+'" '+t('search.no_result')),
      ),
      results.length > 0 && React.createElement('div', {style:{fontSize:11,color:'var(--mut)',padding:'4px 0 8px',fontWeight:600}},
        results.length + t('search.count')
      ),
      results.map((r,i) => {
        if (r.type === 'event') return React.createElement('div', {key:i, className:'search-item', onClick:()=>{onGo('calendar',r.ds);onClose();}},
          React.createElement('div', {className:'search-item-title'}, highlight(r.ev.title)),
          React.createElement('div', {className:'search-item-sub'}, '📅 '+fmtDate(r.ds)+(r.ev.startTime?' · '+r.ev.startTime:'')),
        );
        if (r.type === 'dday') return React.createElement('div', {key:i, className:'search-item', onClick:()=>{onGo('dday');onClose();}},
          React.createElement('div', {className:'search-item-title'}, r.d.emoji+' '+highlight(r.d.label)),
          React.createElement('div', {className:'search-item-sub'}, '🚩 D-Day · '+fmtDate(r.d.date)),
        );
        if (r.type === 'habit') return React.createElement('div', {key:i, className:'search-item', onClick:()=>{onGo('habit');onClose();}},
          React.createElement('div', {className:'search-item-title'}, r.h.emoji+' '+highlight(r.h.name)),
          React.createElement('div', {className:'search-item-sub'}, t('search.type.habit')),
        );
        if (r.type === 'goal') {
          const { current, target } = getGoalProgress(r.g, state);
          const pct = target ? Math.min(Math.round(current/target*100), 100) : 0;
          const isDone = current >= target;
          const cat = getGoalCat(r.g.category);
          return React.createElement('div', {key:i, className:'search-item', onClick:()=>{onGo('goal');onClose();}},
            React.createElement('div', {className:'search-item-title'},
              React.createElement('span', {style:{marginRight:6}}, r.g.emoji||cat.emoji),
              highlight(r.g.title),
              isDone && React.createElement('span', {style:{fontSize:11,marginLeft:6,background:cat.color,color:'#fff',borderRadius:99,padding:'1px 7px',fontWeight:700}}, t('search.type.done')),
            ),
            React.createElement('div', {className:'search-item-sub', style:{display:'flex',alignItems:'center',gap:8,marginTop:4}},
              React.createElement('span', null, t('search.type.goal')+' · '+t('gcat.' + cat.id)),
              React.createElement('div', {style:{flex:1,height:4,background:'var(--sur2)',borderRadius:2,overflow:'hidden',maxWidth:80}},
                React.createElement('div', {style:{height:'100%',background:isDone?cat.color:'var(--pri)',width:pct+'%',borderRadius:2}}),
              ),
              React.createElement('span', {style:{fontWeight:700,color:isDone?cat.color:'var(--pri)'}}, pct+'%'),
            ),
          );
        }
        if (r.type === 'photocal') return React.createElement('div', {key:i, className:'search-item', onClick:()=>{
          onGo('calendar', r.c.yr + '-' + String(r.c.mo+1).padStart(2,'0') + '-01');
          onClose();
        }},
          React.createElement('div', {className:'search-item-title'}, '📅 ', highlight(fmtYrMo(r.c.yr, r.c.mo) + (r.c.titleText ? ' · ' + r.c.titleText : ''))),
          r.c.memo && React.createElement('div', {className:'search-item-sub'}, r.c.memo),
        );
        return null;
      })
    ),
  );
};

// ══════════════════════════════════════
// 계정 모달 (Firebase Auth)
// ══════════════════════════════════════

export { EventModal, MoodModal, SearchModal };
