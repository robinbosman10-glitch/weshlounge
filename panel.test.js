import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { buildPanel, command, roleEmoji, roles, toggleRole } from './panel.js';

test('paneel koppelt alle melding- en gamerollen aan de juiste knoppen', async () => {
  const panel = await buildPanel();
  assert.deepEqual(Object.fromEntries(Object.entries(roles).map(([key, role]) => [key, role.id])), {
    'wesh:giveaway': '1516850805322285258',
    'wesh:gaming': '1528781954416378027',
    'wesh:minecraft': '1555695172187062312',
    'wesh:fortnite': '1559535598438580245',
    'wesh:fivem': '1559535757310435408',
    'wesh:callofduty': '559535941675262053',
    'wesh:rainbowsix': '1559536185519640636',
    'wesh:amongus': '1559536458333814926',
    'wesh:leagueoflegends': '1557409898621567157',
  });
  const buttons = panel.components.flatMap(row => row.toJSON().components);
  assert.deepEqual(buttons.map(button => button.custom_id), Object.keys(roles));
  assert.deepEqual(panel.components.map(row => row.toJSON().components.length), [2, 4, 3]);
  assert.ok(panel.components.every(row => row.toJSON().components.length <= 5));
  assert.equal(panel.embeds[0].toJSON().thumbnail.url, 'attachment://wesh-lounge.png');
  assert.equal(panel.files[0].name, 'wesh-lounge.png');
  assert.equal(command.toJSON().default_member_permissions, '8');
});

test('paneel gebruikt automatisch dezelfde emoji als de Discord-rol', async () => {
  const discordRoles = new Map([
    ['1516850805322285258', { unicodeEmoji: '🎁', name: 'Giveaway-ping' }],
    ['1528781954416378027', { unicodeEmoji: null, name: '🕹️ Gaming-ping' }],
  ]);
  const guild = { roles: { cache: new Map(), fetch: async () => discordRoles } };
  const panel = await buildPanel(guild);
  const buttons = panel.components.flatMap(row => row.toJSON().components);
  assert.equal(buttons[0].emoji.name, '🎁');
  assert.equal(buttons[1].emoji.name, '🕹️');
  assert.match(panel.embeds[0].toJSON().fields[0].value, /🎁 Giveaway-ping/);
  assert.match(panel.embeds[0].toJSON().fields[0].value, /🕹️ Gaming-ping/);
  assert.equal(roleEmoji({ unicodeEmoji: '🔥', name: '🎮 Test' }, '❔'), '🔥');
  assert.equal(roleEmoji({ unicodeEmoji: null, name: 'Test' }, '❔'), '❔');
});

test('rolafbeeldingen worden als serveremoji op de knoppen gebruikt', async () => {
  const created = [];
  const sourceIcon = await sharp({ create: { width: 16, height: 16, channels: 4, background: '#ffffff' } })
    .composite([{ input: Buffer.from('<svg width="8" height="8"><rect width="8" height="8" fill="#e02080"/></svg>'), left: 4, top: 4 }])
    .png()
    .toBuffer();
  const discordRoles = new Map([
    ['1516850805322285258', {
      id: '1516850805322285258', name: 'Giveaway-ping', icon: 'abc123def456', unicodeEmoji: null,
      iconURL: options => { assert.deepEqual(options, { extension: 'png', size: 128 }); return 'https://cdn.example/role.png'; },
    }],
  ]);
  const guildEmojis = new Map();
  const guild = {
    roles: { cache: discordRoles, fetch: async () => discordRoles },
    members: { me: { permissions: { any: () => true } } },
    emojis: {
      fetch: async () => guildEmojis,
      create: async options => {
        created.push(options);
        return { id: '999999999999999999', name: options.name, animated: false };
      },
    },
  };
  const panel = await buildPanel(guild, { fetchIcon: async () => new Response(sourceIcon) });
  const button = panel.components[0].toJSON().components[0];
  assert.equal(button.emoji.id, '999999999999999999');
  assert.equal(created.length, 1);
  assert.ok(Buffer.isBuffer(created[0].attachment));
  const transparent = await sharp(created[0].attachment).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(transparent.data[3], 0);
  const centerOffset = ((64 * transparent.info.width) + 64) * transparent.info.channels;
  assert.equal(transparent.data[centerOffset + 3], 255);
  assert.match(panel.embeds[0].toJSON().fields[0].value, /<:wr2_1516850805322285258_abc123de:999999999999999999>/);
});

test('rolafbeeldingen geven een duidelijke melding zonder expressierecht', async () => {
  const discordRoles = new Map([
    ['1516850805322285258', {
      id: '1516850805322285258', name: 'Giveaway-ping', icon: 'abc123', unicodeEmoji: null,
    }],
  ]);
  const guild = {
    roles: { cache: discordRoles, fetch: async () => discordRoles },
    members: { me: { permissions: { any: () => false } } },
  };
  await assert.rejects(buildPanel(guild), error => {
    assert.equal(error.code, 'ROLE_ICON_EMOJI_PERMISSION');
    assert.match(error.userMessage, /Expressies maken/);
    return true;
  });
});

function fakeGuild({ hasRole = false, permission = true, position = 1, managed = false, missing = false } = {}) {
  const calls = [];
  const member = { roles: { cache: new Map(hasRole ? [['1516850805322285258', true]] : []),
    add: async id => calls.push(['add', id]), remove: async id => calls.push(['remove', id]) } };
  const guild = {
    roles: { fetch: async () => missing ? null : { id: '1516850805322285258', managed } },
    members: {
      fetchMe: async () => ({ permissions: { has: () => permission }, roles: { highest: { comparePositionTo: () => position } } }),
      fetch: async options => { assert.equal(options.force, true); return member; },
    },
  };
  return { guild, calls };
}
test('eerste klik voegt rol toe; bestaande rol wordt verwijderd', async () => {
  for (const hasRole of [false, true]) {
    const { guild, calls } = fakeGuild({ hasRole });
    const reply = await toggleRole(guild, 'user', roles['wesh:giveaway']);
    assert.deepEqual(calls, [[hasRole ? 'remove' : 'add', '1516850805322285258']]);
    assert.match(reply, /✅/);
  }
});
test('ontbrekende rol, ontbrekende rechten en onbeheerbare rollen worden niet aangepast', async () => {
  for (const options of [{ missing: true }, { permission: false }, { position: 0 }, { position: -1 }, { managed: true }]) {
    const { guild, calls } = fakeGuild(options);
    assert.match(await toggleRole(guild, 'user', roles['wesh:giveaway']), /❌/);
    assert.deepEqual(calls, []);
  }
});
