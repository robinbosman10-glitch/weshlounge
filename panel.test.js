import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPanel, command, roles, toggleRole } from './panel.js';

test('paneel koppelt beide knoppen aan de opgegeven rollen en het logo', () => {
  const panel = buildPanel();
  assert.equal(roles['wesh:giveaway'].id, '1516850805322285258');
  assert.equal(roles['wesh:gaming'].id, '1528781954416378027');
  assert.deepEqual(panel.components[0].toJSON().components.map(b => b.custom_id), Object.keys(roles));
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
