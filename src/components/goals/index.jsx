/**
 * components/goals/index.jsx — 목표 탭과 관련 모달.
 *
 * GoalTab: 목표 목록과 진행률(getGoalProgress)을 보여주고 달성 시 축하 모달을 띄움.
 * GoalCelebrationModal: 달성 축하 화면(파티클 + 공유 카드 다운로드/공유).
 * GoalModal: 목표 생성/수정 폼(타입·기간·목표치 입력).
 */
import React, { useState, useEffect } from 'react';
import { Share } from '@capacitor/share';
import { MS_PER_DAY, CATEGORIES } from '../../constants.js';
import { useT, useDateI18n } from '../../i18n.jsx';
import { todayStr, uid, toast, vib, burstAt } from '../../utils.js';
import { useApp } from '../../store.js';
import { EmptyState } from '../common/index.jsx';
import { drawGoalShareCard, GOAL_CATEGORIES, GOAL_PERIODS, getGoalPeriodDates, getGoalProgress } from '../../helpers.js';

// GoalCelebrationModal — 목표 달성 축하 모달. 마운트 시 진동+파티클, 공유 버튼 제공.
const GoalCelebrationModal = ({ goal, onClose, onNewGoal }) => {
  const t = useT();
  const cat = GOAL_CATEGORIES.find(c => c.id === (goal?.category||'other')) || GOAL_CATEGORIES[7]; // 못 찾으면 '기타'

  // 마운트되면 햅틱 + 색종이 파티클을 180ms 간격으로 6번 터뜨려 축하 연출
  useEffect(() => {
    if (!goal) return;
    vib([30,20,30,20,60]);
    const colors = [cat.color, '#FFD700', '#FF6B6B', '#7EC8E3', '#98D8C8', '#FFB347'];
    let count = 0;
    const burst = () => {
      if (count >= 6) return;
      const x = 60 + Math.random() * (window.innerWidth - 120);
      const y = 100 + Math.random() * 200;
      burstAt(x, y, colors[count % colors.length]);
      count++;
      setTimeout(burst, 180);
    };
    burst();
  }, [goal]);

  if (!goal) return null;

  // handleShare — 공유 카드 이미지를 네이티브 공유 시트로 공유.
  // 이미지 파일 공유 불가 시 @capacitor/share 텍스트 공유로 폴백.
  const handleShare = async () => {
    const shareText = async () => {
      const text = `🎯 ${goal.title}\n${cat.emoji} ${t('gcat.' + cat.id)}\n\n✿ Harubom`;
      try { await Share.share({ title: t('goal.celebrate'), text, dialogTitle: '공유하기' }); }
      catch (_) {}
    };
    try {
      const cv = drawGoalShareCard(goal, cat, t);
      cv.toBlob(async (blob) => {
        if (!blob) { await shareText(); return; }
        const file = new File([blob], 'harubom-goal.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          navigator.share({ files: [file] }).catch(() => shareText());
        } else {
          await shareText();
        }
      }, 'image/png');
    } catch (_) { await shareText(); }
  };

  return React.createElement('div', {
    style: {
      position: 'fixed', inset: 0, zIndex: 5000,
      background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, animation: 'fadeUp .35s ease',
    },
    onClick: onClose,
  },
    React.createElement('div', {
      style: {
        background: 'var(--sur)', borderRadius: 28, padding: '32px 24px 28px',
        width: '100%', maxWidth: 340, textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        animation: 'fadeUp .35s ease',
      },
      onClick: e => e.stopPropagation(),
    },
      // 트로피 아이콘
      React.createElement('div', {
        style: {
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
          background: 'linear-gradient(135deg, ' + cat.color + ', ' + cat.color + '99)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 38, boxShadow: '0 8px 24px ' + cat.color + '44',
        }
      }, goal.emoji || '🏆'),

      // 제목
      React.createElement('div', {
        style: { fontSize: 11, fontWeight: 700, color: 'var(--mut)', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }
      }, t('goal.celebrate')),

      React.createElement('div', {
        style: { fontSize: 22, fontWeight: 900, color: 'var(--txt)', marginBottom: 6, letterSpacing: '-0.5px' }
      }, goal.title),

      React.createElement('div', {
        style: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24, flexWrap: 'wrap' }
      },
        React.createElement('span', {
          style: { background: cat.color + '22', color: cat.color, borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700 }
        }, cat.emoji + ' ' + t('gcat.' + cat.id)),
        React.createElement('span', {
          style: { background: 'var(--sur2)', color: 'var(--mut)', borderRadius: 99, padding: '4px 12px', fontSize: 12, fontWeight: 700 }
        }, goal.current + ' ' + (goal.unit || '') + t('goal.achieve_stat')),
      ),

      React.createElement('div', {
        style: {
          background: 'var(--pri-light)', borderRadius: 14, padding: '14px 18px', marginBottom: 24,
          fontSize: 14, color: 'var(--pri)', fontWeight: 700, lineHeight: 1.7,
        }
      },
        t('goal.achieve_msg'),
      ),

      React.createElement('div', {
        style: { display: 'flex', flexDirection: 'column', gap: 10 }
      },
        React.createElement('button', {
          className: 'btn btn-primary',
          onClick: () => { onClose(); setTimeout(() => onNewGoal(), 100); },
        }, t('goal.next_goal')),

        React.createElement('button', {
          className: 'btn btn-secondary',
          onClick: handleShare,
          style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
        }, t('goal.share_achieve')),

        React.createElement('button', {
          style: { background: 'none', border: 'none', color: 'var(--mut)', fontSize: 13, cursor: 'pointer', padding: 8, fontFamily: 'inherit' },
          onClick: onClose,
        }, t('modal.close')),
      ),
    ),
  );
};

// GoalTab — 목표 목록 화면. 전체/달성/진행중 필터, 전체 달성률, 자동 축하 감지를 담당.
const GoalTab = ({ onOpen }) => {
  const { state, dispatch } = useApp();
  const t = useT();
  const { fmtDate } = useDateI18n();
  const goals = state.goals || [];
  const today = todayStr();

  const [filter, setFilter] = useState('all');
  const [celebrationGoal, setCelebrationGoal] = useState(null);

  // 필터: 달성(current>=target) / 진행중 / 전체
  const filtered = filter === 'all' ? goals
    : filter === 'done' ? goals.filter(g => { const p = getGoalProgress(g, state); return p.current >= p.target; })
    : goals.filter(g => { const p = getGoalProgress(g, state); return p.current < p.target; });

  const handleDelete = (id) => {
    if (confirm(t('goal.delete.confirm'))) {
      dispatch({ type: 'DELETE_GOAL', id });
      toast(t('toast.deleted'), '🗑️');
    }
  };

  // 전체 달성률(%): 목표별 진행 비율(상한 100%)을 평균낸 값
  const totalPct = goals.length === 0 ? 0 : Math.round(
    goals.reduce((sum, g) => {
      const { current, target } = getGoalProgress(g, state);
      return sum + (target ? Math.min(current/target, 1) : 0);
    }, 0) / goals.length * 100
  );

  // 습관/이벤트 연동 목표는 사용자가 직접 입력하지 않으므로, 진행도가 목표에 도달하면 자동으로 축하 모달을 띄운다.
  useEffect(() => {
    goals.forEach(goal => {
      if (goal.type === 'count') return; // count형은 + 버튼 누를 때 별도로 축하 처리
      const { current, target } = getGoalProgress(goal, state);
      if (current >= target && !goal._celebrated) {
        // 세션당 한 번만 축하(새로고침 전까지 중복 방지)
        const key = 'celebrated_' + goal.id;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          setTimeout(() => setCelebrationGoal(goal), 300);
        }
      }
    });
  }, [goals, state.habitLogs, state.events]);

  return React.createElement('div', { className: 'pane active', id: 'pane-goal' },

    // 헤더
    React.createElement('div', { className: 'row' },
      React.createElement('h2', { style: { fontSize: 17, fontWeight: 700, color: 'var(--txt)' } }, t('goal.title')),
      React.createElement('button', { className: 'pill pill-pri', onClick: () => onOpen(null) }, t('btn.add')),
    ),

    // 전체 진행 요약 카드
    goals.length > 0 && React.createElement('div', {
      style: { background: 'linear-gradient(135deg, var(--pri), var(--sec))', borderRadius: 16, padding: '16px', marginBottom: 14, color: '#fff' }
    },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 } },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 12, opacity: .8, marginBottom: 3 } }, t('goal.overall')),
          React.createElement('div', { style: { fontSize: 28, fontWeight: 900 } }, totalPct + '%'),
        ),
        React.createElement('div', { style: { textAlign: 'right' } },
          React.createElement('div', { style: { fontSize: 22, fontWeight: 900 } },
            goals.filter(g => { const p=getGoalProgress(g,state); return p.current>=p.target; }).length
            + '/' + goals.length
          ),
          React.createElement('div', { style: { fontSize: 11, opacity: .8 } }, t('goal.done_label')),
        ),
      ),
      React.createElement('div', { style: { height: 5, background: 'rgba(255,255,255,.3)', borderRadius: 3, overflow: 'hidden' } },
        React.createElement('div', { style: { height: '100%', background: '#fff', borderRadius: 3, width: totalPct+'%', transition: 'width .6s' } })
      ),
    ),

    // 필터 칩
    React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 14 } },
      [['all',t('goal.all')],['active',t('goal.inprogress')],['done',t('goal.done')]].map(([v,l]) =>
        React.createElement('button', {
          key: v,
          style: { padding: '6px 14px', borderRadius: 99, border: '1.5px solid '+(filter===v?'var(--pri)':'var(--bor)'), background: filter===v?'var(--pri-light)':'none', color: filter===v?'var(--pri)':'var(--mut)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
          onClick: () => setFilter(v),
        }, l)
      )
    ),

    // 목표 없음
    goals.length === 0
      ? React.createElement(EmptyState, {
          type: 'stats',
          title: t('goal.empty.title'),
          desc: t('goal.empty.desc'),
          cta: t('goal.cta1'),
          onCta: () => onOpen(null),
          cta2: t('goal.cta2'),
          onCta2: () => {
            const presets = [
              {title:'매일 운동하기', type:'habit', category:'health', emoji:'🏃', target:20, period:'month'},
              {title:'책 1권 읽기', type:'count', category:'study', emoji:'📚', target:1, period:'month'},
              {title:'저축 목표', type:'count', category:'finance', emoji:'💰', target:100, period:'month'},
            ];
            onOpen(presets[Math.floor(Math.random()*presets.length)]);
          },
        })
      : filtered.length === 0
        ? React.createElement('div', { style: { textAlign: 'center', padding: '40px 0', color: 'var(--mut)', fontSize: 14 } }, t('goal.no_filter'))
        : filtered.map(goal => {
            const cat = GOAL_CATEGORIES.find(c => c.id === (goal.category||'other')) || GOAL_CATEGORIES[7];
            const { current, target } = getGoalProgress(goal, state);
            const pct = target ? Math.min(Math.round(current/target*100), 100) : 0;
            const isDone = current >= target;
            const { start, end } = goal.customEnd
              ? { start: goal.startDate, end: goal.customEnd }
              : getGoalPeriodDates(goal.period);
            const daysLeft = Math.max(0, Math.round((new Date(end+'T00:00:00') - new Date(today+'T00:00:00')) / MS_PER_DAY));
            const periodLabel = t('gperiod.' + goal.period);

            return React.createElement('div', {
              key: goal.id,
              className: 'fade-up',
              style: { background: 'var(--sur)', borderRadius: 18, padding: '16px', marginBottom: 12, boxShadow: '0 2px 12px rgba(0,0,0,.06)', border: isDone ? '2px solid '+cat.color : '1.5px solid var(--bor)' }
            },
              // 상단: 카테고리 + 제목 + 액션
              React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 } },
                React.createElement('div', {
                  style: { width: 42, height: 42, borderRadius: 12, background: cat.color+'22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }
                }, goal.emoji || cat.emoji),
                React.createElement('div', { style: { flex: 1, minWidth: 0 } },
                  React.createElement('div', { style: { fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 3 } }, goal.title),
                  React.createElement('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' } },
                    React.createElement('span', {
                      style: { fontSize: 10, fontWeight: 700, background: cat.color+'22', color: cat.color, borderRadius: 99, padding: '2px 8px' }
                    }, cat.emoji+' '+t('gcat.' + cat.id)),
                    React.createElement('span', {
                      style: { fontSize: 10, color: 'var(--mut)', background: 'var(--sur2)', borderRadius: 99, padding: '2px 8px' }
                    }, periodLabel),
                    isDone && React.createElement('span', {
                      style: { fontSize: 10, fontWeight: 700, background: cat.color, color: '#fff', borderRadius: 99, padding: '2px 8px' }
                    }, t('goal.celebrate_label')),
                  ),
                ),
                React.createElement('div', { style: { display: 'flex', gap: 4, flexShrink: 0 } },
                  React.createElement('button', { className: 'ev-act-btn', onClick: () => onOpen(goal) }, '✏️'),
                  React.createElement('button', { className: 'ev-act-btn', onClick: () => handleDelete(goal.id) }, '🗑️'),
                ),
              ),

              // 진행 바
              React.createElement('div', { style: { marginBottom: 8 } },
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 } },
                  React.createElement('span', { style: { fontSize: 13, fontWeight: 700, color: 'var(--txt)' } },
                    current + ' / ' + target + (goal.unit ? ' ' + goal.unit : '')
                  ),
                  React.createElement('span', { style: { fontSize: 14, fontWeight: 900, color: isDone ? cat.color : 'var(--pri)' } }, pct+'%'),
                ),
                React.createElement('div', { style: { height: 8, background: 'var(--sur2)', borderRadius: 4, overflow: 'hidden' } },
                  React.createElement('div', {
                    style: { height: '100%', background: isDone ? cat.color : 'var(--pri)', borderRadius: 4, width: pct+'%', transition: 'width .5s ease' }
                  })
                ),
              ),

              // 연결 현황 배지
              (goal.type === 'habit' && goal.habitId || goal.type === 'event' && goal.eventCategory) && React.createElement('div', {
                style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 }
              },
                React.createElement('span', { style: { fontSize: 11, color: 'var(--mut)', fontWeight: 600 } }, t('goal.linked') + ':'),
                goal.type === 'habit' && (() => {
                  const h = state.habits.find(h => h.id === goal.habitId);
                  return h ? React.createElement('span', {
                    style: { fontSize: 11, background: '#3DBFA022', color: '#3DBFA0', borderRadius: 99, padding: '2px 9px', fontWeight: 700 }
                  }, h.emoji + ' ' + h.name) : null;
                })(),
                goal.type === 'event' && goal.eventCategory && React.createElement('span', {
                  style: { fontSize: 11, background: 'var(--pri-light)', color: 'var(--pri)', borderRadius: 99, padding: '2px 9px', fontWeight: 700 }
                }, (() => {
                  const c = CATEGORIES.find(c => c.id === goal.eventCategory);
                  return c ? c.emoji + ' ' + t('cat.' + c.id) : goal.eventCategory;
                })()),
              ),

              // 하단: 날짜 + 수동 업데이트 (count 타입)
              React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 } },
                React.createElement('span', { style: { fontSize: 11, color: 'var(--mut)' } },
                  fmtDate(start) + ' ~ ' + fmtDate(end) + (daysLeft > 0 ? ' · D-' + daysLeft : daysLeft === 0 ? ' · ' + t('goal.deadline_today') : ' · ' + t('goal.deadline_over'))
                ),
                goal.type === 'count' && React.createElement('div', { style: { display: 'flex', gap: 6, alignItems: 'center' } },
                  React.createElement('button', {
                    style: { width: 28, height: 28, borderRadius: '50%', border: '1.5px solid var(--bor)', background: 'none', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mut)' },
                    onClick: () => { if (current > 0) { dispatch({ type: 'UPDATE_GOAL_PROGRESS', id: goal.id, value: current-1 }); vib(15); } }
                  }, '−'),
                  React.createElement('button', {
                    style: { width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--pri)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 },
                    onClick: () => {
                      dispatch({ type: 'UPDATE_GOAL_PROGRESS', id: goal.id, value: current+1 });
                      vib(25);
                      if (current+1 >= target) {
                        setTimeout(() => setCelebrationGoal({...goal, current: current+1}), 200);
                      }
                    }
                  }, '+'),
                ),
              ),

              // 메모
              goal.memo && React.createElement('div', {
                style: { marginTop: 8, fontSize: 12, color: 'var(--mut)', background: 'var(--sur2)', borderRadius: 8, padding: '6px 10px' }
              }, '💬 ' + goal.memo),
            );
          }),

    // 달성 축하 모달
    celebrationGoal && React.createElement(GoalCelebrationModal, {
      goal: celebrationGoal,
      onClose: () => setCelebrationGoal(null),
      onNewGoal: () => onOpen(null),
    }),
  );
};

// GoalModal — 목표 생성/수정 폼. type(count/habit/event)에 따라 입력 필드가 달라진다.
const GoalModal = ({ goal, onClose, onSave }) => {
  const { state } = useApp();
  const t = useT();
  const isEditing = !!goal?.id;
  const [title, setTitle] = useState(goal?.title || '');
  const [category, setCategory] = useState(goal?.category || 'health');
  const [emoji, setEmoji] = useState(goal?.emoji || '🎯');
  const [type, setType] = useState(goal?.type || 'count');
  const [target, setTarget] = useState(goal?.target || 10);
  const [unit, setUnit] = useState(goal?.unit || '');
  const [period, setPeriod] = useState(goal?.period || 'month');
  const [habitId, setHabitId] = useState(goal?.habitId || '');
  const [eventCategory, setEventCategory] = useState(goal?.eventCategory || '');
  const [customEnd, setCustomEnd] = useState(goal?.customEnd || '');
  const [memo, setMemo] = useState(goal?.memo || '');

  const EMOJIS = ['🎯','🏆','💪','📚','🏃','💰','🌱','🔥','⭐','🚀','🧘','📝','🎸','✈️','💡'];

  // 저장: 이름/목표치 검증 후, 기간 프리셋 또는 커스텀 종료일로 날짜 범위를 잡아 저장.
  const handleSave = () => {
    if (!title.trim()) { toast(t('goal.name_req'), '⚠️'); return; }
    if (!target || target <= 0) { toast(t('goal.target_req'), '⚠️'); return; }
    const dates = period === 'custom' ? { startDate: todayStr(), customEnd } : getGoalPeriodDates(period);
    onSave({
      id: goal?.id || uid(),
      title: title.trim(), category, emoji, type,
      target: Number(target), unit, period,
      habitId: type === 'habit' ? habitId : '',
      eventCategory: type === 'event' ? eventCategory : '',
      current: goal?.current || 0,
      startDate: dates.start || dates.startDate,
      customEnd: period === 'custom' ? customEnd : '',
      memo,
      createdAt: goal?.createdAt || Date.now(),
    }, isEditing ? 'edit' : 'add');
    vib(40);
  };

  const selCat = GOAL_CATEGORIES.find(c => c.id === category) || GOAL_CATEGORIES[0];

  return React.createElement('div', { className: 'overlay open', onClick: onClose },
    React.createElement('div', { className: 'sheet', onClick: e => e.stopPropagation() },
      React.createElement('div', { className: 'sheet-handle' }),
      React.createElement('div', { className: 'sheet-header' },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement('div', { className: 'sheet-title' }, isEditing ? t('goal.modal.edit') : t('goal.modal.add')),
          React.createElement('button', { style: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--mut)' }, onClick: onClose }, '✕'),
        ),
      ),
      React.createElement('div', { className: 'sheet-body' },

        React.createElement('div', { className: 'fi-row' },
          React.createElement('label', { className: 'fi-label' }, t('goal.name_label')),
          React.createElement('input', { className: 'fi mb8', type: 'text', value: title, onChange: e => setTitle(e.target.value), placeholder: t('goal.name.ph'), autoFocus: true }),
        ),

        React.createElement('div', { className: 'fi-row' },
          React.createElement('label', { className: 'fi-label' }, t('goal.emoji_label')),
          React.createElement('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
            EMOJIS.map(e => React.createElement('span', {
              key: e,
              style: { fontSize: 22, cursor: 'pointer', padding: 4, borderRadius: 8, background: emoji===e?'var(--pri-light)':'none', border: '2px solid '+(emoji===e?'var(--pri)':'transparent') },
              onClick: () => setEmoji(e),
            }, e))
          ),
        ),

        React.createElement('div', { className: 'fi-row' },
          React.createElement('label', { className: 'fi-label' }, t('goal.type_label')),
          React.createElement('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap' } },
            GOAL_CATEGORIES.map(c => React.createElement('button', {
              key: c.id,
              style: { padding: '5px 10px', borderRadius: 99, border: '1.5px solid '+(category===c.id?c.color:'var(--bor)'), background: category===c.id?c.color+'22':'none', color: category===c.id?c.color:'var(--mut)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
              onClick: () => setCategory(c.id),
            }, c.emoji+' '+t('gcat.' + c.id)))),
        ),

        React.createElement('div', { className: 'fi-row' },
          React.createElement('label', { className: 'fi-label' }, t('goal.type_label')),
          React.createElement('div', { style: { display: 'flex', gap: 6 } },
            [['count','goal.type.count'],['habit','goal.type.habit'],['event','goal.type.event']].map(([v,k]) =>
              React.createElement('button', {
                key: v,
                style: { flex: 1, padding: '8px 6px', borderRadius: 10, border: '1.5px solid '+(type===v?'var(--pri)':'var(--bor)'), background: type===v?'var(--pri-light)':'none', color: type===v?'var(--pri)':'var(--mut)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
                onClick: () => setType(v),
              }, t(k))
            )
          ),
        ),

        type === 'habit' && React.createElement('div', { className: 'fi-row' },
          React.createElement('label', { className: 'fi-label' }, t('goal.habit_link')),
          React.createElement('select', { className: 'fi', value: habitId, onChange: e => setHabitId(e.target.value) },
            React.createElement('option', { value: '' }, t('goal.habit.ph')),
            (state.habits||[]).map(h => React.createElement('option', { key: h.id, value: h.id }, h.emoji+' '+h.name))
          ),
        ),

        type === 'event' && React.createElement('div', { className: 'fi-row' },
          React.createElement('label', { className: 'fi-label' }, t('goal.event_cat')),
          React.createElement('select', { className: 'fi', value: eventCategory, onChange: e => setEventCategory(e.target.value) },
            React.createElement('option', { value: '' }, t('goal.all_events')),
            CATEGORIES.map(c => React.createElement('option', { key: c.id, value: c.id }, c.emoji+' '+t('cat.' + c.id)))
          ),
        ),

        React.createElement('div', { className: 'fi-row' },
          React.createElement('label', { className: 'fi-label' }, t('goal.target_label')),
          React.createElement('div', { className: 'fi-2col' },
            React.createElement('input', { className: 'fi', type: 'number', min: 1, value: target, onChange: e => setTarget(e.target.value), placeholder: '10' }),
            React.createElement('input', { className: 'fi', type: 'text', value: unit, onChange: e => setUnit(e.target.value), placeholder: t('goal.unit_ph') }),
          ),
        ),

        React.createElement('div', { className: 'fi-row' },
          React.createElement('label', { className: 'fi-label' }, t('goal.period_label')),
          React.createElement('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap' } },
            GOAL_PERIODS.map(p => React.createElement('button', {
              key: p.id,
              style: { padding: '6px 12px', borderRadius: 99, border: '1.5px solid '+(period===p.id?'var(--pri)':'var(--bor)'), background: period===p.id?'var(--pri-light)':'none', color: period===p.id?'var(--pri)':'var(--mut)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
              onClick: () => setPeriod(p.id),
            }, t('gperiod.' + p.id)))
          ),
        ),

        period === 'custom' && React.createElement('div', { className: 'fi-row' },
          React.createElement('label', { className: 'fi-label' }, t('goal.end_label')),
          React.createElement('input', { className: 'fi', type: 'date', value: customEnd, onChange: e => setCustomEnd(e.target.value) }),
        ),

        React.createElement('div', { className: 'fi-row' },
          React.createElement('textarea', { className: 'fi', value: memo, onChange: e => setMemo(e.target.value), placeholder: t('goal.memo.ph'), rows: 2, style: { resize: 'none' } }),
        ),
      ),
      React.createElement('div', { className: 'sheet-footer' },
        React.createElement('button', { className: 'btn btn-primary', onClick: handleSave }, isEditing ? t('modal.edit_done') : t('modal.create')),
      ),
    ),
  );
};

// ══════════════════════════════════════
// 주간 리포트 컴포넌트
// ══════════════════════════════════════

export { GoalCelebrationModal, GoalTab, GoalModal };
