import * as Sentry from '@sentry/react';

// 프로덕션에서만 Sentry를 초기화한다. 개발 환경에서는 console.error로 충분하다.
// VITE_SENTRY_DSN은 Vercel 환경 변수에 설정한다.
export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || import.meta.env.DEV) return;

  Sentry.init({
    dsn,
    environment: 'production',
    // 개인 일정·기분 데이터가 있으므로 PII 전송 차단
    sendDefaultPii: false,
    // 성능 모니터링은 비활성화 (크래시 리포팅만 사용)
    tracesSampleRate: 0,
  });
};

export { Sentry };
