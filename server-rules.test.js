import test from 'node:test';
import assert from 'node:assert/strict';
import { buildServerRulesMessage, serverRules, serverRulesChannelId, serverRulesMarker, syncServerRules } from './server-rules.js';

test('serverregels bevatten alle tien regels, logo en banner', () => {
  const message = buildServerRulesMessage();
  const embed = message.embeds[0].toJSON();
  assert.equal(serverRulesChannelId, '1427785483475222559');
  assert.equal(serverRules.length, 10);
  assert.equal(embed.fields.length, 10);
  assert.equal(embed.fields[0].name, 'Rule #1 — Be Respectful');
  assert.equal(embed.fields[9].name, "Rule #10 — Follow Discord's Rules");
  assert.equal(embed.footer.text, serverRulesMarker);
  assert.equal(embed.thumbnail.url, 'attachment://wesh-lounge.png');
  assert.equal(embed.image.url, 'attachment://server-rules-banner.webp');
  assert.deepEqual(message.files.map(file => file.name), ['wesh-lounge.png', 'server-rules-banner.webp']);
});

test('bestaande serverregels worden bijgewerkt zonder een dubbel bericht', async () => {
  let edits = 0;
  let sends = 0;
  const existing = {
    author: { id: 'bot' }, embeds: [{ footer: { text: serverRulesMarker } }],
    edit: async payload => { edits += 1; assert.equal(payload.embeds.length, 1); },
  };
  const channel = {
    isTextBased: () => true,
    messages: { fetch: async () => new Map([['message', existing]]) },
    permissionsFor: () => ({ has: () => true }),
    send: async () => { sends += 1; },
  };
  const result = await syncServerRules({ user: { id: 'bot' }, channels: { fetch: async id => {
    assert.equal(id, serverRulesChannelId);
    return channel;
  } } });
  assert.equal(result.created, false);
  assert.equal(edits, 1);
  assert.equal(sends, 0);
});
