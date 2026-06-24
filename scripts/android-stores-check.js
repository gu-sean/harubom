const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const checks = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function pngSize(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return null;
  const buffer = fs.readFileSync(file);
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, { shell: false, encoding: 'utf8' });
  return result.status === 0 || Boolean(result.stdout || result.stderr);
}

function add(name, ok, detail, level = 'fail') {
  checks.push({ name, ok: Boolean(ok), detail, level });
}

const capacitor = readJson('capacitor.config.json');
const manifest = readJson('public/manifest.json');
const icon512 = pngSize('public/icons/icon-512.png');
const storeIcon = pngSize('public/icons/icon-512-playstore.png');
const screenshots = [
  'screenshots/phone_01_calendar.png',
  'screenshots/phone_02_habit.png',
  'screenshots/phone_03_goal.png',
  'screenshots/phone_04_gallery.png',
  'screenshots/tablet_01_calendar.png',
  'screenshots/tablet_02_habit.png',
];
const phoneScreenshots = screenshots.filter(name => name.includes('phone_'));
const tabletScreenshots = screenshots.filter(name => name.includes('tablet_'));
const aabPath = 'android/app/build/outputs/bundle/release/app-release.aab';
const apkPath = 'android/app/build/outputs/apk/release/app-release.apk';
const oneStoreGraphic = pngSize('store-assets/onestore/graphic_1024x578.png');
const oneStoreIcon = pngSize('store-assets/onestore/icon_512.png');
const oneStoreScreenshots = [
  'store-assets/onestore/actual_01_calendar_720x1280.png',
  'store-assets/onestore/actual_02_dday_720x1280.png',
  'store-assets/onestore/actual_03_goal_720x1280.png',
  'store-assets/onestore/actual_04_habit_720x1280.png',
  'store-assets/onestore/actual_05_stats_720x1280.png',
  'store-assets/onestore/actual_06_gallery_720x1280.png',
];
const buildGradle = exists('android/app/build.gradle') ? read('android/app/build.gradle') : '';
const storeMetadata = exists('ANDROID_STORES_METADATA.md') ? read('ANDROID_STORES_METADATA.md') : '';

add('Android package id', capacitor.appId === 'com.harubom.app', capacitor.appId || 'missing');
add('Android project', exists('android'), 'android/');
add('Release keystore', exists(process.env.NAHARU_KEYSTORE_PATH || 'naharu.keystore'), process.env.NAHARU_KEYSTORE_PATH || 'naharu.keystore');
add('Signing env', Boolean(process.env.NAHARU_KEYSTORE_PASSWORD || exists('.env.release.local')), 'NAHARU_KEYSTORE_PASSWORD or .env.release.local');
add('AAB output', exists(aabPath), aabPath, 'warn');
add('APK output', exists(apkPath), apkPath, 'warn');
add('Store metadata doc', exists('ANDROID_STORES_METADATA.md'), 'ANDROID_STORES_METADATA.md');
add('Store checklist doc', exists('ANDROID_STORES_CHECKLIST.md'), 'ANDROID_STORES_CHECKLIST.md');
add('ONE Store sales info doc', exists('ONESTORE_SALES_INFO.md'), 'ONESTORE_SALES_INFO.md');
add('Privacy policy file', exists('public/privacy.html'), 'public/privacy.html');
add('Hosted privacy policy URL', /https:\/\/\S+/i.test(storeMetadata) && !/Privacy policy URL:\s*TODO/i.test(storeMetadata), 'Replace TODO with the final HTTPS privacy policy URL.', 'warn');
add('ONE Store graphic image', oneStoreGraphic?.width === 1024 && oneStoreGraphic?.height === 578, oneStoreGraphic ? `store-assets/onestore/graphic_1024x578.png (${oneStoreGraphic.width}x${oneStoreGraphic.height})` : 'store-assets/onestore/graphic_1024x578.png');
add('ONE Store icon', oneStoreIcon?.width === 512 && oneStoreIcon?.height === 512, oneStoreIcon ? `store-assets/onestore/icon_512.png (${oneStoreIcon.width}x${oneStoreIcon.height})` : 'store-assets/onestore/icon_512.png');
add('ONE Store screenshots', oneStoreScreenshots.every(exists), oneStoreScreenshots.join(', '));
add('512 icon', icon512?.width === 512 && icon512?.height === 512, icon512 ? `public/icons/icon-512.png (${icon512.width}x${icon512.height})` : 'public/icons/icon-512.png');
add('Store icon', storeIcon?.width === 512 && storeIcon?.height === 512, storeIcon ? `public/icons/icon-512-playstore.png (${storeIcon.width}x${storeIcon.height})` : 'public/icons/icon-512-playstore.png');
add('Phone screenshots', phoneScreenshots.every(exists), phoneScreenshots.join(', '));
add('Tablet screenshots', tabletScreenshots.every(exists), tabletScreenshots.join(', '), 'warn');
add('Manifest name', Boolean(manifest.name && manifest.short_name), `${manifest.name || 'missing'} / ${manifest.short_name || 'missing'}`);
add('Version code', /versionCode\s+\d+/.test(buildGradle), 'android/app/build.gradle');
add('Version name', /versionName\s+"[^"]+"/.test(buildGradle), 'android/app/build.gradle');
add('Node.js', commandAvailable('node'), 'node');
add('Android SDK check script', exists('scripts/release-check.js'), 'npm run release:check');

for (const check of checks) {
  const label = check.ok ? 'OK  ' : check.level === 'warn' ? 'WARN' : 'MISS';
  console.log(`${label} ${check.name} - ${check.detail}`);
}

const failed = checks.filter(check => !check.ok && check.level === 'fail');
const warnings = checks.filter(check => !check.ok && check.level === 'warn');

if (failed.length) {
  console.error(`\nAndroid store check found ${failed.length} required item(s) to finish.`);
  process.exit(1);
}

if (warnings.length) {
  console.warn(`\nAndroid store check passed with ${warnings.length} warning(s).`);
} else {
  console.log('\nAndroid store check passed.');
}
