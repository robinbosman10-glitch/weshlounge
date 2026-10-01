import { mkdir, writeFile } from 'node:fs/promises';
import { renderGiveawayBanner } from '../giveaway-banner.js';

await mkdir('output', { recursive: true });
await writeFile('output/giveaway-nitro.png', await renderGiveawayBanner({ prize: '1 maand Discord Nitro', winners: 1 }));
await writeFile('output/giveaway-playstation.png', await renderGiveawayBanner({ prize: '€25 PlayStation tegoed', winners: 2 }));
console.log('Voorbeelden gemaakt in output/.');
