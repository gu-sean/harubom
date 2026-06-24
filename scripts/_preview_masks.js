// Temp preview: renders option1 (solid) and option2 (gradient) backgrounds with
// the flower foreground, masked as circle (left) and rounded-square (right).
const sharp = require('sharp');
const FG = 'assets/icon-foreground.png';
const S = 320, inset = Math.round(S * 0.167);
const gap = 40, pad = 40;

const roundedMask = (size, r) => Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`);
const circleMask = (size) => Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`);

const bgSolid = () => sharp({ create: { width: S, height: S, channels: 4, background: { r: 0xF5, g: 0x60, b: 0x4a, alpha: 1 } } }).png().toBuffer();
const bgGrad = () => {
  const svg = `<svg width="${S}" height="${S}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8634A"/><stop offset="1" stop-color="#F79A7E"/></linearGradient></defs><rect width="${S}" height="${S}" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
};

async function icon(bgBuf, mask) {
  const fg = await sharp(FG).resize(S - 2 * inset, S - 2 * inset, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const composed = await sharp(bgBuf).composite([{ input: fg, top: inset, left: inset }]).png().toBuffer();
  return sharp(composed).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

(async () => {
  for (const [name, bgFn] of [['option1_solid', bgSolid], ['option2_gradient', bgGrad]]) {
    const bg = await bgFn();
    const circ = await icon(bg, circleMask(S));
    const rrect = await icon(bg, roundedMask(S, Math.round(S * 0.22)));
    const W = pad * 2 + S * 2 + gap, H = pad * 2 + S;
    await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0x14, g: 0x14, b: 0x16, alpha: 1 } } })
      .composite([{ input: circ, top: pad, left: pad }, { input: rrect, top: pad, left: pad + S + gap }])
      .png().toFile('store-assets/_' + name + '.png');
    console.log('wrote', name);
  }
})();
