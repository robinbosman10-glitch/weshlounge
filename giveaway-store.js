import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultPath = fileURLToPath(new URL('./data/giveaways.json', import.meta.url));

export class GiveawayStore {
  constructor(path = process.env.GIVEAWAY_DATA_FILE || defaultPath) {
    this.path = resolve(path);
    this.items = new Map();
    this.writeQueue = Promise.resolve();
  }

  async load() {
    await mkdir(dirname(this.path), { recursive: true });
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      for (const item of Array.isArray(data) ? data : []) this.items.set(item.id, item);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return this;
  }

  all() { return [...this.items.values()]; }
  get(id) { return this.items.get(id); }
  findByMessage(messageId) { return this.all().find(item => item.messageId === messageId); }

  async set(item) {
    this.items.set(item.id, item);
    await this.persist();
    return item;
  }

  async persist() {
    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      const temporary = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(this.all(), null, 2));
      await rename(temporary, this.path);
    });
    return this.writeQueue;
  }
}
