/**
 * components/gallery/index.jsx — 사진 갤러리와 '사진 캘린더' 기능.
 *
 * GalleryTabUpgraded: 사진 업로드/정렬/삭제 그리드. 원본은 IndexedDB(+선택적 Firebase Storage)에 저장.
 * FullPhoto/PhotoEditor: 사진 크게 보기와 캔버스 기반 필터/회전/스티커 편집기.
 * PhotoCalendarView/Preview/Editor: 월별 대표 사진으로 꾸미는 사진 캘린더(만들기·미리보기·이미지 합성).
 * 썸네일은 makeThumbnail, 메모리 캐시는 photoSrcCache를 사용한다.
 */
import React, { useState, useEffect, useRef } from 'react';
import { getHoliday } from '../../constants.js';
import { useT, useDateI18n } from '../../i18n.jsx';
import { todayStr, uid, firstDayOfMonth, daysInMonth, toast, vib, savePhotoIDB, loadPhotoIDB, deletePhotoIDB, makeThumbnail, ensureImageDecodes, photoSrcCache } from '../../utils.js';
import { getEventsForDate, useApp } from '../../store.js';
import { EmptyState } from '../common/index.jsx';
import { useDragSort } from '../../hooks.jsx';

// PhotoCalendarView — 월을 넘기며 사진 캘린더를 보고, 없으면 만들기/있으면 삭제하는 화면.
const PhotoCalendarView = ({ state, dispatch, onClose }) => {
  const t = useT();
  const { fmtYrMo } = useDateI18n();
  const today = new Date();
  const [yr, setYr]   = useState(today.getFullYear());
  const [mo, setMo]   = useState(today.getMonth());
  const [showEditor, setShowEditor] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const calId = `${yr}-${String(mo+1).padStart(2,'0')}`;
  const savedCal = (state.photoCalendars||[]).find(c => c.id === calId);

  const move = dir => {
    let nm = mo + dir, ny = yr;
    if (nm < 0) { nm = 11; ny--; }
    if (nm > 11) { nm = 0; ny++; }
    setYr(ny); setMo(nm);
    setConfirmDelete(false);
  };

  const handleDelete = () => {
    dispatch({ type: 'DELETE_PHOTO_CALENDAR', id: calId });
    setConfirmDelete(false);
    toast(t('mo.' + mo) + ' 캘린더가 삭제됐어요', '🗑️');
    vib(20);
  };

  if (showEditor) {
    return React.createElement(PhotoCalendarEditor, {
      yr, mo, state, dispatch,
      existing: savedCal,
      onSave: cal => {
        dispatch({ type: 'SAVE_PHOTO_CALENDAR', cal });
        setShowEditor(false);
        toast('캘린더가 저장됐어요 📅', '✨');
        vib(30);
      },
      onClose: () => setShowEditor(false),
    });
  }

  return React.createElement('div', {
    style: { position: 'fixed', inset: 0, zIndex: 2000, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }
  },
    // 헤더
    React.createElement('div', { style: { background: 'var(--sur)', flexShrink: 0 } },
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 0, gap: 10 }
      },
        React.createElement('button', {
          onClick: onClose,
          style: { flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: 'var(--sur2)', border: 'none', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mut)' }
        }, '✕'),
        React.createElement('div', { style: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 800, color: 'var(--txt)' } }, '📅 포토 캘린더'),
        React.createElement('div', { style: { width: 28, flexShrink: 0 } }),
      ),
      React.createElement('div', { style: { height: 16 } }),
      React.createElement('div', { style: { height: 1, background: 'var(--bor)' } }),
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 10px' }
      },
        React.createElement('button', { className: 'cal-arr', onClick: () => move(-1) }, '‹'),
        React.createElement('div', { style: { fontSize: 17, fontWeight: 900, color: 'var(--txt)' } }, fmtYrMo(yr, mo)),
        React.createElement('button', { className: 'cal-arr', onClick: () => move(1) }, '›'),
      ),
      React.createElement('div', { style: { height: 1, background: 'var(--bor)' } }),
    ),

    // 컨텐츠
    React.createElement('div', { style: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' } },
      savedCal
        ? React.createElement(React.Fragment, null,
            React.createElement(PhotoCalendarPreview, { cal: savedCal, yr, mo, state }),

            // 수정 / 삭제 버튼
            !confirmDelete && React.createElement('div', {
              style: { display: 'flex', gap: 10, padding: '16px 16px 32px' }
            },
              React.createElement('button', {
                style: {
                  flex: 1, background: 'var(--pri)', color: '#fff', border: 'none',
                  borderRadius: 14, padding: '13px', fontSize: 14, fontWeight: 800,
                  cursor: 'pointer', fontFamily: 'inherit',
                },
                onClick: () => setShowEditor(true),
              }, '✏️ 수정하기'),
              React.createElement('button', {
                style: {
                  width: 52, background: 'var(--sur2)', border: 'none',
                  borderRadius: 14, padding: '13px', fontSize: 18,
                  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                },
                onClick: () => setConfirmDelete(true),
              }, '🗑️'),
            ),

            // 삭제 확인
            confirmDelete && React.createElement('div', {
              style: { margin: '16px 16px 32px', background: '#FFF3F3', borderRadius: 14, padding: '16px', border: '1.5px solid #FFAAAA' }
            },
              React.createElement('div', { style: { fontSize: 15, fontWeight: 800, color: '#CC2222', marginBottom: 6 } },
                t('mo.' + mo) + ' 캘린더를 삭제할까요?'
              ),
              React.createElement('div', { style: { fontSize: 13, color: 'var(--mut)', marginBottom: 16, lineHeight: 1.5 } },
                '삭제하면 이 달의 꾸미기 설정이 모두 지워져요.\n사진 갤러리 원본은 유지됩니다.'
              ),
              React.createElement('div', { style: { display: 'flex', gap: 8 } },
                React.createElement('button', {
                  style: { flex: 1, background: 'var(--sur2)', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--mut)', fontFamily: 'inherit' },
                  onClick: () => setConfirmDelete(false),
                }, '취소'),
                React.createElement('button', {
                  style: { flex: 1, background: '#CC2222', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
                  onClick: handleDelete,
                }, '삭제'),
              ),
            ),
          )
        : React.createElement('div', {
            style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px 80px' }
          },
            React.createElement('div', { style: { fontSize: 56, marginBottom: 16, lineHeight: 1 } }, '📷'),
            React.createElement('div', { style: { fontSize: 16, fontWeight: 800, color: 'var(--txt)', marginBottom: 8 } }, '이 달의 포토 캘린더가 없어요'),
            React.createElement('div', { style: { fontSize: 13, color: 'var(--mut)', marginBottom: 28, lineHeight: 1.7, textAlign: 'center' } }, '갤러리 사진으로 나만의 캘린더를 꾸며보세요'),
            React.createElement('button', {
              className: 'empty-cta',
              style: { width: '100%', maxWidth: 280 },
              onClick: () => setShowEditor(true),
            }, '＋ 이번 달 캘린더 만들기'),
          ),
    ),
  );
};

// PhotoCalendarPreview — 저장된 사진 캘린더를 테마(THEME_MAP) 적용해 렌더하는 미리보기.
const PhotoCalendarPreview = ({ cal, yr, mo, state }) => {
  const t = useT();
  const { fmtYrMo, getWd } = useDateI18n();
  const fd = firstDayOfMonth(yr, mo);
  const nd = daysInMonth(yr, mo);
  const today = todayStr();
  const THEME_MAP = {
    minimal:  { bg: '#fff',     headerBg: '#F5604A', headerTxt: '#fff',  dayTxt: '#333', todayBg: '#F5604A', todayTxt: '#fff', border: '#eee' },
    dark:     { bg: '#1a1a2e',  headerBg: '#16213e', headerTxt: '#eee',  dayTxt: '#ccc', todayBg: '#F5604A', todayTxt: '#fff', border: '#333' },
    nature:   { bg: '#f0f7ee',  headerBg: '#52B69A', headerTxt: '#fff',  dayTxt: '#2d6a4f', todayBg: '#52B69A', todayTxt: '#fff', border: '#d8e8d0' },
    pastel:   { bg: '#fff0f6',  headerBg: '#FF6CAE', headerTxt: '#fff',  dayTxt: '#c9184a', todayBg: '#FF6CAE', todayTxt: '#fff', border: '#ffd6e7' },
    sky:      { bg: '#e8f4f8',  headerBg: '#4A90D9', headerTxt: '#fff',  dayTxt: '#1a5276', todayBg: '#4A90D9', todayTxt: '#fff', border: '#bee3f8' },
  };
  const theme = THEME_MAP[cal.theme || 'minimal'];
  const [loadedSrcs, setLoadedSrcs] = useState({});

  useEffect(() => {
    // 커버 사진 로드
    if (cal.coverPhotoId) {
      loadPhotoIDB(cal.coverPhotoId).then(data => {
        if (data?.edited || data?.src) {
          setLoadedSrcs(s => ({...s, cover: data.edited || data.src}));
        }
      });
    }
    // 날짜별 사진 로드
    Object.entries(cal.dayPhotos || {}).forEach(([day, pid]) => {
      loadPhotoIDB(pid).then(data => {
        if (data?.edited || data?.src) {
          setLoadedSrcs(s => ({...s, [day]: data.edited || data.src}));
        }
      });
    });
  }, [cal]);

  return React.createElement('div', {
    style: { background: theme.bg, borderRadius: 16, margin: 12, overflow: 'visible', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }
  },
    // 커버 사진
    (loadedSrcs.cover || cal.coverThumb) && React.createElement('div', {
      style: { position: 'relative', height: 200, overflow: 'hidden' }
    },
      React.createElement('img', {
        src: loadedSrcs.cover || cal.coverThumb, alt: '',
        style: { width: '100%', height: '100%', objectFit: 'cover' }
      }),
      React.createElement('div', {
        style: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.5))', display: 'flex', alignItems: 'flex-end', padding: '16px' }
      },
        React.createElement('div', { style: { color: '#fff', fontSize: 22, fontWeight: 900, textShadow: '0 2px 8px rgba(0,0,0,.5)' } },
          fmtYrMo(yr, mo)
        ),
      ),
      // 커버 위 텍스트
      cal.titleText && React.createElement('div', {
        style: { position: 'absolute', top: 14, right: 14, color: cal.titleColor || '#fff', fontSize: 16, fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,.6)' }
      }, cal.titleText),
    ),

    // 커버 없을 때 헤더
    !cal.coverPhotoId && !cal.coverThumb && React.createElement('div', {
      style: { background: theme.headerBg, padding: '20px 16px', textAlign: 'center' }
    },
      React.createElement('div', { style: { color: theme.headerTxt, fontSize: 22, fontWeight: 900 } }, fmtYrMo(yr, mo)),
      cal.titleText && React.createElement('div', { style: { color: theme.headerTxt, fontSize: 14, opacity: .85, marginTop: 4 } }, cal.titleText),
    ),

    // 요일 헤더
    React.createElement('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: theme.headerBg, padding: '6px 0' }
    },
      getWd().map((w,i) => React.createElement('div', {
        key: w,
        style: { textAlign: 'center', fontSize: 11, fontWeight: 700, color: i===0 ? '#FFB3B3' : i===6 ? '#B3D4FF' : theme.headerTxt, opacity: .9 }
      }, w))
    ),

    // 날짜 그리드
    React.createElement('div', {
      style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, background: theme.border, padding: '0' }
    },
      Array(fd).fill(null).map((_,i) => React.createElement('div', { key:'e'+i, style: { background: theme.bg, minHeight: 52 } })),
      Array.from({length: nd}, (_,i) => i+1).map(d => {
        const ds = `${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const isToday = ds === today;
        const dow = (fd + d - 1) % 7;
        const photoSrc = loadedSrcs[String(d)];
        const hasMood = !!state.moods[ds];
        const hasEvent = (getEventsForDate(state, ds)||[]).length > 0;
        const holiday = getHoliday(ds);
        return React.createElement('div', {
          key: d,
          style: { background: theme.bg, minHeight: 52, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px' }
        },
          // 날짜별 사진 배경
          photoSrc && React.createElement('img', {
            src: photoSrc, alt: '',
            style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .35 }
          }),
          // 날짜 숫자
          React.createElement('div', {
            style: {
              width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 2, zIndex: 1,
              background: isToday ? theme.todayBg : 'none',
              color: isToday ? theme.todayTxt : holiday || dow===0 ? '#F5604A' : dow===6 ? '#4A90D9' : theme.dayTxt,
              fontSize: 11, fontWeight: isToday ? 900 : 500,
            }
          }, d),
          // 기분 이모지
          hasMood && state.moods[ds]?.emoji && React.createElement('div', { style: { fontSize: 9, lineHeight: 1, zIndex: 1 } }, state.moods[ds].emoji),
          // 일정 점
          hasEvent && React.createElement('div', { style: { width: 4, height: 4, borderRadius: '50%', background: theme.todayBg, marginTop: 1, zIndex: 1 } }),
        );
      })
    ),

    // 메모
    !!(cal.memo && String(cal.memo).trim()) && React.createElement('div', {
      style: {
        padding: '14px 16px',
        fontSize: 13, fontWeight: 700, fontStyle: 'italic',
        color: theme.headerTxt,
        textAlign: 'center',
        background: theme.headerBg,
        borderRadius: '0 0 16px 16px',
        letterSpacing: '.3px',
      }
    }, '✦ ' + String(cal.memo).trim() + ' ✦'),
  );
};

// PhotoCalendarEditor — 사진 캘린더 만들기/수정. 테마·커버·날짜별 사진·제목·메모를 설정해 저장.
const PhotoCalendarEditor = ({ yr, mo, state, dispatch, existing, onSave, onClose }) => {
  const t = useT();
  const { fmtYrMo } = useDateI18n();
  const [theme, setTheme]       = useState(existing?.theme || 'minimal');
  const [coverPhotoId, setCoverPhotoId] = useState(existing?.coverPhotoId || null);
  const [coverThumb, setCoverThumb]     = useState(existing?.coverThumb || '');
  const [dayPhotos, setDayPhotos]       = useState(existing?.dayPhotos || {});
  const [titleText, setTitleText]       = useState(existing?.titleText || '');
  const [titleColor, setTitleColor]     = useState(existing?.titleColor || '#ffffff');
  const [memo, setMemo]                 = useState(existing?.memo || '');
  const [selDay, setSelDay]             = useState(null);  // 날짜 사진 선택 중인 날
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  const [pickerFor, setPickerFor]       = useState(null);  // 'cover' or day number

  const THEMES = [
    { id: 'minimal', label: '심플', color: '#F5604A' },
    { id: 'dark',    label: '다크', color: '#1a1a2e' },
    { id: 'nature',  label: '자연', color: '#52B69A' },
    { id: 'pastel',  label: '파스텔', color: '#FF6CAE' },
    { id: 'sky',     label: '하늘', color: '#4A90D9' },
  ];

  const TEXT_COLORS = ['#ffffff','#000000','#F5604A','#FFD700','#52B69A','#FF6CAE','#4A90D9'];
  const gallery = state.gallery || [];

  // 갤러리 피커에서 사진을 고르면 커버 또는 특정 날짜(pickerFor)에 배정.
  const handlePickPhoto = (photo) => {
    if (pickerFor === 'cover') {
      setCoverPhotoId(photo.id);
      setCoverThumb(photo.thumb || '');
    } else if (typeof pickerFor === 'number') {
      setDayPhotos(dp => ({...dp, [pickerFor]: photo.id}));
    }
    setShowGalleryPicker(false);
    setPickerFor(null);
  };

  const handleSave = () => {
    onSave({
      id: `${yr}-${String(mo+1).padStart(2,'0')}`,
      yr, mo, theme, coverPhotoId, coverThumb,
      dayPhotos, titleText, titleColor, memo,
      updatedAt: Date.now(),
    });
  };

  const nd = daysInMonth(yr, mo);
  const fd = firstDayOfMonth(yr, mo);

  return React.createElement('div', {
    style: { position: 'fixed', inset: 0, zIndex: 2100, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }
  },
    // 헤더
    React.createElement('div', {
      style: { background: 'var(--sur)', flexShrink: 0 }
    },
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 0, gap: 10 }
      },
        React.createElement('button', {
          style: { background: 'var(--sur2)', border: 'none', borderRadius: 16, padding: '5px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--mut)', fontFamily: 'inherit', flexShrink: 0 },
          onClick: onClose
        }, '← 뒤로'),
        React.createElement('div', { style: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 800, color: 'var(--txt)' } }, fmtYrMo(yr, mo) + ' 꾸미기'),
        React.createElement('button', {
          style: { background: 'var(--pri)', color: '#fff', border: 'none', borderRadius: 16, padding: '5px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 },
          onClick: handleSave,
        }, '저장'),
      ),
      React.createElement('div', { style: { height: 16 } }),
      React.createElement('div', { style: { height: 1, background: 'var(--bor)' } }),
    ),

    React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: '16px' } },

      // ── 커버 사진 ──
      React.createElement('div', { style: { marginBottom: 20 } },
        React.createElement('div', { className: 'fi-label', style: { marginBottom: 8 } }, '📷 커버 사진'),
        React.createElement('div', {
          style: { position: 'relative', height: 140, borderRadius: 14, overflow: 'hidden', background: 'var(--sur2)', border: '2px dashed var(--bor)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
          onClick: () => { setPickerFor('cover'); setShowGalleryPicker(true); },
        },
          coverThumb
            ? React.createElement(React.Fragment, null,
                React.createElement('img', { src: coverThumb, alt: '', style: { width: '100%', height: '100%', objectFit: 'cover' } }),
                React.createElement('div', {
                  style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                },
                  React.createElement('span', { style: { color: '#fff', fontSize: 13, fontWeight: 700 } }, '📷 변경'),
                ),
              )
            : React.createElement('div', { style: { textAlign: 'center', color: 'var(--mut)' } },
                React.createElement('div', { style: { fontSize: 32, marginBottom: 8 } }, '📷'),
                React.createElement('div', { style: { fontSize: 13, fontWeight: 700 } }, '커버 사진 선택'),
                React.createElement('div', { style: { fontSize: 11 } }, '갤러리에서 선택해요'),
              ),
        ),
        coverThumb && React.createElement('button', {
          style: { marginTop: 6, fontSize: 11, color: 'var(--mut)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
          onClick: () => { setCoverPhotoId(null); setCoverThumb(''); },
        }, '× 커버 사진 제거'),
      ),

      // ── 테마 ──
      React.createElement('div', { style: { marginBottom: 20 } },
        React.createElement('div', { className: 'fi-label', style: { marginBottom: 8 } }, '🎨 테마'),
        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          THEMES.map(t => React.createElement('button', {
            key: t.id,
            style: {
              flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 11, fontWeight: 700,
              border: '2px solid ' + (theme === t.id ? t.color : 'var(--bor)'),
              background: theme === t.id ? t.color + '22' : 'none',
              color: theme === t.id ? t.color : 'var(--mut)',
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            },
            onClick: () => setTheme(t.id),
          },
            React.createElement('div', { style: { width: 20, height: 20, borderRadius: 6, background: t.color } }),
            t.label,
          ))
        ),
      ),

      // ── 제목 텍스트 ──
      React.createElement('div', { style: { marginBottom: 20 } },
        React.createElement('div', { className: 'fi-label', style: { marginBottom: 8 } }, '✍️ 제목 텍스트 (커버 위에 표시)'),
        React.createElement('input', {
          className: 'fi', style: { marginBottom: 8 },
          value: titleText, placeholder: '예: 봄의 기억, 우리의 4월...',
          onChange: e => setTitleText(e.target.value),
        }),
        React.createElement('div', { style: { display: 'flex', gap: 6 } },
          TEXT_COLORS.map(c => React.createElement('button', {
            key: c,
            style: { width: 24, height: 24, borderRadius: '50%', background: c, border: titleColor === c ? '3px solid var(--pri)' : '2px solid var(--bor)', cursor: 'pointer', flexShrink: 0 },
            onClick: () => setTitleColor(c),
          }))
        ),
      ),

      // ── 날짜별 사진 ──
      React.createElement('div', { style: { marginBottom: 20 } },
        React.createElement('div', { className: 'fi-label', style: { marginBottom: 8 } }, '🗓️ 날짜별 사진 (원하는 날짜에 사진 배치)'),
        React.createElement('div', {
          style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, background: 'var(--bor)', padding: 1, borderRadius: 10, overflow: 'hidden' }
        },
          Array(fd).fill(null).map((_,i) => React.createElement('div', { key:'e'+i, style: { background: 'var(--sur)', minHeight: 44 } })),
          Array.from({length: nd}, (_,i) => i+1).map(d => {
            const thumb = gallery.find(p => p.id === dayPhotos[d])?.thumb;
            const today_ds = `${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dow = (fd + d - 1) % 7;
            return React.createElement('div', {
              key: d,
              style: { background: 'var(--sur)', minHeight: 44, position: 'relative', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 1px', overflow: 'hidden' },
              onClick: () => { setPickerFor(d); setShowGalleryPicker(true); },
            },
              thumb && React.createElement('img', { src: thumb, alt: '', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: .5 } }),
              React.createElement('div', {
                style: { fontSize: 11, fontWeight: 600, zIndex: 1, color: dow===0||getHoliday(today_ds) ? '#F5604A' : dow===6 ? '#4A90D9' : 'var(--txt)' }
              }, d),
              !thumb && React.createElement('div', { style: { fontSize: 14, opacity: .3 } }, '+'),
            );
          })
        ),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--mut)', marginTop: 6 } }, '날짜를 탭해서 사진을 배치해요'),
      ),

      // ── 메모 ──
      React.createElement('div', { style: { marginBottom: 20 } },
        React.createElement('div', { className: 'fi-label', style: { marginBottom: 8 } }, '💬 메모 (하단에 표시)'),
        React.createElement('input', {
          className: 'fi',
          value: memo, placeholder: '이 달의 한 줄 메모...',
          onChange: e => setMemo(e.target.value),
        }),
      ),
    ),

    // 갤러리 사진 선택 피커
    showGalleryPicker && React.createElement('div', {
      style: { position: 'absolute', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' },
      onClick: () => setShowGalleryPicker(false),
    },
      React.createElement('div', {
        style: { background: 'var(--sur)', borderRadius: '20px 20px 0 0', padding: '16px', maxHeight: '70vh', overflow: 'auto' },
        onClick: e => e.stopPropagation(),
      },
        React.createElement('div', { style: { fontSize: 14, fontWeight: 800, color: 'var(--txt)', marginBottom: 12 } },
          typeof pickerFor === 'number' ? `${pickerFor}일 사진 선택` : '커버 사진 선택'
        ),
        gallery.length === 0
          ? React.createElement('div', { style: { textAlign: 'center', padding: '40px 0', color: 'var(--mut)' } }, '갤러리에 사진이 없어요. 먼저 사진을 추가해주세요.')
          : React.createElement(React.Fragment, null,
              typeof pickerFor === 'number' && dayPhotos[pickerFor] && React.createElement('button', {
                style: { marginBottom: 12, fontSize: 12, color: '#F5604A', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
                onClick: () => { setDayPhotos(dp => { const n={...dp}; delete n[pickerFor]; return n; }); setShowGalleryPicker(false); },
              }, '× 이 날 사진 제거'),
              React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 } },
                gallery.map(p => React.createElement('div', {
                  key: p.id,
                  style: { aspectRatio: '1', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent' },
                  onClick: () => handlePickPhoto(p),
                },
                  React.createElement('img', { src: p.thumb || '', alt: '', style: { width: '100%', height: '100%', objectFit: 'cover' } })
                ))
              ),
            ),
        React.createElement('button', {
          style: { width: '100%', marginTop: 12, padding: '12px', background: 'none', border: '1px solid var(--bor)', borderRadius: 10, color: 'var(--mut)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' },
          onClick: () => setShowGalleryPicker(false),
        }, '취소'),
      ),
    ),
  );
};

// FullPhoto — 사진 전체 화면 뷰어. 핀치 줌/더블탭 줌 지원. 먼저 썸네일을 보여주고 원본을 비동기 로드.
const FullPhoto = ({ photo, onEdit }) => {
  const [src, setSrc] = React.useState(photo.thumb || ''); // 우선 썸네일로 즉시 표시
  const [loading, setLoading] = React.useState(true);
  const [scale, setScale] = React.useState(1);
  const [touching, setTouching] = React.useState(false);
  const lastDist = React.useRef(null); // 직전 두 손가락 거리(핀치 줌 비율 계산용)

  // 원본(편집본 우선)을 IndexedDB에서 불러와 교체. 실패 시 썸네일 유지.
  React.useEffect(() => {
    setLoading(true);
    loadPhotoIDB(photo.id).then(data => {
      if (data?.edited) setSrc(data.edited);
      else if (data?.src) setSrc(data.src);
      else setSrc(photo.thumb || '');
      setLoading(false);
    }).catch(() => { setSrc(photo.thumb || ''); setLoading(false); });
  }, [photo.id]);

  const onTouchStart = e => {
    if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };
  const onTouchMove = e => {
    if (e.touches.length === 2 && lastDist.current) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      // 두 손가락 거리 변화 비율만큼 확대/축소(0.5~4배로 제한)
      setScale(s => Math.min(4, Math.max(0.5, s * (d / lastDist.current))));
      lastDist.current = d;
    }
  };
  const onTouchEnd = () => { lastDist.current = null; };
  const onDblClick = () => setScale(s => s > 1 ? 1 : 2.5);

  return React.createElement('div', {
    style: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
    onTouchStart, onTouchMove, onTouchEnd, onDoubleClick: onDblClick,
  },
    loading && React.createElement('div', { style: { color: '#fff', fontSize: 13 } }, '불러오는 중...'),
    src && React.createElement('img', {
      src, alt: '',
      style: {
        maxWidth: '100%', maxHeight: '100%',
        width: '100%', height: '100%',
        objectFit: 'contain',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        transition: touching ? 'none' : 'transform .2s',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }
    }),
    onEdit && React.createElement('button', {
      style: { position: 'absolute', bottom: 16, right: 16, background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 99, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(8px)' },
      onClick: onEdit,
    }, '✏️ 편집'),
  );
};

// PhotoEditor — 캔버스 기반 사진 편집기. 필터/밝기·대비·채도/회전/자르기/스티커·텍스트를 적용해 저장.
const PhotoEditor = ({ photo, onSave, onClose }) => {
  const canvasRef = React.useRef(null);
  const cropRef = React.useRef(null);
  const [src, setSrc] = React.useState(photo.dataUrl || photo.thumb || '');
  const [loadError, setLoadError] = React.useState(false);
  const [br, setBr] = React.useState(photo.br ?? 100);
  const [co, setCo] = React.useState(photo.co ?? 100);
  const [sa, setSa] = React.useState(photo.sa ?? 100);
  const [rot, setRot] = React.useState(photo.rot ?? 0);
  const [filter, setFilter] = React.useState(photo.filter || 'none');
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('filter');
  // 크롭 상태
  const [cropMode, setCropMode] = React.useState(false);
  const [cropRatio, setCropRatio] = React.useState('free');
  // 꾸미기 상태
  const [stickers, setStickers] = React.useState([]);
  const [texts, setTexts] = React.useState([]);
  const [textInput, setTextInput] = React.useState('');
  const [textColor, setTextColor] = React.useState('#ffffff');
  const [dragItem, setDragItem] = React.useState(null);

  const FILTERS = [
    { id: 'none',      label: '원본' },
    { id: 'grayscale', label: '흑백' },
    { id: 'sepia',     label: '세피아' },
    { id: 'warm',      label: '따뜻함' },
    { id: 'cool',      label: '시원함' },
    { id: 'vivid',     label: '선명함' },
  ];

  const EDITOR_TABS = [
    { id: 'filter', label: '필터' },
    { id: 'adjust', label: '조정' },
    { id: 'crop',   label: '자르기' },
    { id: 'decor',  label: '꾸미기' },
  ];

  const CROP_RATIOS = [
    { id: 'free',  label: '자유' },
    { id: '1:1',   label: '1:1' },
    { id: '4:3',   label: '4:3' },
    { id: '16:9',  label: '16:9' },
    { id: '3:4',   label: '3:4' },
  ];

  const STICKER_LIST = ['⭐','🌸','🔥','💯','❤️','🎉','✨','😊','🌈','🦋','🍀','💫','🎵','🌙','☀️','🌊','🏆','💎','🌺','🦄'];
  const TEXT_COLORS  = ['#ffffff','#000000','#F5604A','#FFD700','#52B69A','#9B7FD4','#FF6CAE','#4A90D9'];

  // getFilterCSS — 조정값(밝기/대비/채도)에 선택한 프리셋 필터를 합쳐 CSS filter 문자열로. 미리보기/저장 공용.
  const getFilterCSS = (f, b, c, s) => {
    const base = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
    const map = {
      grayscale: 'grayscale(100%)',
      sepia:     'sepia(80%)',
      warm:      'sepia(30%) saturate(150%)',
      cool:      'hue-rotate(30deg) saturate(120%)',
      vivid:     'saturate(180%) contrast(110%)',
    };
    return map[f] ? base + ' ' + map[f] : base;
  };

  // 편집할 원본 로드. 캐시/썸네일을 임시로 쓰다가 IndexedDB 원본으로 교체하고 캐시에 보관.
  React.useEffect(() => {
    const fallback = photo.dataUrl || photoSrcCache.get(photo.id) || photo.thumb || '';
    setSrc(fallback);
    setLoadError(false);
    loadPhotoIDB(photo.id).then(data => {
      const s = data?.edited || data?.src || fallback || '';
      if (s) photoSrcCache.set(photo.id, s);
      setSrc(s);
    }).catch(() => setSrc(fallback));
  }, [photo.id, photo.dataUrl, photo.thumb]);

  // handleSave — 현재 편집 상태(필터/조정/회전/크롭/스티커)를 캔버스에 합성해 PNG로 저장.
  const handleSave = async () => {
    if (!src) {
      toast('사진을 불러온 뒤 다시 저장해주세요', '⚠️');
      return;
    }
    setSaving(true);
    try {
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = () => img.naturalWidth && img.naturalHeight ? res() : rej(new Error('이미지 크기를 읽지 못했어요'));
        img.onerror = () => rej(new Error('사진을 불러오지 못했어요'));
        if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
        img.src = src;
      });

      // 크롭 비율 계산: 지정 비율에 맞춰 긴 쪽을 가운데 기준으로 잘라낼 소스 영역(sx,sy,sw,sh)을 구한다
      let sx=0, sy=0, sw=img.naturalWidth, sh=img.naturalHeight;
      if (cropRatio !== 'free') {
        const [rw, rh] = cropRatio.split(':').map(Number);
        const targetAspect = rw / rh;
        const srcAspect = sw / sh;
        if (srcAspect > targetAspect) {
          // 원본이 더 가로로 길면 좌우를 잘라낸다
          const newW = sh * targetAspect;
          sx = (sw - newW) / 2; sw = newW;
        } else {
          // 더 세로로 길면 위아래를 잘라낸다
          const newH = sw / targetAspect;
          sy = (sh - newH) / 2; sh = newH;
        }
      }

      // 회전 처리: 90/270도면 가로·세로가 뒤바뀌므로 캔버스 크기를 맞바꾼다
      const canvas = document.createElement('canvas');
      const absRot = Math.abs(rot) % 180 === 90;
      canvas.width  = Math.max(1, Math.round(absRot ? sh : sw));
      canvas.height = Math.max(1, Math.round(absRot ? sw : sh));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('편집 캔버스를 만들지 못했어요');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = getFilterCSS(filter, br, co, sa); // 필터를 건 채로 원본을 그린다
      ctx.save();
      // 중심으로 옮겨 회전한 뒤, 자른 소스 영역을 중앙 정렬로 그린다
      ctx.translate(canvas.width/2, canvas.height/2);
      ctx.rotate(rot * Math.PI / 180);
      ctx.drawImage(img, sx, sy, sw, sh, -sw/2, -sh/2, sw, sh);
      ctx.restore();
      ctx.filter = 'none'; // 이후 스티커/텍스트엔 필터가 적용되지 않도록 해제

      // 스티커/텍스트 합성: 미리보기 화면 좌표를 실제 캔버스 크기에 맞게 스케일링해 같은 위치에 그린다
      const previewEl = document.getElementById('photo-preview-area');
      if (previewEl && (stickers.length > 0 || texts.length > 0)) {
        const rect = previewEl.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        ctx.filter = 'none';
        stickers.forEach(s => {
          ctx.font = `${s.size * scaleX}px serif`;
          ctx.fillText(s.emoji, s.x * scaleX, s.y * scaleY);
        });
        texts.forEach(t => {
          ctx.font = `bold ${t.size * scaleX}px sans-serif`;
          ctx.fillStyle = t.color;
          ctx.strokeStyle = 'rgba(0,0,0,.5)';
          ctx.lineWidth = 2 * scaleX;
          ctx.strokeText(t.text, t.x * scaleX, t.y * scaleY);
          ctx.fillText(t.text, t.x * scaleX, t.y * scaleY);
        });
      }

      // 저장 직전 안전장치: 결과를 12x12로 축소해 알파값을 검사, 완전 투명(빈 이미지)이면 저장 중단
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 12;
      sampleCanvas.height = 12;
      const sampleCtx = sampleCanvas.getContext('2d');
      sampleCtx.drawImage(canvas, 0, 0, 12, 12);
      const sample = sampleCtx.getImageData(0, 0, 12, 12).data;
      let hasPaint = false;
      for (let i = 3; i < sample.length; i += 4) { // 알파 채널만(4번째마다) 검사
        if (sample[i] > 0) { hasPaint = true; break; }
      }
      if (!hasPaint) throw new Error('사진이 비어 있어 저장하지 않았어요');

      const dataUrl = canvas.toDataURL('image/png');
      await onSave({ filter, br, co, sa, rot, dataUrl });
    } catch(e) {
      toast('편집 저장 실패: ' + e.message, '⚠️');
    }
    setSaving(false);
  };

  const imgStyle = {
    width: '100%', height: '100%',
    objectFit: 'contain',
    filter: getFilterCSS(filter, br, co, sa),
    transform: rot ? `rotate(${rot}deg)` : 'none',
    transition: 'filter .2s, transform .2s',
    display: 'block',
  };

  const btnTab = (id, label) => React.createElement('button', {
    key: id,
    style: {
      flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8,
      background: activeTab === id ? 'var(--pri)' : 'none',
      color: activeTab === id ? '#fff' : 'var(--mut)',
      fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    },
    onClick: () => setActiveTab(id),
  }, label);

  return React.createElement('div', { className: 'overlay open', style: { alignItems: 'flex-end' }, onClick: onClose },
    React.createElement('div', {
      style: { background: 'var(--sur)', borderRadius: '24px 24px 0 0', width: '100%', maxHeight: '95vh', display: 'flex', flexDirection: 'column' },
      onClick: e => e.stopPropagation(),
    },
      React.createElement('div', { className: 'sheet-handle' }),

      // 미리보기 영역 — 꾸미기 아이템 오버레이 포함
      React.createElement('div', {
        id: 'photo-preview-area',
        style: { position: 'relative', background: '#111', height: 240, flexShrink: 0, overflow: 'hidden' }
      },
        src && React.createElement('img', {
          src,
          alt: '',
          style: imgStyle,
          onLoad: () => setLoadError(false),
          onError: () => setLoadError(true),
        }),
        loadError && React.createElement('div', {
          style: {
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, textAlign: 'center', color: '#fff', background: 'rgba(0,0,0,.72)',
            fontSize: 13, lineHeight: 1.6, fontWeight: 700,
          }
        }, '사진을 불러오지 못했어요. 다른 이미지 형식으로 다시 추가해 주세요.'),

        // 스티커 오버레이
        stickers.map((s, i) => React.createElement('div', {
          key: i,
          style: {
            position: 'absolute', left: s.x, top: s.y, fontSize: s.size,
            cursor: 'move', userSelect: 'none', lineHeight: 1,
            transform: 'translate(-50%, -50%)',
          },
          onMouseDown: e => { e.preventDefault(); setDragItem({ type: 'sticker', i }); },
          onTouchStart: e => setDragItem({ type: 'sticker', i }),
          onDoubleClick: () => setStickers(st => st.filter((_,j) => j !== i)),
        }, s.emoji)),

        // 텍스트 오버레이
        texts.map((t, i) => React.createElement('div', {
          key: i,
          style: {
            position: 'absolute', left: t.x, top: t.y,
            fontSize: t.size, color: t.color, fontWeight: 900,
            textShadow: '0 1px 4px rgba(0,0,0,.8)',
            cursor: 'move', userSelect: 'none', whiteSpace: 'nowrap',
            transform: 'translate(-50%, -50%)',
          },
          onMouseDown: e => { e.preventDefault(); setDragItem({ type: 'text', i }); },
          onTouchStart: e => setDragItem({ type: 'text', i }),
          onDoubleClick: () => setTexts(tx => tx.filter((_,j) => j !== i)),
        }, t.text)),

        // 드래그 핸들러
        dragItem && React.createElement('div', {
          style: { position: 'absolute', inset: 0, zIndex: 10 },
          onMouseMove: e => {
            const rect = e.currentTarget.parentElement.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            if (dragItem.type === 'sticker') setStickers(st => st.map((s,j) => j===dragItem.i ? {...s,x,y} : s));
            else setTexts(tx => tx.map((t,j) => j===dragItem.i ? {...t,x,y} : t));
          },
          onTouchMove: e => {
            const rect = e.currentTarget.parentElement.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left, y = e.touches[0].clientY - rect.top;
            if (dragItem.type === 'sticker') setStickers(st => st.map((s,j) => j===dragItem.i ? {...s,x,y} : s));
            else setTexts(tx => tx.map((t,j) => j===dragItem.i ? {...t,x,y} : t));
          },
          onMouseUp: () => setDragItem(null),
          onTouchEnd: () => setDragItem(null),
        }),

        // 크롭 가이드라인
        cropMode && cropRatio !== 'free' && React.createElement('div', {
          style: {
            position: 'absolute', inset: 0, zIndex: 5,
            outline: '3px dashed rgba(255,255,255,.8)',
            boxShadow: 'inset 0 0 0 2000px rgba(0,0,0,.35)',
            pointerEvents: 'none',
          }
        }),
      ),

      // 탭 선택
      React.createElement('div', {
        style: { display: 'flex', padding: '8px 12px', background: 'var(--sur2)', gap: 4, flexShrink: 0 }
      },
        btnTab('filter', '🎨 필터'),
        btnTab('adjust', '⚙️ 조정'),
        btnTab('crop',   '✂️ 자르기'),
        btnTab('decor',  '✨ 꾸미기'),
      ),

      // 탭 내용
      React.createElement('div', { style: { padding: '12px 16px', overflowY: 'auto', flex: 1 } },

        // ── 필터 탭 ──
        activeTab === 'filter' && React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          FILTERS.map(f => React.createElement('button', {
            key: f.id,
            style: {
              padding: '7px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700,
              border: '1.5px solid ' + (filter === f.id ? 'var(--pri)' : 'var(--bor)'),
              background: filter === f.id ? 'var(--pri-light)' : 'none',
              color: filter === f.id ? 'var(--pri)' : 'var(--mut)',
              cursor: 'pointer', fontFamily: 'inherit',
            },
            onClick: () => setFilter(f.id),
          }, f.label))
        ),

        // ── 조정 탭 ──
        activeTab === 'adjust' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'fi-row' },
            React.createElement('label', { className: 'fi-label' }, '밝기 ' + br + '%'),
            React.createElement('input', { type: 'range', min: 20, max: 200, value: br, onChange: e => setBr(+e.target.value), style: { width: '100%' } }),
          ),
          React.createElement('div', { className: 'fi-row' },
            React.createElement('label', { className: 'fi-label' }, '대비 ' + co + '%'),
            React.createElement('input', { type: 'range', min: 20, max: 200, value: co, onChange: e => setCo(+e.target.value), style: { width: '100%' } }),
          ),
          React.createElement('div', { className: 'fi-row' },
            React.createElement('label', { className: 'fi-label' }, '채도 ' + sa + '%'),
            React.createElement('input', { type: 'range', min: 0, max: 200, value: sa, onChange: e => setSa(+e.target.value), style: { width: '100%' } }),
          ),
          React.createElement('div', { className: 'fi-row-inline' },
            React.createElement('span', { style: { fontSize: 14, color: 'var(--txt)' } }, '회전'),
            React.createElement('div', { style: { display: 'flex', gap: 6 } },
              [0, 90, 180, 270].map(r => React.createElement('button', {
                key: r,
                style: {
                  padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  border: '1.5px solid ' + (rot === r ? 'var(--pri)' : 'var(--bor)'),
                  background: rot === r ? 'var(--pri-light)' : 'none',
                  color: rot === r ? 'var(--pri)' : 'var(--mut)',
                  cursor: 'pointer', fontFamily: 'inherit',
                },
                onClick: () => setRot(r),
              }, r + '°'))
            ),
          ),
        ),

        // ── 자르기 탭 ──
        activeTab === 'crop' && React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'fi-label', style: { marginBottom: 10 } }, '비율 선택 후 저장하면 해당 비율로 잘려요'),
          React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            CROP_RATIOS.map(r => React.createElement('button', {
              key: r.id,
              style: {
                padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                border: '1.5px solid ' + (cropRatio === r.id ? 'var(--pri)' : 'var(--bor)'),
                background: cropRatio === r.id ? 'var(--pri-light)' : 'none',
                color: cropRatio === r.id ? 'var(--pri)' : 'var(--mut)',
                cursor: 'pointer', fontFamily: 'inherit',
              },
              onClick: () => { setCropRatio(r.id); setCropMode(r.id !== 'free'); },
            }, r.label))
          ),
          cropRatio !== 'free' && React.createElement('div', {
            style: { marginTop: 12, padding: '10px 14px', background: 'var(--pri-light)', borderRadius: 10, fontSize: 12, color: 'var(--pri)', fontWeight: 700 }
          }, '미리보기에 크롭 가이드가 표시돼요. 저장하면 ' + cropRatio + ' 비율로 잘려요.'),
        ),

        // ── 꾸미기 탭 ──
        activeTab === 'decor' && React.createElement(React.Fragment, null,
          // 스티커
          React.createElement('div', { className: 'fi-label', style: { marginBottom: 8 } }, '스티커 (탭해서 추가, 더블탭해서 삭제)'),
          React.createElement('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 } },
            STICKER_LIST.map(emoji => React.createElement('button', {
              key: emoji,
              style: { fontSize: 26, background: 'none', border: '1px solid var(--bor)', borderRadius: 8, padding: 4, cursor: 'pointer' },
              onClick: () => setStickers(s => [...s, { emoji, x: 100 + Math.random()*80, y: 80 + Math.random()*80, size: 36 }]),
            }, emoji))
          ),
          // 텍스트
          React.createElement('div', { className: 'fi-label', style: { marginBottom: 8 } }, '텍스트'),
          React.createElement('div', { style: { display: 'flex', gap: 6, marginBottom: 8 } },
            TEXT_COLORS.map(c => React.createElement('button', {
              key: c,
              style: { width: 24, height: 24, borderRadius: '50%', background: c, border: textColor === c ? '3px solid var(--pri)' : '2px solid var(--bor)', cursor: 'pointer', flexShrink: 0 },
              onClick: () => setTextColor(c),
            }))
          ),
          React.createElement('div', { style: { display: 'flex', gap: 8 } },
            React.createElement('input', {
              className: 'fi', style: { flex: 1 },
              value: textInput, placeholder: '텍스트 입력',
              onChange: e => setTextInput(e.target.value),
            }),
            React.createElement('button', {
              className: 'btn btn-primary', style: { padding: '0 14px', fontSize: 13 },
              onClick: () => {
                if (!textInput.trim()) return;
                setTexts(t => [...t, { text: textInput.trim(), x: 100, y: 80, size: 24, color: textColor }]);
                setTextInput('');
              },
            }, '추가'),
          ),
          (stickers.length > 0 || texts.length > 0) && React.createElement('button', {
            style: { marginTop: 10, fontSize: 12, color: 'var(--mut)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
            onClick: () => { setStickers([]); setTexts([]); },
          }, '모두 지우기'),
        ),

      ),

      // 저장 버튼
      React.createElement('div', { className: 'sheet-footer' },
        React.createElement('button', {
          className: 'btn btn-primary',
          onClick: handleSave,
          disabled: saving,
        }, saving ? '저장 중...' : '✨ 편집 저장'),
      ),
    ),
  );
};


// GalleryTabUpgraded — 갤러리 메인. 사진 추가/정렬(드래그)/크게 보기/편집/삭제와 사진 캘린더 진입.
const GalleryTabUpgraded = () => {
  const { state, dispatch } = useApp();
  const t = useT();
  const [fullView, setFullView] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const fileRef = useRef(null);
  const camRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const dragHandlers = useDragSort(state.gallery, (gallery) => dispatch({ type: 'REORDER_GALLERY', gallery }));

  // openEditor — 편집기를 열기 전에 원본 dataUrl을 확보(캐시 우선, 없으면 IndexedDB에서).
  const openEditor = async (photo) => {
    const cached = photoSrcCache.get(photo.id);
    if (cached) {
      setEditTarget({ ...photo, dataUrl: cached });
      return;
    }
    try {
      const stored = await loadPhotoIDB(photo.id);
      const dataUrl = stored?.edited || stored?.src || photo.thumb || '';
      if (dataUrl) photoSrcCache.set(photo.id, dataUrl);
      setEditTarget({ ...photo, dataUrl });
    } catch (_) {
      setEditTarget({ ...photo, dataUrl: photo.thumb || '' });
    }
  };

  // handleFiles — 선택한 이미지들을 한 장씩 처리: 디코딩 검증 → 썸네일 생성 → IndexedDB 저장 → 상태 추가.
  const handleFiles = async (files) => {
    setPickerOpen(false);
    const arr = Array.from(files);
    toast(`${arr.length}장 처리 중...`, '🖼');
    for (const f of arr) {
      await new Promise(res => {
        const r = new FileReader();
        r.onload = async e => {
          const id = uid();
          const dataUrl = e.target.result;
          try {
            await ensureImageDecodes(dataUrl); // 깨진/미지원 이미지는 여기서 걸러 건너뜀
          } catch (err) {
            toast(err.message + '. JPG/PNG/WebP 사진으로 다시 추가해 주세요.', '⚠️');
            res();
            return;
          }
          const thumb = await makeThumbnail(dataUrl);
          photoSrcCache.set(id, dataUrl);
          await savePhotoIDB(id, dataUrl, null);
          dispatch({ type: 'ADD_PHOTO', photo: { id, thumb, storageKey: null, filter: 'none', br: 100, co: 100, sa: 100, rot: 0, stk: '', uploaded: false, edited: false } });
          res();
        };
        r.onerror = () => { toast('사진 파일을 읽지 못했어요', '⚠️'); res(); };
        r.readAsDataURL(f);
      });
    }
    toast(`${arr.length}장 추가됐어요`, '🖼');
    vib(40);
  };

  // handleDelete — 확인 후 IndexedDB 원본과 상태에서 함께 제거.
  const handleDelete = async (id) => {
    if (confirm(t('photo.delete.confirm'))) {
      await deletePhotoIDB(id);
      dispatch({ type: 'DELETE_PHOTO', id });
      toast(t('toast.deleted'), '🗑️');
    }
  };

  const { gallery } = state;

  return React.createElement('div', { className: 'pane active', id: 'pane-gallery' },
    React.createElement('div', { className: 'row' },
      React.createElement('h2', { style: { fontSize: 17, fontWeight: 700, color: 'var(--txt)' } }, '🖼 갤러리'),
      React.createElement('div', { style: { display: 'flex', gap: 6 } },
        React.createElement('button', { className: 'pill pill-pri', style: { fontSize: 12 }, onClick: () => setPickerOpen(true) }, '＋ 추가'),
      ),
    ),

    pickerOpen && React.createElement('div', { className: 'center-overlay open', onClick: () => setPickerOpen(false) },
      React.createElement('div', { className: 'modal-card', onClick: e => e.stopPropagation() },
        React.createElement('div', { className: 'modal-ico' }, '📸'),
        React.createElement('div', { className: 'modal-ttl' }, '사진 추가'),
        React.createElement('div', { className: 'modal-btns', style: { flexDirection: 'column', gap: 8 } },
          React.createElement('button', { className: 'btn btn-secondary', onClick: () => { setPickerOpen(false); setTimeout(() => fileRef.current?.click(), 100); } }, '🖼 갤러리에서 가져오기'),
          React.createElement('button', { className: 'btn btn-secondary', onClick: () => { setPickerOpen(false); setTimeout(() => camRef.current?.click(), 100); } }, '📷 카메라로 찍기'),
          React.createElement('button', { className: 'btn', style: { background: 'none', color: 'var(--mut)' }, onClick: () => setPickerOpen(false) }, '취소'),
        ),
      )
    ),

    React.createElement('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' }, ref: fileRef, onChange: e => handleFiles(e.target.files) }),
    React.createElement('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' }, ref: camRef, onChange: e => handleFiles(e.target.files) }),

    gallery.length === 0
      ? React.createElement(EmptyState, {
          type: 'gallery',
          title: '소중한 순간을 담아보세요',
          desc: '갤러리에서 사진을 가져오거나 카메라로 직접 찍어서 나만의 포토북을 만들어보세요.',
          cta: '🖼 갤러리에서 가져오기',
          onCta: () => fileRef.current?.click(),
          cta2: '📷 카메라로 찍기',
          onCta2: () => camRef.current?.click(),
        })
      : React.createElement(React.Fragment, null,
          React.createElement('div', { style: { fontSize: 11, color: 'var(--mut)', marginBottom: 8 } }, '길게 드래그해서 순서를 바꿀 수 있어요'),
          React.createElement('div', { className: 'g-grid' },
            gallery.map((p, idx) => React.createElement('div', {
              key: p.id,
              className: 'g-cell',
              ...dragHandlers(idx),
            },
              React.createElement('img', { src: p.thumb || '', alt: '', loading: 'lazy' }),
              React.createElement('div', { className: 'g-acts' },
                React.createElement('button', { className: 'g-btn', onClick: () => setFullView(idx) }, '🔍'),
                React.createElement('button', { className: 'g-btn', onClick: () => openEditor(p) }, '✏️'),
                React.createElement('button', { className: 'g-btn', onClick: () => handleDelete(p.id) }, '🗑️'),
              ),
            ))
          )
        ),

    React.createElement('div', { className: `gallery-full${fullView === null ? ' closed' : ''}` },
      React.createElement('div', { className: 'gf-header' },
        React.createElement('button', { className: 'gf-close', onClick: () => setFullView(null) }, '✕'),
        React.createElement('span', { className: 'gf-counter' }, fullView !== null ? `${fullView + 1} / ${gallery.length}` : ''),
      ),
      fullView !== null && gallery[fullView] && React.createElement(FullPhoto, {
        photo: gallery[fullView],
        onEdit: () => { openEditor(gallery[fullView]); setFullView(null); },
      }),
    ),

    editTarget && React.createElement(PhotoEditor, {
      photo: editTarget,
      onSave: async (edited) => {
        const id = editTarget.id;
        const stored = await loadPhotoIDB(id);
        const originalSrc = stored?.src || editTarget.dataUrl || editTarget.thumb || edited.dataUrl;
        await savePhotoIDB(id, originalSrc, edited.dataUrl);
        photoSrcCache.set(id, edited.dataUrl);
        const thumb = await makeThumbnail(edited.dataUrl);
        const { dataUrl, ...editMeta } = edited;
        const { dataUrl: _oldDataUrl, ...targetMeta } = editTarget;
        dispatch({ type: 'UPDATE_PHOTO', photo: { ...targetMeta, ...editMeta, thumb, edited: true, uploaded: false } });
        setEditTarget(null);
        toast(t('toast.photo_saved'), '✨');
      },
      onClose: () => setEditTarget(null),
    }),

  );
};

// ══ 앱 오버라이드 ══
// 기존 App 대신 업그레이드된 버전으로 교체

export { PhotoCalendarView, PhotoCalendarPreview, PhotoCalendarEditor, FullPhoto, PhotoEditor, GalleryTabUpgraded };
