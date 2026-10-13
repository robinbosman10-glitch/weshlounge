import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPanel, command, roles, toggleRole } from './panel.js';

test('paneel koppelt alle melding- en gamerollen aan de juiste knoppen', () => {
  const panel = buildPanel();
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
