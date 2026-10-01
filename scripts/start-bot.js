import { giveawayDataPath, prepareDataDirectory } from '../runtime.js';

try {
  if (process.getuid?.() === 0) {
    await prepareDataDirectory(giveawayDataPath());
    process.setgid(1000);
    process.setuid(1000);
  }
  await import('../index.js');
} catch (error) {
  console.error(`Bot kon niet starten (${error.code ?? error.message}). Controleer of het giveaway-volume schrijfbaar is.`);
  process.exit(1);
}
