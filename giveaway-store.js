import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { giveawayDataPath } from './runtime.js';

export class GiveawayStore {
  constructor(path = giveawayDataPath()) {
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
    await this.assertWritable();
    return this;
  }

  async assertWritable() {
    const temporary = `${this.path}.check-${randomUUID()}`;
    const file = await open(temporary, 'wx', 0o600);
    try { await file.close(); }
    finally { await rm(temporary, { force: true }); }
  }

  all() { return [...this.items.values()]; }
  get(id) { return this.items.get(id); }
  findByMessage(messageId) { return this.all().find(item => item.messageId === messageId); }

  async set(item) {
    const previous = this.items.get(item.id);
    this.items.set(item.id, item);
    try { await this.persist(); }
    catch (error) {
      if (previous) this.items.set(item.id, previous);
      else this.items.delete(item.id);
      throw error;
    }
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
