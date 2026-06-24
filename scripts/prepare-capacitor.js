const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

// Vite 프로덕션 빌드 → dist/ 생성 (capacitor.config.json의 webDir)
console.log('Building web assets with Vite...');
execSync('npx vite build', { cwd: root, stdio: 'inherit' });

// 빌드 산출물 검증
const required = ['index.html', 'manifest.json', 'sw.js', 'icons'];
for (const entry of required) {
  if (!fs.existsSync(path.join(distDir, entry))) {
    throw new Error(`Vite build output missing: dist/${entry}`);
  }
}

console.log('Capacitor web assets ready in dist/.');
