const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const assetlinksPath = path.join(root, 'public', '.well-known', 'assetlinks.json');
const capacitor = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function normalizeSha(value) {
  const sha = String(value || '').trim().toUpperCase();
  if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(sha)) {
    fail('SHA-256 must use colon-separated uppercase hex, for example AA:BB:... with 32 bytes.');
  }
  return sha;
}

function readShaFromKeystore() {
  const keystorePath = process.env.NAHARU_KEYSTORE_PATH || 'naharu.keystore';
  const alias = process.env.NAHARU_KEYSTORE_ALIAS || 'naharu';
  const storePassword = process.env.NAHARU_KEYSTORE_PASSWORD;

  if (!storePassword) {
    fail('Set NAHARU_ASSETLINKS_SHA256, or set NAHARU_KEYSTORE_PASSWORD so the SHA-256 can be read from the keystore.');
  }

  const absoluteKeystorePath = path.resolve(root, keystorePath);
  if (!fs.existsSync(absoluteKeystorePath)) {
    fail(`Keystore not found: ${absoluteKeystorePath}`);
  }

  const output = execFileSync('keytool', [
    '-list',
    '-v',
    '-keystore',
    absoluteKeystorePath,
    '-alias',
    alias,
    '-storepass',
    storePassword,
  ], { encoding: 'utf8' });

  const match = output.match(/SHA256:\s*([0-9A-Fa-f:]+)/);
  if (!match) fail('Could not find SHA256 in keytool output.');
  return normalizeSha(match[1]);
}

const sha = normalizeSha(process.env.NAHARU_ASSETLINKS_SHA256 || readShaFromKeystore());
const assetlinks = JSON.parse(fs.readFileSync(assetlinksPath, 'utf8'));

if (!assetlinks[0] || !assetlinks[0].target) {
  fail('Unexpected assetlinks.json structure.');
}

assetlinks[0].target.package_name = capacitor.appId;
assetlinks[0].target.sha256_cert_fingerprints = [sha];

fs.writeFileSync(assetlinksPath, `${JSON.stringify(assetlinks, null, 2)}\n`);
console.log(`Updated public/.well-known/assetlinks.json for ${capacitor.appId}.`);
