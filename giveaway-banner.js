import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const backgroundPath = fileURLToPath(new URL('./assets/giveaway-background.webp', import.meta.url));
const logoPath = fileURLToPath(new URL('./assets/logo.png', import.meta.url));

const themes = [
  { test: /nitro|discord/, name: 'NITRO DROP', tag: 'NITRO', start: '#5865f2', end: '#d83cff' },
  { test: /playstation|psn|\bps[345]\b/, name: 'PLAYSTATION DROP', tag: 'PS', start: '#0877ff', end: '#33d7ff' },
  { test: /xbox|game\s*pass/, name: 'XBOX DROP', tag: 'XBOX', start: '#39d353', end: '#9cff57' },
  { test: /steam/, name: 'STEAM DROP', tag: 'STEAM', start: '#1b9bd7', end: '#66e0ff' },
  { test: /paysafe|gift\s*card|giftcard|cadeaukaart|vvv|tegoed/, name: 'GIFT CARD DROP', tag: 'CARD', start: '#ff9d2e', end: '#ff3cac' },
  { test: /€|euro|geld|cash|paypal/, name: 'CASH DROP', tag: '€', start: '#26d980', end: '#f4d35e' },
  { test: /game|gaming|spel|fortnite|minecraft|gta|ea\s*fc/, name: 'GAMING DROP', tag: 'GAME', start: '#00a8ff', end: '#a855f7' },
];

export function themeForPrize(prize) {
  const value = prize.toLocaleLowerCase('nl-NL');
  return themes.find(theme => theme.test.test(value)) ?? {
    name: 'GIVEAWAY DROP', tag: 'WESH', start: '#168dff', end: '#d52cff',
  };
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

function wrapPrize(prize) {
  const words = prize.trim().toLocaleUpperCase('nl-NL').split(/\s+/);
  const limit = prize.length > 56 ? 25 : prize.length > 34 ? 21 : 18;
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current || `${current} ${word}`.length <= limit) current = current ? `${current} ${word}` : word;
    else { lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function fontSizeFor(prize, lines) {
  if (lines.length === 1) return prize.length > 20 ? 56 : 72;
  if (lines.length === 2) return prize.length > 48 ? 46 : 58;
  return 42;
}

async function roundedLogo() {
  const size = 330;
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="165" cy="165" r="160" fill="white"/></svg>`);
  return sharp(await readFile(logoPath)).resize(size, size, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

export async function renderGiveawayBanner({ prize, winners = 1, customBackground } = {}) {
  if (!prize?.trim()) throw new TypeError('Een prijs is verplicht.');
  const theme = themeForPrize(prize);
  const lines = wrapPrize(prize);
  const fontSize = fontSizeFor(prize, lines);
  const lineHeight = Math.round(fontSize * 1.05);
  const startY = lines.length === 1 ? 310 : lines.length === 2 ? 282 : 252;
  const title = lines.map((line, index) =>
    `<text x="505" y="${startY + index * lineHeight}" class="prize">${escapeXml(line)}</text>`).join('');
  const source = customBackground || await readFile(backgroundPath);
  const base = await sharp(source).resize(1200, 600, { fit: 'cover' }).png().toBuffer();
  const logo = await roundedLogo();
  const overlay = Buffer.from(`
    <svg width="1200" height="600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#020714" stop-opacity=".18"/><stop offset=".38" stop-color="#02030a" stop-opacity=".58"/><stop offset="1" stop-color="#02020a" stop-opacity=".45"/></linearGradient>
        <linearGradient id="accent" x1="0" x2="1"><stop stop-color="${theme.start}"/><stop offset="1" stop-color="${theme.end}"/></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <style>
          text { font-family: Inter, Arial, sans-serif; }
          .small { fill:#d9deed; font-size:18px; font-weight:700; letter-spacing:3px; }
          .drop { fill:white; font-size:29px; font-weight:900; letter-spacing:2px; }
          .prize { fill:white; font-size:${fontSize}px; font-weight:900; letter-spacing:-1px; paint-order:stroke; stroke:#070913; stroke-width:5px; }
          .meta { fill:#eef0f7; font-size:22px; font-weight:700; }
          .tag { fill:white; font-size:24px; font-weight:900; }
        </style>
      </defs>
      <rect width="1200" height="600" fill="url(#shade)"/>
      <rect x="22" y="22" width="1156" height="556" rx="32" fill="none" stroke="url(#accent)" stroke-width="4" opacity=".9"/>
      <circle cx="215" cy="300" r="185" fill="#02040d" opacity=".7"/>
      <circle cx="215" cy="300" r="176" fill="none" stroke="url(#accent)" stroke-width="7" filter="url(#glow)"/>
      <rect x="505" y="78" width="270" height="46" rx="23" fill="url(#accent)"/>
      <text x="640" y="109" text-anchor="middle" class="tag">${escapeXml(theme.tag)}</text>
      <text x="505" y="158" class="small">WESH LOUNGE GIVEAWAYS</text>
      <text x="505" y="198" class="drop">${escapeXml(theme.name)}</text>
      ${title}
      <rect x="505" y="440" width="620" height="2" fill="url(#accent)" opacity=".8"/>
      <text x="505" y="488" class="meta">${winners} ${winners === 1 ? 'WINNAAR' : 'WINNAARS'}  •  AUTOMATISCHE LOTING</text>
      <text x="505" y="526" fill="#aeb5c8" font-family="Inter, Arial" font-size="19">DOE MEE VIA DE KNOP ONDER DE GIVEAWAY</text>
    </svg>`);
  return sharp(base).composite([
    { input: overlay, left: 0, top: 0 },
    { input: logo, left: 50, top: 135 },
  ]).png({ compressionLevel: 9 }).toBuffer();
}
