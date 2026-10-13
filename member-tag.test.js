import test from 'node:test';
import assert from 'node:assert/strict';
import { memberTagChannelId, memberTagRoleId, sendMemberTagOnce } from './member-tag.js';

function mockClient({ existing = false } = {}) {
  const sent = [];
  const content = `<@&${memberTagRoleId}>`;
  const messages = existing ? new Map([['old', { author: { id: 'bot' }, content }]]) : new Map();
  const channel = {
    isTextBased: () => true,
    guild: { roles: { fetch: async id => ({ id, mentionable: true }) } },
    permissionsFor: () => ({ has: () => true }),
    messages: { fetch: async () => messages },
    send: async payload => { sent.push(payload); return payload; },
  };
  return {
    client: { user: { id: 'bot' }, channels: { fetch: async id => {
      assert.equal(id, memberTagChannelId);
      return channel;
    } } },
    sent,
  };
}

test('eenmalige membertag pingt uitsluitend de opgegeven rol', async () => {
  const { client, sent } = mockClient();
  const result = await sendMemberTagOnce(client);
  assert.equal(result.sent, true);
  assert.equal(sent[0].content, '<@&1427788437297172622>');
  assert.deepEqual(sent[0].allowedMentions, { parse: [], roles: ['1427788437297172622'] });
});

test('de membertag wordt bij een herstart niet dubbel verstuurd', async () => {
  const { client, sent } = mockClient({ existing: true });
  const result = await sendMemberTagOnce(client);
  assert.equal(result.sent, false);
  assert.equal(sent.length, 0);
});
