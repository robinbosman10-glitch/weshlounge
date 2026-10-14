import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMinecraftStatusMessage, fetchMinecraftStatus, minecraftAddress,
  minecraftStatusChannelId, minecraftStatusMarker, syncMinecraftStatusDashboard,
} from './minecraft-status.js';

const onlineStatus = {
  online: true,
  playersOnline: 7,
  playersMax: 20,
  version: '1.21.4',
  motd: 'Welkom bij de server!',
  retrievedAt: Date.UTC(2026, 9, 14, 18, 30),
};

test('Java-status gebruikt het opgegeven IP en de niet-standaardpoort', async () => {
  let requested;
  const result = await fetchMinecraftStatus(async (url, options) => {
    requested = { url, options };
    return {
      ok: true,
      json: async () => ({
        online: true,
        players: { online: 7, max: 20 },
        version: { name_clean: '1.21.4' },
        motd: { clean: 'Welkom!' },
        retrieved_at: onlineStatus.retrievedAt,
      }),
    };
  });
  assert.match(requested.url, /116\.202\.218\.205%3A3084/);
  assert.equal(requested.options.headers['User-Agent'], 'WeshLoungeDiscordBot/1.0');
  assert.deepEqual(result, { ...onlineStatus, motd: 'Welkom!' });
  assert.equal(minecraftAddress, '116.202.218.205:3084');
});

test('live dashboard toont status, spelers, versie en serveradres', () => {
  const payload = buildMinecraftStatusMessage(onlineStatus);
  const embed = payload.embeds[0].toJSON();
  assert.match(embed.title, /SERVER ONLINE/);
  assert.match(embed.description, /Welkom bij de server/);
  assert.match(embed.fields[0].value, /7 \/ 20/);
  assert.match(embed.fields[0].value, /🟩/);
  assert.match(embed.fields[1].value, /1\.21\.4/);
  assert.match(embed.fields[2].value, /116\.202\.218\.205:3084/);
  assert.ok(embed.thumbnail.url.includes('mcstatus.io'));
  assert.ok(embed.footer.text.startsWith(minecraftStatusMarker));
  assert.deepEqual(payload.allowedMentions, { parse: [] });
});

function fakeClient({ existing = false } = {}) {
  const sent = [];
  const edits = [];
  const message = {
    author: { id: 'bot' },
    embeds: existing ? [{ footer: { text: `${minecraftStatusMarker} • Oud` } }] : [],
    edit: async payload => { edits.push(payload); return message; },
  };
  const channel = {
    isTextBased: () => true,
    permissionsFor: () => ({ has: () => true }),
    messages: { fetch: async () => new Map(existing ? [['message', message]] : []) },
    send: async payload => { sent.push(payload); return { ...message, embeds: payload.embeds }; },
  };
  return {
    client: { user: { id: 'bot' }, channels: { fetch: async id => {
      assert.equal(id, minecraftStatusChannelId);
      return channel;
    } } },
    sent,
    edits,
  };
}

test('dashboard wordt geplaatst en na herstart bijgewerkt zonder duplicaat', async () => {
  const fresh = fakeClient();
  const created = await syncMinecraftStatusDashboard(fresh.client, { statusProvider: async () => onlineStatus });
  assert.equal(created.created, true);
  assert.equal(fresh.sent.length, 1);

  const old = fakeClient({ existing: true });
  const updated = await syncMinecraftStatusDashboard(old.client, { statusProvider: async () => onlineStatus });
  assert.equal(updated.created, false);
  assert.equal(old.sent.length, 0);
  assert.equal(old.edits.length, 1);
});

test('tijdelijke statusfout levert een geel dashboard op in plaats van een crash', async () => {
  const setup = fakeClient();
  const result = await syncMinecraftStatusDashboard(setup.client, {
    statusProvider: async () => { throw new Error('API tijdelijk niet bereikbaar'); },
  });
  assert.equal(result.status.online, null);
  assert.match(setup.sent[0].embeds[0].toJSON().title, /STATUS ONBEKEND/);
});
