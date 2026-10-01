import { chown, lstat, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function giveawayDataPath() {
  return resolve(process.env.GIVEAWAY_DATA_FILE || fileURLToPath(new URL('./data/giveaways.json', import.meta.url)));
}

// Railway mounts volumes after the image is built. Repair only our data
// directory and existing database, then run the bot as the node user.
export async function prepareDataDirectory(path, uid = 1000, gid = 1000) {
  const directory = dirname(resolve(path));
  await mkdir(directory, { recursive: true });
  await chown(directory, uid, gid);
  try {
    const info = await lstat(path);
    if (!info.isFile()) throw new Error('GIVEAWAY_DATA_NOT_A_FILE');
    await chown(path, uid, gid);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
