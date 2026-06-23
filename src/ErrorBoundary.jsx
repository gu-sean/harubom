import React from 'react';
import { Sentry } from './sentry.js';

// React 에러 경계는 반드시 클래스 컴포넌트로 작성해야 한다.
// (함수 컴포넌트에서는 componentDidCatch / getDerivedStateFromError를 쓸 수 없음)
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[하루봄 에러]', error, info.componentStack);
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info.componentStack } },
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const err = this.state.error;

    return React.createElement('div', {
      style: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100dvh', padding: '32px 24px',
        background: 'var(--bg, #fff)', textAlign: 'center', gap: 16,
      }
    },
      React.createElement('div', { style: { fontSize: 52 } }, '🌸'),
      React.createElement('div', {
        style: { fontSize: 18, fontWeight: 800, color: 'var(--txt, #1a1a1a)' }
      }, '앗, 문제가 생겼어요'),
      React.createElement('div', {
        style: { fontSize: 14, color: 'var(--mut, #888)', lineHeight: 1.6, maxWidth: 280 }
      }, '데이터는 안전하게 저장되어 있어요.\n아래 버튼을 눌러 다시 시작해 보세요.'),

      // 에러 상세는 개발 환경에서만 노출
      import.meta.env.DEV && err && React.createElement('pre', {
        style: {
          fontSize: 11, color: '#c0392b', background: '#fff5f5',
          borderRadius: 8, padding: '10px 14px', maxWidth: '90vw',
          overflowX: 'auto', textAlign: 'left', whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }
      }, err.message),

      React.createElement('button', {
        onClick: () => window.location.reload(),
        style: {
          marginTop: 8, padding: '14px 36px', borderRadius: 99,
          background: 'var(--pri, #F5604A)', color: '#fff',
          border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }
      }, '앱 다시 시작하기'),
    );
  }
}

export default ErrorBoundary;
