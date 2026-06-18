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

// 알림 본문 생성
function buildBody(data, today) {
  const events = (data.events?.[today] || []).filter(e => !e.done);
  const habits = data.habits || [];
  const habitLogs = data.habitLogs?.[today] || {};
  const habDone = habits.filter(h => habitLogs[h.id]).length;
  const habTotal = habits.length;

  if (events.length > 0 && habTotal > 0) {
    return `오늘 일정 ${events.length}개, 습관 ${habDone}/${habTotal} 완료했어요 ✨`;
  }
  if (events.length > 0) {
    return `오늘 일정 ${events.length}개가 기다리고 있어요 📅`;
  }
  if (habTotal > 0) {
    return `오늘 습관 ${habDone}/${habTotal} 달성했어요 💪`;
  }
  return '오늘 하루도 하루봄과 함께해요 🌸';
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
