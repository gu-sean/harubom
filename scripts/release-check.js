const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const checks = [];
const localEnvPath = path.join(root, '.env.release.local');

if (fs.existsSync(localEnvPath)) {
  for (const line of fs.readFileSync(localEnvPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^=#]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function commandAvailable(command, args = ['-version']) {
  const result = spawnSync(command, args, { shell: false, encoding: 'utf8' });
  return result.status === 0 || result.stdout || result.stderr;
}

function add(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
}

const assetlinks = JSON.parse(fs.readFileSync(path.join(root, 'public', '.well-known', 'assetlinks.json'), 'utf8'));
const sha = assetlinks?.[0]?.target?.sha256_cert_fingerprints?.[0] || '';
const keystorePath = process.env.NAHARU_KEYSTORE_PATH || 'naharu.keystore';
const localPropertiesPath = path.join(root, 'android', 'local.properties');
let sdkPath = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';

if (!sdkPath && fs.existsSync(localPropertiesPath)) {
  const localProperties = fs.readFileSync(localPropertiesPath, 'utf8');
  const match = localProperties.match(/^sdk\.dir=(.+)$/m);
  if (match) sdkPath = match[1].trim().replace(/\\\\/g, '\\');
}

add('Static verification script', exists('scripts/verify-static.js'), 'scripts/verify-static.js');
add('Vite app entry', exists('src/main.jsx') && exists('src/App.jsx') && exists('vite.config.js'), 'src/main.jsx, src/App.jsx, vite.config.js');
add('Asset Links SHA-256', !sha.includes('REPLACE_WITH'), sha.includes('REPLACE_WITH') ? 'Set NAHARU_ASSETLINKS_SHA256 and run npm run release:assetlinks.' : sha);
add('Keystore file', exists(keystorePath), keystorePath);
add('Keystore password env', Boolean(process.env.NAHARU_KEYSTORE_PASSWORD), 'NAHARU_KEYSTORE_PASSWORD');
add('Key password env', Boolean(process.env.NAHARU_KEY_ALIAS_PASSWORD), 'NAHARU_KEY_ALIAS_PASSWORD');
add('Java keytool', commandAvailable('keytool'), 'keytool');
add('Node.js', commandAvailable('node', ['--version']), 'node');
add('Android project', exists('android'), 'Run npm run android:init after Android SDK setup.');
add('Android SDK', sdkPath && fs.existsSync(sdkPath), sdkPath || 'Set ANDROID_HOME or android/local.properties.');

for (const check of checks) {
  console.log(`${check.ok ? 'OK  ' : 'MISS'} ${check.name} - ${check.detail}`);
}

const failed = checks.filter(check => !check.ok);
if (failed.length) {
  console.error(`\nRelease check found ${failed.length} item(s) to finish before Android/TWA release.`);
  process.exit(1);
}

console.log('\nRelease check passed.');
