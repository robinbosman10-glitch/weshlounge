import test from 'node:test';
import assert from 'node:assert/strict';
import { adCommand, buildAd, normalizeInvite } from './ad.js';

test('advertentie is gewone tekst en pingt alleen de gekozen rol en gebruiker', () => {
  const ad = buildAd('https://discord.gg/test', '123', '456');
  assert.equal(ad.content, '<@&123> - <@456>\n\nhttps://discord.gg/test');
  assert.equal(ad.embeds, undefined);
  assert.deepEqual(ad.allowedMentions, { parse: [], roles: ['123'], users: ['456'], repliedUser: false });
  assert.equal(adCommand.toJSON().default_member_permissions, '8');
  assert.equal(adCommand.toJSON().options.length, 3);
});
test('alleen Discord-uitnodigingen toegestaan; extra tekst en mentions afgewezen', () => {
  for (const value of ['discord.gg/Test-123', 'https://discord.com/invite/Test-123', 'https://discordapp.com/invite/Test-123/']) {
    assert.equal(normalizeInvite(value), 'https://discord.gg/Test-123');
  }
  for (const value of ['https://example.com/test', 'https://discord.gg.evil.com/test', 'https://discord.gg/test\n@everyone', 'https://discord.com/channels/123']) {
    assert.equal(normalizeInvite(value), null);
  }
});
