import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const background = await sharp(await readFile('assets/giveaway-background.webp'))
  .resize(1200, 400, { fit: 'cover' }).webp({ quality: 92 }).toBuffer();
const size = 290;
const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="145" cy="145" r="140" fill="white"/></svg>`);
const logo = await sharp(await readFile('assets/logo.png')).resize(size, size, { fit: 'cover' })
  .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
const overlay = Buffer.from(`
  <svg width="1200" height="400" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade"><stop stop-color="#020712" stop-opacity=".18"/><stop offset=".45" stop-color="#03030b" stop-opacity=".73"/><stop offset="1" stop-color="#06020d" stop-opacity=".56"/></linearGradient>
      <linearGradient id="neon"><stop stop-color="#168dff"/><stop offset="1" stop-color="#d52cff"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <style>text { font-family: DejaVu Sans, Arial, sans-serif; }</style>
    </defs>
    <rect width="1200" height="400" fill="url(#shade)"/>
    <rect x="15" y="15" width="1170" height="370" rx="27" fill="none" stroke="url(#neon)" stroke-width="4"/>
    <circle cx="188" cy="200" r="156" fill="#02040c" opacity=".76"/>
    <circle cx="188" cy="200" r="150" fill="none" stroke="url(#neon)" stroke-width="7" filter="url(#glow)"/>
    <path d="M1018 73l71 25v67c0 67-36 120-71 143-35-23-71-76-71-143V98z" fill="#090c18" stroke="url(#neon)" stroke-width="5" opacity=".95"/>
    <path d="M982 169l25 25 48-57" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="400" y="128" fill="#c9d0e2" font-size="24" font-weight="700" letter-spacing="7">WESH LOUNGE</text>
    <text x="395" y="218" fill="#fff" font-size="70" font-weight="900" letter-spacing="-2">SERVER RULES</text>
    <rect x="400" y="247" width="488" height="4" rx="2" fill="url(#neon)"/>
    <text x="400" y="300" fill="#f0f2fa" font-size="24" font-weight="700" letter-spacing="2">RESPECT  •  SAFETY  •  COMMUNITY</text>
    <text x="400" y="340" fill="#aab2c7" font-size="19">READ THE RULES • KEEP WESH LOUNGE FUN FOR EVERYONE</text>
  </svg>`);

await writeFile('assets/server-rules-banner.webp', await sharp(background).composite([
  { input: overlay, left: 0, top: 0 },
  { input: logo, left: 43, top: 55 },
]).webp({ quality: 92 }).toBuffer());
console.log('assets/server-rules-banner.webp gemaakt.');
