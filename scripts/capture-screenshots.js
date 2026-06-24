/**
 * capture-screenshots.js — 스토어 제출용 스크린샷 캡처.
 * 실행 전 `npm run build`로 dist/ 를 생성해야 한다.
 * 출력: store-assets/onestore/actual_0X_*.png (6장, 720×1280)
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..', 'dist');
const outDir = path.join(__dirname, '..', 'store-assets', 'onestore');
fs.mkdirSync(outDir, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
};

function fmt(date) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}`;
}
function plus(days) {
  const d = new Date(); d.setDate(d.getDate() + days); return fmt(d);
}
function dataImage(color, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720"><rect width="720" height="720" fill="${color}"/><text x="360" y="380" font-family="sans-serif" font-size="48" font-weight="800" fill="white" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createDemoData() {
  const today = fmt(new Date());
  return {
    calView: 'month',
    events: {
      [today]: [
        { id:'e1', title:'정보처리기사 기출 풀이', startDate:today, endDate:today, allDay:false, startTime:'10:00', endTime:'11:00', color:'#F5604A', category:'study', priority:'high', done:false, pinned:true },
        { id:'e2', title:'오답노트 복습', startDate:today, endDate:today, allDay:false, startTime:'20:30', endTime:'21:00', color:'#52B69A', category:'study', priority:'normal', done:true },
      ],
      [plus(1)]: [
        { id:'e3', title:'시험장 준비물 체크', startDate:plus(1), endDate:plus(1), allDay:true, color:'#4A90D9', category:'study', priority:'high', done:false },
      ],
    },
    ddays: [
      { id:'d1', label:'정보처리기사 필기', date:plus(21), emoji:'🎓', color:'#F5604A', notify:false },
      { id:'d2', label:'모의고사 최종 점검', date:plus(7), emoji:'📝', color:'#9B7FD4', notify:false },
    ],
    habits: [
      { id:'h1', name:'핵심 용어 암기', emoji:'📘', color:'#4A90D9' },
      { id:'h2', name:'기출문제 30분 풀이', emoji:'✍️', color:'#F5604A' },
      { id:'h3', name:'오답노트 정리', emoji:'📝', color:'#52B69A' },
    ],
    habitLogs: Object.fromEntries(
      Array.from({length:14}, (_,i) => [plus(-i), { h1: i%2===0, h2: i<10, h3: i<7 }])
    ),
    moods: { [today]: { emoji:'😊', note:'기출 흐름이 좋아진 날' } },
    gallery: [
      { id:'p1', thumb:dataImage('#F5604A','오답노트'), filter:'none', br:100, co:100, sa:100, rot:0 },
      { id:'p2', thumb:dataImage('#7EC8E3','기출 풀이'), filter:'none', br:100, co:100, sa:100, rot:0 },
      { id:'p3', thumb:dataImage('#52B69A','암기 카드'), filter:'none', br:100, co:100, sa:100, rot:0 },
      { id:'p4', thumb:dataImage('#9B7FD4','시험 준비'), filter:'none', br:100, co:100, sa:100, rot:0 },
    ],
    goals: [
      { id:'g1', title:'필기시험 합격 준비', category:'study', emoji:'🎓', type:'count', target:5, current:4, unit:'과목', period:'week', startDate:today },
      { id:'g2', title:'매일 기출 풀이 루틴', category:'habit', emoji:'📘', type:'count', target:5, current:3, unit:'회', period:'week', startDate:today },
    ],
    photoCalendars: [], repeatExceptions: {}, evCatFilter:'all', evColorFilter:'all', recentTags:[],
  };
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '') pathname = '/index.html';
    const file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) {
        fs.readFile(path.join(root, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); res.end(); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(d2);
        });
        return;
      }
      const ext = path.extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

async function waitForApp(page) {
  await page.waitForSelector('.app, #root > *', { timeout: 20000 });
  await page.waitForTimeout(2500);
  const splash = page.locator('#splash');
  await splash.evaluate(el => { el.style.display='none'; }).catch(() => {});
}

async function capture(page, file) {
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
  console.log('  ✓', file);
}

(async () => {
  console.log('Starting server...');
  const local = await startServer();
  console.log('Server:', local.url);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 720, height: 1280 },
    deviceScaleFactor: 1,
    isMobile: true,
  });

  page.on('pageerror', e => console.error('page error:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console error:', m.text()); });

  await page.addInitScript(data => {
    localStorage.setItem('harubom_onboarded', '1');
    localStorage.setItem('nhr_data', JSON.stringify(data));
    localStorage.setItem('nhr_notif_dismissed', '1');
  }, createDemoData());

  console.log('Loading app...');
  await page.goto(local.url, { waitUntil: 'domcontentloaded' });
  await waitForApp(page);

  console.log('Capturing screenshots...');

  await capture(page, 'actual_01_calendar_720x1280.png');

  await page.locator('.bottom-nav .nb').nth(1).click();
  await page.waitForTimeout(600);
  await capture(page, 'actual_02_dday_720x1280.png');

  await page.locator('.bottom-nav .nb').nth(2).click();
  await page.waitForTimeout(600);
  await capture(page, 'actual_03_goal_720x1280.png');

  await page.locator('.bottom-nav .nb').nth(3).click();
  await page.waitForTimeout(600);
  await capture(page, 'actual_04_habit_720x1280.png');

  await page.locator('.bottom-nav .nb').nth(4).click();
  await page.waitForTimeout(600);
  await capture(page, 'actual_05_stats_720x1280.png');

  await page.locator('.bottom-nav .nb').nth(0).click();
  await page.waitForTimeout(300);
  const hdrBtns = page.locator('.hdr-btn');
  const count = await hdrBtns.count();
  if (count >= 3) await hdrBtns.nth(count - 3).click();
  await page.waitForTimeout(600);
  await capture(page, 'actual_06_gallery_720x1280.png');

  await browser.close();
  local.server.close();

  console.log(`\nAll screenshots saved to: ${outDir}`);
})();
