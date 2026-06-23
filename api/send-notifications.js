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

module.exports = async (req, res) => {
  // Vercel cron 시크릿 검증
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = todayKST();
  let sent = 0, failed = 0, skipped = 0;

  try {
    const usersSnap = await db.collection('users').get();

    const tasks = usersSnap.docs.map(async (userDoc) => {
      const data = userDoc.data();
      if (!data.notifEnabled || !data.fcmToken) { skipped++; return; }

      const body = buildBody(data, today);
      try {
        await messaging.send({
          token: data.fcmToken,
          notification: { title: '✿ 하루봄', body },
          webpush: {
            notification: {
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-96.png',
              vibrate: [200, 100, 200],
            },
            fcmOptions: { link: '/' },
          },
        });
        sent++;
      } catch (err) {
        failed++;
        // 만료된 토큰은 Firestore에서 제거
        if (
          err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token'
        ) {
          await db.collection('users').doc(userDoc.id).update({
            fcmToken: null,
            notifEnabled: false,
          }).catch(() => {});
        }
      }
    });

    await Promise.all(tasks);
    res.json({ ok: true, today, sent, failed, skipped });
  } catch (e) {
    console.error('send-notifications error:', e);
    res.status(500).json({ error: e.message });
  }
};
