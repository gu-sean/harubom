/**
 * components/account/index.jsx — 계정(로그인/회원가입/백업·복원) 모달.
 *
 * 로그인 전: 이메일/비밀번호로 Firebase 인증(로그인·가입 토글).
 * 로그인 후: 클라우드 백업/복원 버튼과 로그아웃. 실제 동기화는 상위 onCloudSync에 위임.
 */
import React, { useState } from 'react';
import { useT } from '../../i18n.jsx';
import { toast } from '../../utils.js';

// AccountModal — 로그인 여부에 따라 인증 폼 또는 계정/동기화 화면을 렌더.
const AccountModal = ({ onClose, user, onCloudSync }) => {
  const t = useT();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [syncing, setSyncing] = useState(false);
  // 이메일 로그인 또는 회원가입(isSignUp). Firebase auth 에러 코드를 사용자용 메시지로 매핑해 토스트.
  const signInEmail = async () => {
    if (!window._FB?.enabled) { toast(t('account.firebase_disabled'),'ℹ️'); return; }
    if (!email||!pw) { toast(t('account.email_ph')+' / '+t('account.pw_ph'),'⚠️'); return; }
    try {
      const { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = window._FB;
      if (isSignUp) {
        if (pw.length < 6) { toast(t('account.pw_short'),'⚠️'); return; }
        await createUserWithEmailAndPassword(auth, email, pw);
        toast(t('account.signup_done'),'✅');
      } else {
        await signInWithEmailAndPassword(auth, email, pw);
      }
      onClose();
    } catch(e) {
      const errMap = {
        'auth/user-not-found':      t('account.err.user_not_found'),
        'auth/wrong-password':      t('account.err.wrong_pw'),
        'auth/invalid-credential':  t('account.err.invalid_credential'),
        'auth/invalid-email':       t('account.err.invalid_email'),
        'auth/email-already-in-use':t('account.err.email_in_use'),
        'auth/weak-password':       t('account.err.weak_pw'),
        'auth/too-many-requests':   t('account.err.too_many_req'),
        'auth/network-request-failed': t('account.err.network'),
        'auth/popup-blocked':       t('account.err.popup_blocked'),
        'auth/unauthorized-domain': t('account.err.unauth_domain'),
      };
      const msg = errMap[e.code] || e.message || t('account.err.default');
      toast(msg,'⚠️');
    }
  };

  const signOut = async () => {
    if (!window._FB?.auth) return;
    await window._FB.signOut(window._FB.auth);
    toast(t('toast.logged_out'));
    onClose();
  };

  // handleSync — direction 'up'(백업)/'down'(복원). 동기화 동안 버튼 비활성화 표시.
  const handleSync = async (direction) => {
    setSyncing(true);
    await onCloudSync(direction);
    setSyncing(false);
  };

  const avatar = user ? (user.displayName||user.email||'?')[0].toUpperCase() : '?';

  return React.createElement('div', {className:'overlay open', onClick:onClose},
    React.createElement('div', {className:'sheet', onClick:e=>e.stopPropagation()},
      React.createElement('div', {className:'sheet-handle'}),
      React.createElement('div', {className:'sheet-header'},
        React.createElement('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between'}},
          React.createElement('div', {className:'sheet-title'}, t('account.title')),
          React.createElement('button', {style:{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--mut)'}, onClick:onClose}, '✕'),
        ),
      ),
      React.createElement('div', {className:'sheet-body'},
        user
          ? React.createElement(React.Fragment, null,
              React.createElement('div', {className:'account-avatar'}, avatar),
              React.createElement('div', {style:{textAlign:'center',marginBottom:20}},
                React.createElement('div', {style:{fontSize:16,fontWeight:800,color:'var(--txt)'}, }, user.displayName||t('account.user_default')),
                React.createElement('div', {style:{fontSize:12,color:'var(--mut)',marginTop:2}}, user.email),
              ),
              React.createElement('div', {style:{display:'flex',gap:8,marginBottom:16}},
                React.createElement('button', {className:'btn btn-secondary', style:{flex:1}, onClick:()=>handleSync('up'), disabled:syncing}, syncing?t('account.syncing'):t('account.backup')),
                React.createElement('button', {className:'btn btn-secondary', style:{flex:1}, onClick:()=>handleSync('down'), disabled:syncing}, syncing?t('account.syncing'):t('account.restore')),
              ),
              React.createElement('button', {className:'btn btn-danger', onClick:signOut}, t('account.logout')),
            )
          : React.createElement(React.Fragment, null,
              React.createElement('input', {className:'fi mb8',type:'email',value:email,onChange:e=>setEmail(e.target.value),placeholder:t('account.email_ph')}),
              React.createElement('input', {className:'fi mb8',type:'password',value:pw,onChange:e=>setPw(e.target.value),placeholder:t('account.pw_ph'),autoComplete:'current-password'}),
              React.createElement('div', {style:{display:'flex',gap:8}},
                React.createElement('button', {className:'btn btn-primary', style:{flex:1}, onClick:signInEmail}, isSignUp?t('account.signup'):t('account.login')),
                React.createElement('button', {className:'btn btn-secondary', style:{flex:1}, onClick:()=>setIsSignUp(!isSignUp)}, isSignUp?t('account.login'):t('account.signup')),
              ),
              React.createElement('div', {style:{marginTop:16,padding:12,background:'var(--sur2)',borderRadius:12,fontSize:12,color:'var(--mut)',lineHeight:1.6}},
                t('account.cloud_hint')
              ),
            ),
      ),
    ),
  );
};

// ══════════════════════════════════════
// 설정 모달
// ══════════════════════════════════════

export { AccountModal };
