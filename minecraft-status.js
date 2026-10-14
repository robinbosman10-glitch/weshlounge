import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export const minecraftAddress = '144.76.87.22:2863';
export const minecraftStatusChannelId = '1558586765034520606';
export const minecraftStatusMarker = 'Wesh Lounge • Minecraft Live Status';
export const minecraftStatusRefreshMs = 60_000;

const apiAddress = encodeURIComponent(minecraftAddress);
const statusEndpoint = `https://api.mcstatus.io/v2/status/java/${apiAddress}?query=false&timeout=5`;
const iconEndpoint = `https://api.mcstatus.io/v2/icon/${apiAddress}?timeout=5`;

let refreshTimer;
let dashboardMessage;
let refreshInProgress = false;

function cleanText(value, fallback = 'Onbekend') {
  if (Array.isArray(value)) value = value.join(' ');
  if (typeof value !== 'string') return fallback;
  const clean = value.replace(/\s+/g, ' ').replaceAll('@', '@\u200b').trim();
  return clean ? clean.slice(0, 1000) : fallback;
}

export async function fetchMinecraftStatus(fetcher = fetch) {
  const response = await fetcher(statusEndpoint, {
    headers: { 'User-Agent': 'WeshLoungeDiscordBot/1.0' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`MINECRAFT_STATUS_HTTP_${response.status}`);
  const data = await response.json();
  if (typeof data?.online !== 'boolean') throw new Error('MINECRAFT_STATUS_INVALID_RESPONSE');

  return {
    online: data.online,
    playersOnline: Number.isInteger(data.players?.online) ? data.players.online : null,
    playersMax: Number.isInteger(data.players?.max) ? data.players.max : null,
    version: cleanText(data.version?.name_clean, 'Onbekend'),
    motd: cleanText(data.motd?.clean, ''),
    retrievedAt: Number.isFinite(data.retrieved_at) ? data.retrieved_at : Date.now(),
  };
}

function playerBar(online, max) {
  if (!Number.isInteger(online) || !Number.isInteger(max) || max <= 0) return '⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛';
  const filled = Math.max(0, Math.min(10, Math.round((online / max) * 10)));
  return `${'🟩'.repeat(filled)}${'⬛'.repeat(10 - filled)}`;
}

export function buildMinecraftStatusMessage(status) {
  const isOnline = status.online === true;
  const isUnknown = status.online == null;
  const online = Number.isInteger(status.playersOnline) ? status.playersOnline : '?';
  const max = Number.isInteger(status.playersMax) ? status.playersMax : '?';
  const stateTitle = isUnknown ? '🟡 STATUS ONBEKEND' : isOnline ? '🟢 SERVER ONLINE' : '🔴 SERVER OFFLINE';
  const stateText = isUnknown
    ? 'De statuscontrole is tijdelijk niet bereikbaar. De bot probeert het automatisch opnieuw.'
    : isOnline ? 'De Minecraft-server is bereikbaar en klaar om te spelen.'
      : 'De Minecraft-server is momenteel niet bereikbaar.';

  const embed = new EmbedBuilder()
    .setColor(isUnknown ? 0xfee75c : isOnline ? 0x57f287 : 0xed4245)
    .setAuthor({ name: 'WESH LOUNGE • MINECRAFT NETWORK' })
    .setTitle(stateTitle)
    .setDescription(`${stateText}${status.motd ? `\n\n> ${status.motd}` : ''}`)
    .setThumbnail(iconEndpoint)
    .addFields(
      { name: '👥 Spelers online', value: isUnknown ? '**Onbekend**' : isOnline ? `**${online} / ${max}**\n${playerBar(status.playersOnline, status.playersMax)}` : '**0 spelers**', inline: false },
      { name: '🎮 Versie', value: isOnline ? `\`${status.version}\`` : '`—`', inline: true },
      { name: '🌐 Serveradres', value: `\`${minecraftAddress}\``, inline: true },
      { name: '🔄 Live updates', value: 'Iedere minuut', inline: true },
    )
    .setFooter({ text: `${minecraftStatusMarker} • Automatisch bijgewerkt` })
    .setTimestamp(status.retrievedAt || Date.now());

  return { embeds: [embed], allowedMentions: { parse: [] } };
}

async function getDashboardChannel(client) {
  const channel = await client.channels.fetch(minecraftStatusChannelId);
  if (!channel?.isTextBased() || !channel.messages) throw new Error('MINECRAFT_STATUS_CHANNEL_INVALID');
  const permissions = channel.permissionsFor(client.user);
  const required = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks];
  if (!permissions?.has(required)) throw new Error('MINECRAFT_STATUS_PERMISSIONS_MISSING');
  return channel;
}

async function statusOrUnknown(statusProvider) {
  try { return await statusProvider(); }
  catch (error) {
    console.error(`Minecraft-status kon niet worden opgehaald: ${error.code ?? error.message}`);
    return { online: null, playersOnline: null, playersMax: null, version: 'Onbekend', motd: '', retrievedAt: Date.now() };
  }
}

export async function syncMinecraftStatusDashboard(client, { statusProvider = fetchMinecraftStatus } = {}) {
  const channel = await getDashboardChannel(client);
  const messages = await channel.messages.fetch({ limit: 100 });
  const existing = [...messages.values()].find(message => message.author.id === client.user.id
    && message.embeds.some(embed => embed.footer?.text?.startsWith(minecraftStatusMarker)));
  const status = await statusOrUnknown(statusProvider);
  const payload = buildMinecraftStatusMessage(status);
  if (existing) {
    await existing.edit(payload);
    return { created: false, message: existing, status };
  }
  return { created: true, message: await channel.send(payload), status };
}

export async function startMinecraftStatusDashboard(client, options = {}) {
  stopMinecraftStatusDashboard();
  const first = await syncMinecraftStatusDashboard(client, options);
  dashboardMessage = first.message;
  const statusProvider = options.statusProvider || fetchMinecraftStatus;
  const refreshMs = options.refreshMs || minecraftStatusRefreshMs;

  refreshTimer = setInterval(async () => {
    if (refreshInProgress) return;
    refreshInProgress = true;
    try {
      if (!dashboardMessage) {
        const restored = await syncMinecraftStatusDashboard(client, { statusProvider });
        dashboardMessage = restored.message;
        return;
      }
      const status = await statusOrUnknown(statusProvider);
      await dashboardMessage.edit(buildMinecraftStatusMessage(status));
    } catch (error) {
      console.error(`Minecraft-dashboard kon niet worden bijgewerkt: ${error.code ?? error.message}`);
      if (error.code === 10008) dashboardMessage = undefined;
    } finally {
      refreshInProgress = false;
    }
  }, refreshMs);
  refreshTimer.unref?.();
  return first;
}

export function stopMinecraftStatusDashboard() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = undefined;
  dashboardMessage = undefined;
  refreshInProgress = false;
}
