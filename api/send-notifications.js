const admin = require('firebase-admin');

// Firebase Admin 초기화 (싱글톤)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const messaging = admin.messaging();

// KST 기준 오늘 날짜 (YYYY-MM-DD)
function todayKST() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 언어별 알림 메시지 템플릿
const NOTIF_MESSAGES = {
  ko: {
    both:    (ev, done, total) => `오늘 일정 ${ev}개, 습관 ${done}/${total} 완료했어요 ✨`,
    evOnly:  (ev)              => `오늘 일정 ${ev}개가 기다리고 있어요 📅`,
    habOnly: (done, total)     => `오늘 습관 ${done}/${total} 달성했어요 💪`,
    default:                      '오늘 하루도 하루봄과 함께해요 🌸',
  },
  en: {
    both:    (ev, done, total) => `${ev} event${ev > 1 ? 's' : ''} & habits ${done}/${total} done today ✨`,
    evOnly:  (ev)              => `${ev} event${ev > 1 ? 's' : ''} waiting for you today 📅`,
    habOnly: (done, total)     => `Habits ${done}/${total} completed today 💪`,
    default:                      'Have a wonderful day with Harubom 🌸',
  },
  zh: {
    both:    (ev, done, total) => `今天有${ev}个日程，习惯完成${done}/${total} ✨`,
    evOnly:  (ev)              => `今天有${ev}个日程在等你 📅`,
    habOnly: (done, total)     => `今天习惯完成${done}/${total} 💪`,
    default:                      '今天也和하루봄一起加油吧 🌸',
  },
  ja: {
    both:    (ev, done, total) => `今日の予定${ev}件、習慣${done}/${total}完了 ✨`,
    evOnly:  (ev)              => `今日の予定が${ev}件あります 📅`,
    habOnly: (done, total)     => `今日の習慣${done}/${total}達成 💪`,
    default:                      '今日も하루봄と一緒に過ごしましょう 🌸',
  },
};

// 알림 본문 생성 — data.lang 필드로 언어 결정, 없으면 한국어 폴백
function buildBody(data, today) {
  const lang = NOTIF_MESSAGES[data.lang] ? data.lang : 'ko';
  const m = NOTIF_MESSAGES[lang];

  const events = (data.events?.[today] || []).filter(e => !e.done);
  const habits = data.habits || [];
  const habitLogs = data.habitLogs?.[today] || {};
  const habDone = habits.filter(h => habitLogs[h.id]).length;
  const habTotal = habits.length;

  if (events.length > 0 && habTotal > 0) return m.both(events.length, habDone, habTotal);
  if (events.length > 0) return m.evOnly(events.length);
  if (habTotal > 0) return m.habOnly(habDone, habTotal);
  return m.default;
}

const PAGE_SIZE = 500; // Firestore 페이지 크기 = FCM sendEach 최대 배치 크기

module.exports = async (req, res) => {
  // Vercel cron 시크릿 검증
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = todayKST();
  let sent = 0, failed = 0, skipped = 0;

  try {
    let lastDoc = null;

    // 커서 기반 페이지네이션 — 한 번에 PAGE_SIZE명씩 처리해 메모리 급증과 타임아웃을 방지
    while (true) {
      let query = db.collection('users').orderBy('__name__').limit(PAGE_SIZE);
      if (lastDoc) query = query.startAfter(lastDoc);

      const snap = await query.get();
      if (snap.empty) break;
      lastDoc = snap.docs[snap.docs.length - 1];

      // 알림 대상 필터링 및 개인화 메시지 빌드
      const messages = [];
      const tokenToDocId = new Map();

      snap.docs.forEach(userDoc => {
        const data = userDoc.data();
        if (!data.notifEnabled || !data.fcmToken) { skipped++; return; }

        messages.push({
          token: data.fcmToken,
          notification: { title: '✿ 하루봄', body: buildBody(data, today) },
          webpush: {
            notification: {
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-96.png',
              vibrate: [200, 100, 200],
            },
            fcmOptions: { link: '/' },
          },
        });
        tokenToDocId.set(data.fcmToken, userDoc.id);
      });

      if (messages.length > 0) {
        // sendEach — 최대 500개 메시지를 FCM에 한 번에 전송 (개별 send × N 대비 네트워크 왕복 절감)
        const batchResult = await messaging.sendEach(messages);

        // 만료 토큰 정리 (결과 배열을 순회해 실패 원인 확인)
        const cleanupTasks = [];
        batchResult.responses.forEach((resp, i) => {
          if (resp.success) {
            sent++;
          } else {
            failed++;
            const code = resp.error?.code;
            if (
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token'
            ) {
              const docId = tokenToDocId.get(messages[i].token);
              if (docId) {
                cleanupTasks.push(
                  db.collection('users').doc(docId)
                    .update({ fcmToken: null, notifEnabled: false })
                    .catch(() => {})
                );
              }
            }
          }
        });
        await Promise.all(cleanupTasks);
      }

      if (snap.docs.length < PAGE_SIZE) break; // 마지막 페이지
    }

    res.json({ ok: true, today, sent, failed, skipped });
  } catch (e) {
    console.error('send-notifications error:', e);
    res.status(500).json({ error: e.message });
  }
};
