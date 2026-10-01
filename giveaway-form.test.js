import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection, ComponentType, PermissionFlagsBits } from 'discord.js';
import { giveawayCommand } from './giveaway.js';
import {
  buildDetailsModal, buildSettingsModal, GiveawayFormManager, readDetails,
} from './giveaway-form.js';

const channelId = '222222222222222222';
const roleId = '333333333333333333';
const channel = { id: channelId, type: 0 };
const role = { id: roleId };

function interaction(kind, customId, fields) {
  const calls = [];
  return {
    calls, customId, fields, commandName: 'giveaway', user: { id: 'owner' }, guildId: 'guild', channelId,
    channel, guild: { channels: { fetch: async () => channel }, roles: { fetch: async () => role } },
    memberPermissions: { has: permission => permission === PermissionFlagsBits.Administrator },
    isChatInputCommand: () => kind === 'command', isModalSubmit: () => kind === 'modal', isButton: () => kind === 'button',
    isFromMessage: () => false,
    showModal: async modal => calls.push(['modal', modal.toJSON()]),
    reply: async payload => calls.push(['reply', payload]),
    deferReply: async payload => calls.push(['deferReply', payload]),
    deferUpdate: async () => calls.push(['deferUpdate']),
    editReply: async payload => calls.push(['editReply', payload]),
  };
}

function details(values = {}) {
  const data = { prijs: '1 maand Nitro', duur: '2h', winnaars: '2', beschrijving: 'Voor de community', ...values };
  return { getTextInputValue: key => data[key] };
}

async function createDraft(manager) {
  const command = interaction('command');
  await manager.handle(command);
  assert.equal(command.calls[0][0], 'modal');
  const id = command.calls[0][1].custom_id.split(':')[2];
  const submitted = interaction('modal', `giveawayform:details:${id}`, details());
  await manager.handle(submitted);
  return { id, draft: manager.drafts.get(id), submitted };
}

test('/giveaway opent zonder slashopties een formulier; instellingen behouden alle opties', () => {
  assert.equal(giveawayCommand.toJSON().options.length, 0);
  const first = buildDetailsModal({ id: 'test' }).toJSON();
  assert.deepEqual(first.components.map(item => item.component.custom_id), ['prijs', 'duur', 'winnaars', 'beschrijving']);
  const second = buildSettingsModal({ id: 'test', channelId, channelType: 0, pingRoleId: roleId, requiredRoleId: roleId }).toJSON();
  assert.equal(second.components.length, 5);
  assert.deepEqual(second.components.map(item => item.component.type), [ComponentType.ChannelSelect, ComponentType.RoleSelect,
    ComponentType.RoleSelect, ComponentType.StringSelect, ComponentType.FileUpload]);
  assert.equal(second.components[4].component.required, false);
  assert.equal(second.components[1].component.default_values[0].id, roleId);
});

test('ongeldige formuliergegevens worden afgewezen met behoud van ingevulde tekst', () => {
  for (const values of [{ prijs: ' ' }, { duur: 'morgen' }, { winnaars: '0' }, { winnaars: '21' }, { winnaars: '1x' }]) {
    assert.ok(readDetails(details(values)).error);
  }
  const result = readDetails(details({ duur: 'morgen' }));
  assert.equal(result.values.prize, '1 maand Nitro');
  assert.equal(result.values.duration, 'morgen');
});

test('instellingen, upload en gegevens gaan ongewijzigd naar de bestaande publicatie', async () => {
  let published;
  const manager = new GiveawayFormManager({ publish: async (_, settings) => { published = settings; return '✅ Gestart'; } });
  const { id, draft } = await createDraft(manager);
  const attachment = { contentType: 'image/png', size: 1000, url: 'https://cdn.discordapp.com/example.png' };
  const fields = {
    getField: key => ({ values: key === 'kanaal' ? [channelId] : [roleId] }),
    getSelectedChannels: () => new Collection([[channelId, channel]]),
    getUploadedFiles: () => new Collection([['file', attachment]]),
    getStringSelectValues: () => ['no'],
  };
  await manager.handle(interaction('modal', `giveawayform:settings:${id}`, fields));
  // Reopening settings without another upload preserves the chosen image.
  await manager.handle(interaction('modal', `giveawayform:settings:${id}`, { ...fields, getUploadedFiles: () => null }));
  assert.equal(draft.attachment, attachment);
  const publish = interaction('button', `giveawayform:publish:${id}`);
  await manager.handle(publish);
  assert.deepEqual(published, { prize: '1 maand Nitro', duration: '2h', winnerCount: 2, description: 'Voor de community',
    channel, ping: false, pingRole: role, requiredRole: role, attachment });
  assert.equal(manager.drafts.has(id), false);
  assert.deepEqual(publish.calls.at(-1)[1].components, []);
});

test('een formulier kan uitsluitend door de maker en maar één keer worden gepubliceerd', async () => {
  let release;
  let count = 0;
  const waiting = new Promise(resolve => { release = resolve; });
  const manager = new GiveawayFormManager({ publish: async () => { count++; await waiting; return '✅ Gestart'; } });
  const { id } = await createDraft(manager);
  const stranger = interaction('button', `giveawayform:publish:${id}`);
  stranger.user.id = 'someone-else';
  await manager.handle(stranger);
  assert.match(stranger.calls[0][1].content, /iemand anders/);
  const first = manager.handle(interaction('button', `giveawayform:publish:${id}`));
  const duplicate = interaction('button', `giveawayform:publish:${id}`);
  await manager.handle(duplicate);
  assert.match(duplicate.calls[0][1].content, /al gepubliceerd/);
  release();
  await first;
  assert.equal(count, 1);
});

test('verlopen of geannuleerde formulieren starten geen giveaway', async () => {
  let now = 0;
  let count = 0;
  const manager = new GiveawayFormManager({ now: () => now, publish: async () => { count++; return '✅ Gestart'; } });
  const expired = await createDraft(manager);
  now = 31 * 60_000;
  const attempt = interaction('button', `giveawayform:publish:${expired.id}`);
  await manager.handle(attempt);
  assert.match(attempt.calls[0][1].content, /verlopen/);
  const cancelled = await createDraft(manager);
  await manager.handle(interaction('button', `giveawayform:cancel:${cancelled.id}`));
  assert.equal(manager.drafts.has(cancelled.id), false);
  assert.equal(count, 0);
});

test('een geweigerde publicatie houdt het formulier beschikbaar voor correcties', async () => {
  const manager = new GiveawayFormManager({ publish: async () => '❌ Ik mis kanaalrechten' });
  const { id, draft } = await createDraft(manager);
  await manager.handle(interaction('button', `giveawayform:publish:${id}`));
  assert.equal(draft.state, 'editing');
  assert.equal(manager.drafts.has(id), true);
  draft.attachment = { name: 'eigen.png' };
  await manager.handle(interaction('button', `giveawayform:autoimage:${id}`));
  assert.equal(draft.attachment, undefined);
});
