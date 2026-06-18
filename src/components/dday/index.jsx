/**
 * components/dday/index.jsx — D-Day(기념일/카운트다운) 탭과 편집 모달.
 *
 * DDayTab: 등록된 D-Day를 가까운 순으로 정렬해 보여주고 7일 이내는 배너로 강조.
 * DDayModal: D-Day 생성/수정 폼(매년 반복·알림 옵션 포함).
 * 남은 일수 계산은 utils의 getDDayInfo, 알림 예약은 scheduleDDayNotif에 위임.
 */
import React, { useState, useEffect } from 'react';
import { COLORS } from '../../constants.js';
import { useT, useDateI18n } from '../../i18n.jsx';
import { todayStr, uid, getDDayInfo, scheduleDDayNotif, requestNotificationPermission, toast, vib } from '../../utils.js';
import { useApp } from '../../store.js';
import { EmptyState } from '../common/index.jsx';

// DDayTab — D-Day 목록 화면. 정렬/배너/삭제를 담당하고, 추가/수정은 onOpen으로 모달을 띄운다.
const DDayTab = ({ onOpen }) => {
  const { state, dispatch } = useApp();
  const t = useT();
  const { fmtDate } = useDateI18n();
  const { ddays } = state;
  const today = todayStr();

  // 앱 로드 시 알림 예약 재등록
  useEffect(() => {
    ddays.forEach(dd => { if (dd.notify) scheduleDDayNotif(dd); });
  }, []);

  const handleDelete = (id) => {
    if (confirm(t('dday.delete.confirm'))) {
      dispatch({ type: 'DELETE_DDAY', id });
      toast(t('toast.deleted'),'🗑️');
      vib(30);
    }
  };

  // 가까운 날짜 순으로 정렬 (오늘이 제일 앞, 그 다음 미래 순, 지난 것은 맨 뒤)
  const sorted = [...ddays].sort((a, b) => {
    const ia = getDDayInfo(a), ib = getDDayInfo(b);
    // 지난 D-Day(diff<0)는 큰 가중치를 더해 미래 항목들 뒤로 밀어낸다(가까운 미래가 맨 앞)
    const da = ia.diff < 0 ? 99999 + Math.abs(ia.diff) : ia.diff;
    const db = ib.diff < 0 ? 99999 + Math.abs(ib.diff) : ib.diff;
    return da - db;
  });

  // 다가오는 D-Day 배너 (7일 이내)
  const upcoming = sorted.filter(dd => {
    const { diff } = getDDayInfo(dd);
    return diff >= 0 && diff <= 7;
  });

  return React.createElement('div', {className:'pane active', id:'pane-dday'},
    // 헤더
    React.createElement('div', {className:'row'},
      React.createElement('h2', {style:{fontSize:17,fontWeight:700,color:'var(--txt)'}}, t('dday.title')),
      React.createElement('button', {className:'pill pill-pri', onClick:()=>onOpen(null)}, t('btn.add')),
    ),

    // 7일 이내 알림 배너
    upcoming.length > 0 && React.createElement('div', {
      style:{background:'linear-gradient(135deg,var(--pri),var(--sec))',borderRadius:14,padding:'12px 16px',marginBottom:14,color:'#fff'}
    },
      React.createElement('div', {style:{fontSize:11,opacity:.85,marginBottom:6,fontWeight:600}}, t('dday.upcoming')),
      upcoming.map(dd => {
        const { diff } = getDDayInfo(dd);
        return React.createElement('div', {
          key:dd.id,
          style:{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0'}
        },
          React.createElement('span', {style:{fontSize:13,fontWeight:700}}, dd.emoji+' '+dd.label),
          React.createElement('span', {style:{fontSize:13,fontWeight:900,background:'rgba(255,255,255,.25)',borderRadius:99,padding:'2px 10px'}},
            diff === 0 ? t('dday.today_label') : 'D-'+diff
          ),
        );
      })
    ),

    // D-Day 없음
    sorted.length === 0
      ? React.createElement(EmptyState, {
          type: 'dday',
          title: t('dday.empty.title'),
          desc: t('dday.empty.desc'),
          cta: t('dday.empty.cta'),
          onCta: () => onOpen(null),
          cta2: t('dday.empty.cta2'),
          onCta2: () => onOpen({ emoji: '🎂', yearly: true, notify: true }),
        })
      : sorted.map(dd => {
          const { diff, nextDate, years } = getDDayInfo(dd);
          const isToday = diff === 0;
          const isPast = diff < 0;
          const countLabel = isToday ? t('cal.today') : isPast ? 'D+'+Math.abs(diff) : 'D-'+diff;

          return React.createElement('div', {key:dd.id, className:'dd-card fade-up'},
            // 상단: 이모지, 이름, 날짜 + 카운트
            React.createElement('div', {className:'dd-header'},
              React.createElement('div', {style:{flex:1}},
                React.createElement('div', {style:{display:'flex',alignItems:'center',gap:8,marginBottom:4}},
                  React.createElement('div', {className:'dd-emoji'}, dd.emoji||'🚩'),
                  React.createElement('div', {style:{display:'flex',flexDirection:'column'}},
                    React.createElement('div', {className:'dd-label'}, dd.label),
                    React.createElement('div', {className:'dd-date'},
                      dd.yearly
                        ? (years > 0 ? years + t('dday.anniversary') + ' · ' : '') + fmtDate(nextDate)
                        : fmtDate(dd.date)
                    ),
                  ),
                ),
                // 배지 행
                React.createElement('div', {style:{display:'flex',gap:5,flexWrap:'wrap'}},
                  dd.yearly && React.createElement('span', {
                    style:{fontSize:10,fontWeight:700,background:'#FFF0EE',color:'var(--pri)',borderRadius:99,padding:'2px 8px'}
                  }, '🔄 ' + t('dday.yearly')),
                  dd.notify && React.createElement('span', {
                    style:{fontSize:10,fontWeight:700,background:'#E8FAF5',color:'#0F6E56',borderRadius:99,padding:'2px 8px'}
                  }, '🔔 ' + t('dday.notify')),
                  isPast && !dd.yearly && React.createElement('span', {
                    style:{fontSize:10,fontWeight:700,background:'var(--sur2)',color:'var(--mut)',borderRadius:99,padding:'2px 8px'}
                  }, t('dday.past')),
                ),
              ),
              // 카운트 숫자
              React.createElement('div', {style:{textAlign:'right',flexShrink:0,minWidth:60}},
                isToday
                  ? React.createElement('div', {className:'dd-today'}, '🎉')
                  : React.createElement(React.Fragment, null,
                      React.createElement('div', {
                        className:'dd-count',
                        style:{color: isPast ? 'var(--mut)' : (dd.color||'var(--pri)'), fontSize: Math.abs(diff) > 999 ? 28 : 40}
                      }, Math.abs(diff)),
                      React.createElement('div', {className:'dd-unit', style:{color: isPast ? 'var(--mut)' : 'var(--mut)'}}, countLabel),
                    ),
              ),
            ),

            // 오늘인 경우 축하 메시지
            isToday && React.createElement('div', {
              style:{textAlign:'center',padding:'8px 0',fontSize:15,fontWeight:700,color:'var(--pri)'}
            }, dd.emoji+' '+dd.label+' 🎉 오늘이에요!'),

            // 하단 액션
            React.createElement('div', {className:'dd-actions'},
              React.createElement('button', {className:'dd-act-btn', onClick:()=>onOpen(dd)}, '✏️ ' + t('btn.modify')),
              React.createElement('button', {className:'dd-act-btn danger', onClick:()=>handleDelete(dd.id)}, '🗑️ ' + t('btn.delete')),
            ),
          );
        })
  );
};

// DDayModal — D-Day 생성/수정 폼. dd가 있으면 수정, 없으면 신규.
const DDayModal = ({ dd, onClose, onSave }) => {
  const t = useT();
  const isEditing = !!dd?.id;
  const [label, setLabel] = useState(dd?.label||'');
  const [date, setDate] = useState(dd?.date||todayStr());
  const [emoji, setEmoji] = useState(dd?.emoji||'🚩');
  const [color, setColor] = useState(dd?.color||'#F5604A');
  const [yearly, setYearly] = useState(dd?.yearly||false);
  const [notify, setNotify] = useState(dd?.notify||false);
  const [notifyDays, setNotifyDays] = useState(dd?.notifyDays||0);

  const EMOJIS = ['🚩','🎂','💍','✈️','🎓','💪','🎉','❤️','🌸','⭐'];
  const NOTIFY_OPTIONS = [
    {v:0, k:'dday.notify.same_day'},
    {v:1, k:'dday.notify.1d'},
    {v:3, k:'dday.notify.3d'},
    {v:7, k:'dday.notify.7d'},
  ];

  // 저장: 이름 필수 검증 후 상위 onSave 호출. 알림 켜져 있으면 즉시 알림 예약.
  const handleSave = () => {
    if (!label.trim()) { toast(t('dday.name_req'),'⚠️'); return; }
    const saved = { id: dd?.id||uid(), label: label.trim(), date, emoji, color, yearly, notify, notifyDays };
    onSave(saved, isEditing ? 'edit' : 'add');
    if (notify) scheduleDDayNotif(saved);
    vib(40);
  };

  return React.createElement('div', {className:'overlay open', onClick:onClose},
    React.createElement('div', {className:'sheet', onClick:e=>e.stopPropagation()},
      React.createElement('div', {className:'sheet-handle'}),
      React.createElement('div', {className:'sheet-header'},
        React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('div', {className:'sheet-title'}, isEditing ? t('dday.modal.edit') : t('dday.modal.add')),
          React.createElement('button', {style:{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--mut)'}, onClick:onClose}, '✕'),
        ),
      ),
      React.createElement('div', {className:'sheet-body'},
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('dday.name_label')),
          React.createElement('input', {className:'fi mb8',type:'text',value:label,onChange:e=>setLabel(e.target.value),placeholder:t('dday.name.ph'),autoFocus:true}),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('dday.date_label')),
          React.createElement('input', {className:'fi',type:'date',value:date,onChange:e=>setDate(e.target.value)}),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('dday.emoji_label')),
          React.createElement('div', {style:{display:'flex',gap:8,flexWrap:'wrap'}},
            EMOJIS.map(e => React.createElement('span', {
              key:e, style:{fontSize:24,cursor:'pointer',padding:4,borderRadius:8,
                background:emoji===e?'var(--pri-light)':'none',border:`2px solid ${emoji===e?'var(--pri)':'transparent'}`},
              onClick:()=>setEmoji(e)
            }, e))
          ),
        ),
        React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('dday.color_label')),
          React.createElement('div', {className:'color-row'},
            COLORS.map(c => React.createElement('div', {key:c, className:`color-swatch${color===c?' sel':''}`,
              style:{background:c}, onClick:()=>setColor(c)}))
          ),
        ),
        React.createElement('div', {className:'fi-row-inline'},
          React.createElement('span', {style:{fontSize:14,color:'var(--txt)'}}, t('dday.yearly_label')),
          React.createElement('button', {
            className:`fi-toggle${yearly?' on':''}`,
            type: 'button',
            onClick:()=>setYearly(v=>!v)
          }),
        ),
        React.createElement('div', {className:'fi-row-inline'},
          React.createElement('span', {style:{fontSize:14,color:'var(--txt)'}}, t('dday.notify_label')),
          React.createElement('button', {
            className:`fi-toggle${notify?' on':''}`,
            type: 'button',
            onClick: async ()=> {
              if (notify) { setNotify(false); return; }
              setNotify(true);
              const allowed = await requestNotificationPermission();
              if (!allowed) toast(t('dday.notify_denied_msg'), '🔔');
            }
          }),
        ),
        notify && React.createElement('div', {className:'fi-row'},
          React.createElement('label', {className:'fi-label'}, t('dday.notify_time')),
          React.createElement('div', {style:{display:'flex',gap:6,flexWrap:'wrap'}},
            NOTIFY_OPTIONS.map(o => React.createElement('button', {
              key:o.v,
              style:{padding:'7px 14px',borderRadius:99,border:`1.5px solid ${notifyDays===o.v?'var(--pri)':'var(--bor)'}`,background:notifyDays===o.v?'var(--pri-light)':'none',color:notifyDays===o.v?'var(--pri)':'var(--mut)',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'},
              onClick:()=>setNotifyDays(o.v)
            }, t(o.k)))
          ),
        ),
      ),
      React.createElement('div', {className:'sheet-footer'},
        React.createElement('button', {className:'btn btn-primary', onClick:handleSave}, isEditing ? t('modal.edit_done') : t('modal.add_btn')),
      ),
    ),
  );
};

// ══════════════════════════════════════
// 모달: 습관 추가/수정
// ══════════════════════════════════════

export { DDayTab, DDayModal };
