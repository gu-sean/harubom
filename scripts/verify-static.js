const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'index.html',
  'vite.config.js',
  'src/main.jsx',
  'src/App.jsx',
  'package.json',
  'firebase.json',
  'capacitor.config.json',
  'public/sw.js',
  'public/manifest.json',
  'public/.well-known/assetlinks.json',
  'ANDROID_STORES_CHECKLIST.md',
  'ANDROID_STORES_METADATA.md',
  'ONESTORE_SALES_INFO.md',
];

const jsonFiles = [
  'package.json',
  'public/manifest.json',
  'firebase.json',
  'capacitor.config.json',
  'public/.well-known/assetlinks.json',
];

// 순수 JS(비-JSX) 파일만 vm.Script로 문법 검증. JSX/ESM 소스(src/*)는 vite build가 검증.
const scriptFiles = [
  'public/sw.js',
  'scripts/verify-static.js',
  'scripts/update-assetlinks.js',
  'scripts/release-check.js',
  'scripts/android-stores-check.js',
  'scripts/dev-server.js',
  'scripts/prepare-capacitor.js',
];
const failures = [];
const warnings = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`Missing required file: ${rel}`);
}

for (const rel of jsonFiles) {
  try {
    JSON.parse(read(rel));
  } catch (error) {
    failures.push(`${rel} is not valid JSON: ${error.message}`);
  }
}

for (const rel of scriptFiles) {
  if (!fs.existsSync(path.join(root, rel))) continue;
  try {
    new vm.Script(read(rel), { filename: rel });
  } catch (error) {
    failures.push(`${rel} has a JavaScript syntax error: ${error.message}`);
  }
}

const index = read('index.html');
if (!index.includes('/src/main.jsx')) {
  failures.push('index.html is missing the Vite entry script (/src/main.jsx).');
}

const assetLinks = read('public/.well-known/assetlinks.json');
const manifest = JSON.parse(read('public/manifest.json'));
const capacitor = JSON.parse(read('capacitor.config.json'));
const assetLinksJson = JSON.parse(assetLinks);
const assetPackageName = assetLinksJson?.[0]?.target?.package_name;

if (!manifest.name || !manifest.short_name) {
  failures.push('public/manifest.json is missing name or short_name.');
}

if (capacitor.webDir !== 'dist') {
  failures.push(`capacitor.config.json webDir must be "dist" (Vite output), found "${capacitor.webDir}".`);
}

if (assetPackageName !== capacitor.appId) {
  failures.push(`assetlinks package_name (${assetPackageName || 'missing'}) must match Capacitor appId (${capacitor.appId}).`);
}

if (assetLinks.includes('REPLACE_WITH_YOUR_SHA256_FINGERPRINT')) {
  warnings.push('public/.well-known/assetlinks.json still contains the SHA-256 placeholder for TWA verification.');
}

const buildScript = fs.existsSync(path.join(root, 'build.sh')) ? read('build.sh') : '';
if (/keystorePassword|keystoreAliasPassword/.test(read('capacitor.config.json'))) {
  warnings.push('capacitor.config.json contains keystore passwords in plain text; move real signing secrets out of source before release.');
}

if (/naharu2024|storepass\s+naharu|keypass\s+naharu/.test(buildScript)) {
  failures.push('build.sh contains hardcoded signing credentials.');
}

if (/fonts\.googleapis\.com/.test(index)) {
  failures.push('index.html still loads Google Fonts from the network.');
}

if (/www\.gstatic\.com/.test(index)) {
  warnings.push('index.html still uses external Firebase assets; cloud features need network access.');
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('Static verification passed.');
