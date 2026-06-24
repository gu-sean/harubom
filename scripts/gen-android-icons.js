/**
 * gen-android-icons.js
 * assets/icon-foreground.png + assets/icon-background.png 를 읽어
 * Android mipmap 각 밀도에 맞는 아이콘 PNG를 생성한다.
 *
 * 어댑티브 아이콘 포그라운드는 108dp 기준으로 리사이즈 (API 26+).
 * 레거시 ic_launcher / ic_launcher_round는 48dp 기준 합성 이미지.
 *
 * Run: node scripts/gen-android-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const FG_SRC = path.join(ROOT, 'assets', 'icon-foreground.png');
const BG_SRC = path.join(ROOT, 'assets', 'icon-background.png');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

// 어댑티브 아이콘 포그라운드 크기 (108dp × density)
const ADAPTIVE_FG_SIZES = {
  'mipmap-ldpi':    81,
  'mipmap-mdpi':   108,
  'mipmap-hdpi':   162,
  'mipmap-xhdpi':  216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi':432,
};

// 레거시 런처 아이콘 크기 (48dp × density)
const LEGACY_SIZES = {
  'mipmap-ldpi':    36,
  'mipmap-mdpi':    48,
  'mipmap-hdpi':    72,
  'mipmap-xhdpi':   96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi':192,
};

async function main() {
  // 1. 어댑티브 포그라운드 (투명 배경, 아이콘만)
  for (const [dir, size] of Object.entries(ADAPTIVE_FG_SIZES)) {
    const outDir = path.join(RES, dir);
    if (!fs.existsSync(outDir)) continue;
    await sharp(FG_SRC)
      .resize(size, size)
      .png()
      .toFile(path.join(outDir, 'ic_launcher_foreground.png'));
    console.log(`✓ ${dir}/ic_launcher_foreground.png  ${size}×${size}`);
  }

  // 2. 레거시 ic_launcher (배경 + 포그라운드 합성)
  for (const [dir, size] of Object.entries(LEGACY_SIZES)) {
    const outDir = path.join(RES, dir);
    if (!fs.existsSync(outDir)) continue;

    const bgBuf = await sharp(BG_SRC).resize(size, size).png().toBuffer();
    const fgBuf = await sharp(FG_SRC).resize(size, size).png().toBuffer();

    await sharp(bgBuf)
      .composite([{ input: fgBuf, blend: 'over' }])
      .png()
      .toFile(path.join(outDir, 'ic_launcher.png'));
    console.log(`✓ ${dir}/ic_launcher.png  ${size}×${size}`);

    // 3. 레거시 ic_launcher_round (원형 클리핑)
    const circle = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`
    );
    const composited = await sharp(bgBuf)
      .composite([{ input: fgBuf, blend: 'over' }])
      .png()
      .toBuffer();
    await sharp(composited)
      .composite([{ input: circle, blend: 'dest-in' }])
      .png()
      .toFile(path.join(outDir, 'ic_launcher_round.png'));
    console.log(`✓ ${dir}/ic_launcher_round.png  ${size}×${size}`);
  }

  console.log('\n완료.');
}

main().catch(e => { console.error(e); process.exit(1); });
