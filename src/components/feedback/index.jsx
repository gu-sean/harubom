/**
 * components/feedback/index.jsx — 문의/피드백 탭과 관리자용 유저 관리 탭.
 *
 * FeedbackTab: Firestore 'feedbacks' 컬렉션에 문의 작성/조회. 관리자는 전체 글과 답변 작성 가능.
 * AdminUserTab: 관리자가 가입 유저 목록을 보고 삭제하는 화면.
 * 두 탭 모두 window._FB(Firestore)와 window._currentUser에 의존한다.
 */
import React, { useState, useEffect } from 'react';
import { ADMIN_UID } from '../../constants.js';
import { useLang, useT } from '../../i18n.jsx';
import { toast } from '../../utils.js';
import { useApp } from '../../store.js';

// FeedbackTab — 문의 작성 폼 + 내 문의(관리자는 전체) 목록. 관리자는 각 글에 답변을 달 수 있다.
const FeedbackTab = () => {
  const { state } = useApp();
  const t = useT();
  const lang = useLang();
  const user = window._currentUser;
  const isAdmin = user?.uid === ADMIN_UID; // 관리자 UID 정확 일치 (Firestore 규칙과 동일 기준)
  const [posts, setPosts]       = useState([]);
  const [title, setTitle]       = useState('');
  const [body, setBody]         = useState('');
  const [category, setCategory] = useState('bug');
  const [loading, setLoading]   = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [replyMap, setReplyMap] = useState({});
  const [replyingId, setReplyingId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const CATS = [
    {id:'bug',      lbl: t('feedback.cat.bug')},
    {id:'feature',  lbl: t('feedback.cat.feature')},
    {id:'question', lbl: t('feedback.cat.question')},
    {id:'other',    lbl: t('feedback.cat.other')},
  ];

  // loadFeedbacks — 문의 목록 조회. 관리자는 최근 100건 전체, 일반 유저는 본인 글 20건.
  const loadFeedbacks = async () => {
    if (!window._FB?.enabled || !user) return;
    setFetching(true);
    try {
      const { fs, collection, query, where, orderBy, getDocs, limit } = window._FB;
      const q = isAdmin
        ? query(collection(fs, 'feedbacks'), orderBy('ts', 'desc'), limit(100))
        : query(collection(fs, 'feedbacks'), where('uid', '==', user.uid), orderBy('ts', 'desc'), limit(20));
      const snap = await getDocs(q);
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) {
      console.error('피드백 로드 실패', e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { loadFeedbacks(); }, [user?.uid]);

  // handleSubmit — 새 문의를 'feedbacks'에 추가(제목/본문 길이 제한). 로그인 필요.
  const handleSubmit = async () => {
    if (!title.trim()) { toast(t('feedback.title_req'),'⚠️'); return; }
    if (!body.trim())  { toast(t('feedback.body_req'),'⚠️'); return; }
    if (!user) { toast(t('feedback.login_req'),'⚠️'); return; }
    if (!window._FB?.enabled) { toast(t('feedback.network_err'),'⚠️'); return; }
    setLoading(true);
    try {
      const { fs, collection, addDoc } = window._FB;
      await addDoc(collection(fs, 'feedbacks'), {
        uid:      user.uid,
        email:    user.email || '',
        name:     user.displayName || '익명',
        category,
        title:    title.trim().slice(0, 100),
        body:     body.trim().slice(0, 1000),
        ts:       Date.now(),
        status:   'pending',
        reply:    '',
      });
      toast(t('feedback.submitted'),'✅');
      setTitle(''); setBody(''); setCategory('bug'); setShowForm(false);
      loadFeedbacks();
    } catch(e) {
      toast('전송 실패: ' + e.message,'⚠️');
    } finally {
      setLoading(false);
    }
  };

  // handleSaveReply — (관리자) 해당 문의에 답변 저장 + 상태를 'done'으로 변경.
  const handleSaveReply = async (postId) => {
    const replyText = (replyMap[postId] || '').trim();
    if (!replyText) { toast('답변 내용을 입력해주세요','⚠️'); return; }
    if (!window._FB?.enabled) return;
    setSavingId(postId);
    try {
      const { fs, doc, updateDoc } = window._FB;
      await updateDoc(doc(fs, 'feedbacks', postId), {
        reply: replyText,
        status: 'done',
        repliedAt: Date.now(),
      });
      toast('답변이 저장됐어요 ✅','✅');
      setReplyingId(null);
      setReplyMap(m => { const n = {...m}; delete n[postId]; return n; });
      loadFeedbacks();
    } catch(e) {
      toast('저장 실패: ' + e.message,'⚠️');
    } finally {
      setSavingId(null);
    }
  };

  const STATUS = { pending: t('feedback.status.pending'), reviewing: t('feedback.status.pending'), done: t('feedback.status.done'), rejected: t('feedback.status.rejected') };
  const STATUS_COL = { pending:'var(--mut)', reviewing:'#f0a500', done:'#52B69A', rejected:'#ccc' };

  const pendingCount = posts.filter(p => p.status === 'pending' || p.status === 'reviewing').length;
  const doneCount    = posts.filter(p => p.status === 'done' || p.status === 'rejected').length;

  return React.createElement('div', { className: 'pane active', id: 'pane-feedback' },

    // 헤더
    React.createElement('div', { className: 'section-header', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18 } },
      React.createElement('div', { className: 'section-title', style: { whiteSpace: 'nowrap', flexShrink: 0 } },
        isAdmin ? t('feedback.admin_title') : t('feedback.title')
      ),
      isAdmin
        ? React.createElement('button', {
            style: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--mut)', lineHeight: 1 },
            onClick: loadFeedbacks, title: '새로고침',
          }, '↻')
        : React.createElement('button', {
            className: 'btn btn-primary', style: { padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0, width: 'auto' },
            onClick: () => setShowForm(s => !s),
          }, showForm ? '✕ ' + t('btn.cancel') : '✎ ' + t('feedback.write')),
    ),

    // 관리자 대시보드
    isAdmin && React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 20 } },
      React.createElement('div', { style: { flex: 1, background: 'var(--sur2)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 26, fontWeight: 900, color: '#f0a500', lineHeight: 1 } }, pendingCount),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--mut)', marginTop: 6, fontWeight: 600 } }, t('feedback.pending')),
      ),
      React.createElement('div', { style: { flex: 1, background: 'var(--sur2)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 26, fontWeight: 900, color: '#52B69A', lineHeight: 1 } }, doneCount),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--mut)', marginTop: 6, fontWeight: 600 } }, t('feedback.done_count')),
      ),
      React.createElement('div', { style: { flex: 1, background: 'var(--sur2)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 26, fontWeight: 900, color: 'var(--pri)', lineHeight: 1 } }, posts.length),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--mut)', marginTop: 6, fontWeight: 600 } }, t('stats.total')),
      ),
    ),

    // 작성 폼 (일반 유저만)
    !isAdmin && showForm && React.createElement('div', { className: 'card mb11' },
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 } },
        CATS.map(c => React.createElement('button', {
          key: c.id,
          onClick: () => setCategory(c.id),
          style: {
            padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1.5px solid ' + (category===c.id ? 'var(--pri)' : 'var(--bor)'),
            background: category===c.id ? 'var(--pri)' : 'none',
            color: category===c.id ? '#fff' : 'var(--mut)',
          },
        }, c.lbl))
      ),
      React.createElement('input', {
        className: 'fi', placeholder: t('feedback.title.ph'),
        value: title, onChange: e => setTitle(e.target.value.slice(0,100)),
        style: { marginBottom: 10 },
      }),
      React.createElement('textarea', {
        className: 'fi', placeholder: t('feedback.body.ph'),
        value: body, rows: 5,
        onChange: e => setBody(e.target.value.slice(0,1000)),
        style: { resize: 'none', marginBottom: 12 },
      }),
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('span', { style: { fontSize: 11, color: 'var(--mut)' } }, body.length + '/1000'),
        React.createElement('button', {
          className: 'btn btn-primary',
          onClick: handleSubmit,
          disabled: loading,
          style: { padding: '10px 24px' },
        }, loading ? t('feedback.sending') : t('feedback.send')),
      ),
    ),

    // 로그인 안내
    !user && React.createElement('div', { style: { textAlign: 'center', padding: '60px 20px', color: 'var(--mut)' } },
      React.createElement('div', { style: { fontSize: 48, marginBottom: 16 } }, '🔒'),
      React.createElement('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 8 } }, t('feedback.login_req')),
      React.createElement('div', { style: { fontSize: 13 } }, t('feedback.login_desc')),
    ),

    // 빈 상태 안내 (일반 유저)
    user && !isAdmin && !showForm && posts.length === 0 && !fetching && React.createElement('div', {
      style: { textAlign: 'center', padding: '40px 20px', color: 'var(--mut)' }
    },
      React.createElement('div', { style: { fontSize: 48, marginBottom: 16 } }, '💌'),
      React.createElement('div', { style: { fontSize: 15, fontWeight: 700, marginBottom: 8 } }, t('feedback.placeholder_title')),
      React.createElement('div', { style: { fontSize: 13, lineHeight: 1.6 } }, t('feedback.placeholder_desc')),
    ),

    // 빈 상태 안내 (관리자)
    isAdmin && posts.length === 0 && !fetching && React.createElement('div', {
      style: { textAlign: 'center', padding: '40px 20px', color: 'var(--mut)' }
    },
      React.createElement('div', { style: { fontSize: 48, marginBottom: 16 } }, '✅'),
      React.createElement('div', { style: { fontSize: 15, fontWeight: 700 } }, t('feedback.admin_no_posts')),
    ),

    // 피드백 목록
    user && posts.length > 0 && React.createElement('div', null,
      !isAdmin && React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: 'var(--mut)', marginBottom: 12, padding: '0 4px' } },
        t('feedback.my') + ' (' + posts.length + t('feedback.count_suffix') + ')'
      ),
      posts.map(p => React.createElement('div', { key: p.id, className: 'card mb11' },

        // 상태 + 카테고리 + 날짜
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 } },
          React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
            React.createElement('span', {
              style: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: STATUS_COL[p.status] || 'var(--mut)', color: '#fff' }
            }, STATUS[p.status] || '검토중'),
            React.createElement('span', { style: { fontSize: 11, color: 'var(--mut)' } },
              CATS.find(c=>c.id===p.category)?.lbl || p.category
            ),
          ),
          React.createElement('span', { style: { fontSize: 11, color: 'var(--mut)' } },
            new Date(p.ts).toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang === 'zh' ? 'zh-CN' : lang === 'ja' ? 'ja-JP' : 'en-US')
          ),
        ),

        // 관리자: 작성자 정보
        isAdmin && React.createElement('div', {
          style: { fontSize: 12, color: 'var(--mut)', marginBottom: 8, padding: '6px 10px', background: 'var(--sur2)', borderRadius: 8, display: 'flex', gap: 6, alignItems: 'center' }
        },
          React.createElement('span', { style: { fontWeight: 700, color: 'var(--txt)' } }, p.name || '익명'),
          React.createElement('span', null, '·'),
          React.createElement('span', null, p.email || ''),
        ),

        // 제목 + 내용
        React.createElement('div', { style: { fontWeight: 700, fontSize: 14, marginBottom: 6, color: 'var(--txt)' } }, p.title),
        React.createElement('div', { style: { fontSize: 13, color: 'var(--mut)', lineHeight: 1.5 } }, p.body),

        // 기존 답변 표시
        p.reply && React.createElement('div', {
          style: { background: 'var(--pri-light)', borderRadius: 10, padding: '10px 12px', marginTop: 10 }
        },
          React.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--pri)', marginBottom: 6 } }, '💌 ' + t('feedback.reply')),
          React.createElement('div', { style: { fontSize: 13, color: 'var(--txt)', lineHeight: 1.5 } }, p.reply),
        ),

        // 관리자 답변 UI
        isAdmin && React.createElement('div', { style: { marginTop: 12 } },
          replyingId === p.id
            ? React.createElement(React.Fragment, null,
                React.createElement('textarea', {
                  className: 'fi',
                  placeholder: '답변을 입력해주세요...',
                  value: replyMap[p.id] || '',
                  rows: 3,
                  onChange: e => setReplyMap(m => ({...m, [p.id]: e.target.value})),
                  style: { resize: 'none', marginBottom: 8, fontSize: 13 },
                }),
                React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
                  React.createElement('button', {
                    style: { background: 'var(--sur2)', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: 'var(--mut)', fontFamily: 'inherit' },
                    onClick: () => setReplyingId(null),
                  }, '취소'),
                  React.createElement('button', {
                    style: { background: 'var(--pri)', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
                    onClick: () => handleSaveReply(p.id),
                    disabled: savingId === p.id,
                  }, savingId === p.id ? '저장 중...' : '답변 저장'),
                ),
              )
            : React.createElement('button', {
                style: {
                  background: p.reply ? 'var(--sur2)' : 'var(--pri)',
                  color: p.reply ? 'var(--mut)' : '#fff',
                  border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                },
                onClick: () => {
                  setReplyMap(m => ({...m, [p.id]: p.reply || ''}));
                  setReplyingId(p.id);
                },
              }, p.reply ? '✏️ 답변 수정' : '💬 답변 달기'),
        ),
      )),
    ),

    fetching && React.createElement('div', { style: { textAlign: 'center', padding: 40, color: 'var(--mut)' } }, t('feedback.loading')),
  );
};

// AdminUserTab — (관리자 전용) 'users' 컬렉션의 가입 유저 목록을 보고 데이터 삭제.
const AdminUserTab = () => {
  const [users, setUsers]         = useState([]);
  const [fetching, setFetching]   = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const adminUid = window._currentUser?.uid;

  // loadUsers — 전체 유저를 불러와 최근 업데이트 순으로 정렬.
  const loadUsers = async () => {
    if (!window._FB?.enabled) return;
    setFetching(true);
    try {
      const { fs, collection, getDocs } = window._FB;
      const snap = await getDocs(collection(fs, 'users'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')); // 최근 활동 유저가 위로
      setUsers(list);
    } catch(e) {
      console.error('유저 로드 실패:', e.message);
      toast('유저 로드 실패: ' + e.message, '⚠️');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  // handleDeleteUser — 해당 유저의 Firestore 문서(앱 데이터)를 삭제. 인증 계정 자체는 건드리지 않음.
  const handleDeleteUser = async (userId) => {
    if (!window._FB?.enabled) return;
    setDeletingId(userId);
    try {
      const { fs, doc, deleteDoc } = window._FB;
      await deleteDoc(doc(fs, 'users', userId));
      toast('앱 데이터가 삭제됐어요 🗑️', '✅');
      setConfirmId(null);
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch(e) {
      toast('삭제 실패: ' + e.message, '⚠️');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = users.filter(u => {
    if (!u.updatedAt) return false;
    return Date.now() - new Date(u.updatedAt).getTime() < 7 * 24 * 3600 * 1000;
  }).length;

  return React.createElement('div', { className: 'pane active', id: 'pane-admin-users' },

    React.createElement('div', { className: 'section-header', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18 } },
      React.createElement('div', { className: 'section-title' }, '👥 유저 관리'),
      React.createElement('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
        React.createElement('span', { style: { fontSize: 13, color: 'var(--mut)', fontWeight: 600 } }, users.length + '명'),
        React.createElement('button', {
          style: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--mut)', lineHeight: 1 },
          onClick: loadUsers, title: '새로고침',
        }, '↻'),
      ),
    ),

    // 대시보드
    React.createElement('div', { style: { display: 'flex', gap: 10, marginBottom: 20 } },
      React.createElement('div', { style: { flex: 1, background: 'var(--sur2)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 26, fontWeight: 900, color: 'var(--pri)', lineHeight: 1 } }, users.length),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--mut)', marginTop: 6, fontWeight: 600 } }, '전체 유저'),
      ),
      React.createElement('div', { style: { flex: 1, background: 'var(--sur2)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 26, fontWeight: 900, color: '#52B69A', lineHeight: 1 } }, activeCount),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--mut)', marginTop: 6, fontWeight: 600 } }, '7일 내 활성'),
      ),
      React.createElement('div', { style: { flex: 1, background: 'var(--sur2)', borderRadius: 14, padding: '14px 10px', textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: 26, fontWeight: 900, color: '#f0a500', lineHeight: 1 } }, users.length - activeCount),
        React.createElement('div', { style: { fontSize: 11, color: 'var(--mut)', marginTop: 6, fontWeight: 600 } }, '비활성'),
      ),
    ),

    // 삭제 안내
    React.createElement('div', {
      style: { fontSize: 11, color: 'var(--mut)', background: 'var(--sur2)', borderRadius: 10, padding: '8px 12px', marginBottom: 16, lineHeight: 1.5 }
    }, '⚠️ 데이터 삭제는 해당 유저의 앱 데이터(일정·습관·목표 등)를 삭제합니다. Firebase 로그인 계정은 유지됩니다.'),

    fetching && React.createElement('div', { style: { textAlign: 'center', padding: 40, color: 'var(--mut)' } }, '불러오는 중...'),

    !fetching && users.length === 0 && React.createElement('div', { style: { textAlign: 'center', padding: '40px 20px', color: 'var(--mut)' } },
      React.createElement('div', { style: { fontSize: 48, marginBottom: 16 } }, '👤'),
      React.createElement('div', { style: { fontSize: 15, fontWeight: 700 } }, '등록된 유저가 없어요'),
    ),

    users.length > 0 && React.createElement('div', null,
      users.map((u, i) => {
        const evCount    = Object.values(u.events || {}).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);
        const habitCount = (u.habits  || []).length;
        const goalCount  = (u.goals   || []).length;
        const galleryCount = (u.gallery || []).length;
        const lastSync   = u.updatedAt ? new Date(u.updatedAt).toLocaleDateString('ko-KR') : '-';
        const isRecent   = u.updatedAt && Date.now() - new Date(u.updatedAt).getTime() < 7 * 24 * 3600 * 1000;
        const nameInitial = (u.displayName || u.email || '?')[0].toUpperCase();
        const isSelf     = u.id === adminUid;
        const isConfirming = confirmId === u.id;
        const isDeleting   = deletingId === u.id;

        return React.createElement('div', { key: u.id, className: 'card mb11' },

          // 유저 정보 행
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 } },
            React.createElement('div', { style: { display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 } },
              React.createElement('div', {
                style: {
                  width: 36, height: 36, borderRadius: '50%',
                  background: isSelf ? 'var(--mut)' : 'var(--pri)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 900, flexShrink: 0,
                }
              }, nameInitial),
              React.createElement('div', { style: { minWidth: 0 } },
                React.createElement('div', { style: { fontSize: 14, fontWeight: 700, color: 'var(--txt)' } },
                  (u.displayName || '이름 없음') + (isSelf ? ' (관리자)' : '')
                ),
                React.createElement('div', { style: { fontSize: 12, color: 'var(--mut)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                  u.email || u.id.slice(0, 16) + '...'
                ),
              ),
            ),
            React.createElement('div', { style: { textAlign: 'right', flexShrink: 0, marginLeft: 8 } },
              React.createElement('div', {
                style: {
                  fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, display: 'inline-block',
                  background: isRecent ? '#52B69A22' : 'var(--sur2)',
                  color: isRecent ? '#52B69A' : 'var(--mut)',
                }
              }, isRecent ? '활성' : '비활성'),
              React.createElement('div', { style: { fontSize: 11, color: 'var(--mut)', marginTop: 3 } }, lastSync),
            ),
          ),

          // 데이터 통계
          React.createElement('div', { style: { display: 'flex', borderTop: '1px solid var(--bor)', paddingTop: 10, marginBottom: 12 } },
            [
              { lbl: '일정', val: evCount },
              { lbl: '습관', val: habitCount },
              { lbl: '목표', val: goalCount },
              { lbl: '갤러리', val: galleryCount },
            ].map(s => React.createElement('div', { key: s.lbl, style: { flex: 1, textAlign: 'center' } },
              React.createElement('div', { style: { fontSize: 15, fontWeight: 800, color: 'var(--txt)' } }, s.val),
              React.createElement('div', { style: { fontSize: 10, color: 'var(--mut)', marginTop: 2 } }, s.lbl),
            ))
          ),

          // 삭제 버튼 / 확인 UI
          !isSelf && !isConfirming && React.createElement('button', {
            style: {
              width: '100%', background: 'none', border: '1.5px solid var(--bor)',
              borderRadius: 10, padding: '8px', fontSize: 12, fontWeight: 700,
              color: 'var(--mut)', cursor: 'pointer', fontFamily: 'inherit',
            },
            onClick: () => setConfirmId(u.id),
          }, '🗑️ 데이터 삭제'),

          !isSelf && isConfirming && React.createElement('div', {
            style: { background: '#FFF3F3', borderRadius: 10, padding: '12px', border: '1.5px solid #FFAAAA' }
          },
            React.createElement('div', { style: { fontSize: 13, fontWeight: 700, color: '#CC2222', marginBottom: 4 } },
              '정말 삭제하시겠어요?'
            ),
            React.createElement('div', { style: { fontSize: 12, color: 'var(--mut)', marginBottom: 12, lineHeight: 1.4 } },
              (u.displayName || u.email || '이 유저') + '의 모든 앱 데이터가 삭제됩니다.'
            ),
            React.createElement('div', { style: { display: 'flex', gap: 8 } },
              React.createElement('button', {
                style: {
                  flex: 1, background: 'var(--sur2)', border: 'none', borderRadius: 10,
                  padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  color: 'var(--mut)', fontFamily: 'inherit',
                },
                onClick: () => setConfirmId(null),
              }, '취소'),
              React.createElement('button', {
                style: {
                  flex: 1, background: '#CC2222', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '9px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                },
                onClick: () => handleDeleteUser(u.id),
                disabled: isDeleting,
              }, isDeleting ? '삭제 중...' : '삭제 확인'),
            ),
          ),

          isSelf && React.createElement('div', {
            style: { fontSize: 11, color: 'var(--mut)', textAlign: 'center', padding: '4px 0' }
          }, '관리자 계정은 삭제할 수 없어요'),
        );
      })
    ),
  );
};

// ══════════════════════════════════════
// 통계 탭
// ══════════════════════════════════════

// ── 8주 추세 차트 ──

export { FeedbackTab, AdminUserTab };
