import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { renderGiveawayBanner, themeForPrize } from './giveaway-banner.js';
import {
  buildGiveawayButtons, buildGiveawayEmbed, giveawayCommand, giveawayStopCommand, parseDuration, parseMessageReference, pickWinners,
} from './giveaway.js';
import { GiveawayStore } from './giveaway-store.js';

test('duur ondersteunt samengestelde Nederlandse en korte notaties', () => {
  assert.equal(parseDuration('2h 30m'), 9_000_000);
  assert.equal(parseDuration('3 dagen'), 259_200_000);
  assert.equal(parseDuration('1w'), 604_800_000);
  assert.equal(parseDuration('30s'), null);
  assert.equal(parseDuration('morgen'), null);
});

test('banner verandert automatisch met de prijs en blijft een 1200x600 PNG', async () => {
  assert.equal(themeForPrize('1 maand Discord Nitro').name, 'NITRO DROP');
  assert.equal(themeForPrize('€25 PlayStation tegoed').name, 'PLAYSTATION DROP');
  const nitro = await renderGiveawayBanner({ prize: '1 maand Discord Nitro', winners: 1 });
  const playstation = await renderGiveawayBanner({ prize: '€25 PlayStation tegoed', winners: 2 });
  assert.notDeepEqual(nitro, playstation);
  assert.deepEqual(await sharp(nitro).metadata().then(({ format, width, height }) => ({ format, width, height })),
    { format: 'png', width: 1200, height: 600 });
});

test('loting kiest unieke deelnemers en vermijdt oude winnaars als dat kan', () => {
  const participants = ['1', '2', '3', '4'];
  const winners = pickWinners(participants, 2, ['1']);
  assert.equal(winners.length, 2);
  assert.equal(new Set(winners).size, 2);
  assert.ok(winners.every(id => participants.includes(id) && id !== '1'));
});

test('/giveawaystop-weergave stopt zonder winnaar en schakelt deelname uit', () => {
  const giveaway = {
    id: 'abc', prize: 'Mystery Box', status: 'cancelled', participants: ['1'], winnerIds: [], winnerCount: 1,
    hostId: '2', requiredRoleId: null, createdAt: Date.now() - 10_000, endsAt: Date.now() + 50_000, stoppedAt: Date.now(),
  };
  const embed = buildGiveawayEmbed(giveaway).toJSON();
  assert.match(embed.title, /GESTOPT/);
  assert.equal(embed.fields.find(field => field.name.includes('WINNAAR')).value, 'Niet geloot');
  const buttons = buildGiveawayButtons(giveaway)[0].toJSON().components;
  assert.equal(buttons[0].disabled, true);
  assert.equal(buttons[2].disabled, true);
  assert.equal(giveawayStopCommand.toJSON().name, 'giveawaystop');
  assert.match(giveawayStopCommand.toJSON().description, /zonder winnaar/);
  assert.equal(giveawayCommand.toJSON().default_member_permissions, '8');
});

test('giveaways blijven na een bot-herstart bewaard', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wesh-giveaway-'));
  const path = join(directory, 'giveaways.json');
  try {
    const first = await new GiveawayStore(path).load();
    await first.set({ id: 'test', status: 'active', participants: ['123'] });
    const second = await new GiveawayStore(path).load();
    assert.deepEqual(second.get('test').participants, ['123']);
    assert.doesNotReject(() => readFile(path, 'utf8'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('stop leest het bericht-ID uit een volledige Discord-link', () => {
  assert.equal(parseMessageReference('https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333'), '333333333333333333');
  assert.equal(parseMessageReference('333333333333333333'), '333333333333333333');
  assert.equal(parseMessageReference('ongeldig 333333333333333333'), undefined);
});

test('stop annuleert werkelijk en hervatten loot daarna geen winnaar', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'wesh-stop-'));
  const path = join(directory, 'giveaways.json');
  const oldPath = process.env.GIVEAWAY_DATA_FILE;
  process.env.GIVEAWAY_DATA_FILE = path;
  const module = await import(`./giveaway.js?stop-test=${Date.now()}`);
  let announcements = 0;
  let edited;
  const client = { channels: { fetch: async () => ({
    isTextBased: () => true,
    messages: { fetch: async () => ({ edit: async payload => { edited = payload; } }) },
    send: async () => { announcements++; },
  }) } };
  try {
    const seed = await new GiveawayStore(path).load();
    await seed.set({ id: 'stoptest', guildId: '111111111111111111', channelId: '222222222222222222', messageId: '333333333333333333',
      prize: 'Nitro', status: 'active', participants: ['444444444444444444'], winnerIds: [], winnerCount: 1,
      hostId: '555555555555555555', createdAt: Date.now(), endsAt: Date.now() + 60_000 });
    await module.initializeGiveaways(client);
    const result = await module.stopGiveaway({ guildId: '111111111111111111', channelId: '222222222222222222',
      user: { id: '555555555555555555' }, options: { getString: () => 'https://discord.com/channels/111111111111111111/222222222222222222/333333333333333333' } }, client);
    assert.match(result, /geen winnaar/);
    const saved = JSON.parse(await readFile(path, 'utf8'))[0];
    assert.equal(saved.status, 'cancelled');
    assert.deepEqual(saved.winnerIds, []);
    assert.equal(edited.components[0].toJSON().components[0].disabled, true);
    saved.endsAt = Date.now() - 1;
    await seed.set(saved);
    await module.initializeGiveaways(client);
    assert.equal(announcements, 0);
  } finally {
    module.stopGiveawayScheduler();
    if (oldPath === undefined) delete process.env.GIVEAWAY_DATA_FILE;
    else process.env.GIVEAWAY_DATA_FILE = oldPath;
    await rm(directory, { recursive: true, force: true });
  }
});
