// Generates proper Android adaptive-icon source layers from assets/icon-only.png
//  - assets/icon-foreground.png : white flower only, transparent background (center hole transparent)
//  - assets/icon-background.png : solid brand coral (#F5604A)
// Run: node scripts/make-adaptive-icon-assets.js
const sharp = require('sharp');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'assets', 'icon-only.png');
const OUT_FG = join(ROOT, 'assets', 'icon-foreground.png');
const OUT_BG = join(ROOT, 'assets', 'icon-background.png');
const BRAND = { r: 0xF5, g: 0x60, b: 0x4a };
const SIZE = 1024;

(async () => {
  const { data, info } = await sharp(SRC)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);

  // Keep only near-white pixels (the flower petals). Coral background and the
  // coral center dot become transparent -> the background layer shows through
  // there, reproducing the original look but properly inset.
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3];
    const minc = Math.min(r, g, b);
    // soft alpha: 0 at minc<=140 (coral/red), 1 at minc>=235 (white)
    let whiteness = (minc - 140) / (235 - 140);
    whiteness = Math.max(0, Math.min(1, whiteness));
    const alpha = Math.round(whiteness * (a / 255) * 255);
    const p = i * 4;
    out[p] = 255; out[p + 1] = 255; out[p + 2] = 255; out[p + 3] = alpha;
  }

  // Foreground: trim transparent border, re-center on a square canvas with a
  // small margin. The 16.7% inset in the adaptive-icon XML handles the rest of
  // the safe zone, so we only add a little padding here.
  const trimmed = await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .trim()
    .toBuffer({ resolveWithObject: true });

  const tw = trimmed.info.width, th = trimmed.info.height;
  const side = Math.max(tw, th);
  const canvas = Math.round(side / 0.88); // ~6% margin on each side
  await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: trimmed.data, gravity: 'center' }])
    .resize(SIZE, SIZE)
    .png()
    .toFile(OUT_FG);

  // Background: solid brand color.
  await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { ...BRAND, alpha: 1 } },
  })
    .png()
    .toFile(OUT_BG);

  console.log('Wrote', OUT_FG);
  console.log('Wrote', OUT_BG);
})();
