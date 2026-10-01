import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { prepareDataDirectory } from './runtime.js';
import { GiveawayStore } from './giveaway-store.js';

const execute = promisify(execFile);

test('runtime herstelt een root-volume en bestaande database voor de botgebruiker', {
  skip: process.platform !== 'linux' || process.getuid?.() !== 0,
}, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'wesh-volume-'));
  const volume = join(directory, 'volume');
  const filename = join(volume, 'giveaways.json');
  try {
    await chmod(directory, 0o755);
    await mkdir(volume, { mode: 0o755 });
    await writeFile(filename, JSON.stringify([{ id: 'existing', participants: ['123'] }]), { mode: 0o600 });
    await copyFile(new URL('./runtime.js', import.meta.url), join(directory, 'runtime.js'));
    await copyFile(new URL('./giveaway-store.js', import.meta.url), join(directory, 'giveaway-store.js'));
    await writeFile(join(directory, 'package.json'), '{"type":"module"}');
    const code = `import { GiveawayStore } from ${JSON.stringify(pathToFileURL(join(directory, 'giveaway-store.js')).href)};
      const store = await new GiveawayStore(${JSON.stringify(filename)}).load();
      await store.set({ id: 'new', participants: ['456'] });
      console.log(store.get('existing').participants[0]);`;
    let denied;
    try { await execute(process.execPath, ['--input-type=module', '-e', code], { uid: 65534, gid: 65534 }); }
    catch (error) { denied = error; }
    if (denied?.code === 'EINVAL') {
      t.skip('Deze testomgeving ondersteunt uitsluitend UID 0; de test vereist een normale Linux-container.');
      return;
    }
    assert.match(denied?.stderr || denied?.message || '', /EACCES/);
    await prepareDataDirectory(filename, 65534, 65534);
    const { stdout } = await execute(process.execPath, ['--input-type=module', '-e', code], { uid: 65534, gid: 65534 });
    assert.equal(stdout.trim(), '123');
    assert.equal(JSON.parse(await readFile(filename, 'utf8')).length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('een mislukte opslag laat geen nieuwe giveaway in het geheugen achter', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wesh-write-fail-'));
  try {
    const store = await new GiveawayStore(join(directory, 'giveaways.json')).load();
    store.path = join(directory, 'missing', 'giveaways.json');
    await assert.rejects(store.set({ id: 'failed', status: 'active' }), /ENOENT/);
    assert.equal(store.get('failed'), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
