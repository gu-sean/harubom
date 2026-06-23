/**
 * main.jsx — 앱 진입점.
 *
 * #root 엘리먼트에 React 루트를 마운트한다.
 * Firebase 초기화는 이 모듈이 실행되기 전에 index.html의 모듈 스크립트에서
 * 수행되어 window._FB / window._currentUser 로 노출된다.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { initSentry } from './sentry.js';

initSentry();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  React.createElement(ErrorBoundary, null,
    React.createElement(App)
  )
);
