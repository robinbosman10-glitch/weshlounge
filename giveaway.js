import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType,
  EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder,
} from 'discord.js';
import { randomInt, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { renderGiveawayBanner, themeForPrize } from './giveaway-banner.js';
import { GiveawayStore } from './giveaway-store.js';

const logoPath = fileURLToPath(new URL('./assets/logo.png', import.meta.url));
const defaultGiveawayPingRoleId = '1516850805322285258';
const store = new GiveawayStore();
const locks = new Map();
let scheduler;

export const giveawayCommand = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Start een custom Wesh Lounge-giveaway.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option => option.setName('prijs').setDescription('Wat geef je weg?').setRequired(true).setMaxLength(80))
  .addStringOption(option => option.setName('duur').setDescription('Bijvoorbeeld: 30m, 2h, 3d of 1w').setRequired(true).setMaxLength(30))
  .addIntegerOption(option => option.setName('winnaars').setDescription('Aantal winnaars (standaard 1)').setMinValue(1).setMaxValue(20))
  .addStringOption(option => option.setName('beschrijving').setDescription('Extra tekst onder de titel').setMaxLength(500))
  .addChannelOption(option => option.setName('kanaal').setDescription('Kanaal waarin de giveaway komt')
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
  .addRoleOption(option => option.setName('pingrol').setDescription('Rol die bij de giveaway wordt gepingd'))
  .addRoleOption(option => option.setName('vereisterol').setDescription('Rol die deelnemers verplicht nodig hebben'))
  .addBooleanOption(option => option.setName('ping').setDescription('Giveaway-ping versturen? Standaard: ja'))
  .addAttachmentOption(option => option.setName('afbeelding').setDescription('Optionele eigen achtergrond voor de giveaway-banner'));

export const giveawayStopCommand = new SlashCommandBuilder()
  .setName('giveawaystop')
  .setDescription('Annuleer een giveaway direct zonder winnaar te loten.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(option => option.setName('berichtid').setDescription('Bericht-ID of berichtlink; leeg = nieuwste giveaway in dit kanaal'));

export function parseDuration(input) {
  const units = {
    s: 1_000, sec: 1_000, seconde: 1_000, seconden: 1_000,
    m: 60_000, min: 60_000, minuut: 60_000, minuten: 60_000,
    h: 3_600_000, uur: 3_600_000, uren: 3_600_000,
    d: 86_400_000, dag: 86_400_000, dagen: 86_400_000,
    w: 604_800_000, week: 604_800_000, weken: 604_800_000,
  };
  let total = 0;
  let consumed = '';
  const value = input.toLocaleLowerCase('nl-NL').trim();
  const expression = /(\d+)\s*(seconden?|sec|s|minuten?|min|m|uren?|uur|h|dagen?|dag|d|weken?|week|w)/g;
  for (const match of value.matchAll(expression)) {
    total += Number(match[1]) * units[match[2]];
    consumed += match[0];
  }
  const compactInput = value.replaceAll(/\s|,/g, '');
  const compactConsumed = consumed.replaceAll(/\s|,/g, '');
  if (!total || compactInput !== compactConsumed || total < 60_000 || total > 90 * 86_400_000) return null;
  return total;
}

export function pickWinners(participants, amount, excluded = []) {
  let pool = [...new Set(participants)].filter(id => !excluded.includes(id));
  if (pool.length < amount) pool = [...new Set(participants)];
  const winners = [];
  while (pool.length && winners.length < amount) winners.push(pool.splice(randomInt(pool.length), 1)[0]);
  return winners;
}

function colorFor(prize) {
  return Number.parseInt(themeForPrize(prize).start.slice(1), 16);
}

export function buildGiveawayEmbed(giveaway) {
  const active = giveaway.status === 'active';
  const ended = giveaway.status === 'ended';
  const cancelled = giveaway.status === 'cancelled';
  const endsAt = Math.floor(giveaway.endsAt / 1_000);
  const endValue = active ? `<t:${endsAt}:R>\n<t:${endsAt}:F>`
    : `<t:${Math.floor((giveaway.endedAt || giveaway.stoppedAt || giveaway.endsAt) / 1_000)}:F>`;
  const winners = ended && giveaway.winnerIds?.length
    ? giveaway.winnerIds.map(id => `<@${id}>`).join(', ')
    : ended ? 'Geen geldige deelnemers' : cancelled ? 'Niet geloot' : String(giveaway.winnerCount);
  const embed = new EmbedBuilder()
    .setColor(colorFor(giveaway.prize))
    .setAuthor({ name: 'WESH LOUNGE • GIVEAWAY', iconURL: 'attachment://wesh-lounge.png' })
    .setTitle(`${active ? '🎁' : ended ? '🏆' : '🛑'} ${active ? giveaway.prize : ended ? `AFGELOP • ${giveaway.prize}` : `GESTOPT • ${giveaway.prize}`}`)
    .setDescription(giveaway.description || 'Een cadeau voor de community. Doe mee en pak jouw kans!')
    .addFields(
      { name: '🏆 PRIJS', value: giveaway.prize, inline: true },
      { name: '👥 DEELNEMERS', value: String(giveaway.participants.length), inline: true },
      { name: ended ? '🎊 WINNAAR(S)' : '🎟 WINNAARS', value: winners, inline: true },
      { name: active ? '⏳ EINDIGT' : ended ? '✅ BEËINDIGD' : '🛑 GESTOPT', value: endValue, inline: true },
      { name: '🎙 HOST', value: `<@${giveaway.hostId}>`, inline: true },
      { name: '🔐 VOORWAARDE', value: giveaway.requiredRoleId ? `<@&${giveaway.requiredRoleId}>` : 'Iedereen kan meedoen', inline: true },
    )
    .setImage('attachment://wesh-giveaway.png')
    .setThumbnail('attachment://wesh-lounge.png')
    .setFooter({ text: `Wesh Lounge • ${active ? 'Winnaar wordt automatisch geloot' : ended ? 'Giveaway afgelopen' : 'Giveaway zonder trekking gestopt'} • ID ${giveaway.id}` })
    .setTimestamp(giveaway.createdAt);
  return embed;
}

export function buildGiveawayButtons(giveaway) {
  const active = giveaway.status === 'active';
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`giveaway:join:${giveaway.id}`).setLabel('Deelnemen').setEmoji('🎉')
      .setStyle(ButtonStyle.Primary).setDisabled(!active),
    new ButtonBuilder().setCustomId(`giveaway:list:${giveaway.id}`).setLabel(`Deelnemers • ${giveaway.participants.length}`).setEmoji('👥')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`giveaway:leave:${giveaway.id}`).setLabel('Verlaten').setEmoji('↩️')
      .setStyle(ButtonStyle.Secondary).setDisabled(!active),
  )];
}

async function readCustomBackground(attachment) {
  if (!attachment) return undefined;
  if (!attachment.contentType?.startsWith('image/') || attachment.size > 10 * 1024 * 1024) {
    throw new Error('CUSTOM_IMAGE_INVALID');
  }
  const response = await fetch(attachment.url);
  if (!response.ok) throw new Error('CUSTOM_IMAGE_DOWNLOAD');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024) throw new Error('CUSTOM_IMAGE_INVALID');
  return buffer;
}

function requiredChannelPermissions(channel) {
  return [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory];
}

export function parseMessageReference(raw) {
  if (!raw) return undefined;
  const value = raw.trim();
  if (/^\d{17,20}$/.test(value)) return value;
  return value.match(/^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/\d{17,20}\/\d{17,20}\/(\d{17,20})\/?$/)?.[1];
}

function findGiveaway(interaction, raw, status) {
  const messageId = parseMessageReference(raw);
  let found = messageId ? (store.findByMessage(messageId) || store.get(messageId)) : undefined;
  if (raw && !found) return null;
  if (!raw && !found) {
    found = store.all().filter(item => item.guildId === interaction.guildId && item.channelId === interaction.channelId
      && (!status || item.status === status)).sort((a, b) => b.createdAt - a.createdAt)[0];
  }
  if (!found || found.guildId !== interaction.guildId || (status && found.status !== status)) return null;
  return found;
}

async function fetchGiveawayMessage(client, giveaway) {
  const channel = await client.channels.fetch(giveaway.channelId);
  if (!channel?.isTextBased()) throw new Error('GIVEAWAY_CHANNEL_MISSING');
  return { channel, message: await channel.messages.fetch(giveaway.messageId) };
}

async function refreshGiveawayMessage(client, giveaway) {
  const { message } = await fetchGiveawayMessage(client, giveaway);
  await message.edit({ embeds: [buildGiveawayEmbed(giveaway)], components: buildGiveawayButtons(giveaway), allowedMentions: { parse: [] } });
}

async function withLock(id, work) {
  const previous = locks.get(id) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  const queued = previous.then(() => current);
  locks.set(id, queued);
  await previous;
  try { return await work(); }
  finally {
    release();
    if (locks.get(id) === queued) locks.delete(id);
  }
}

export async function startGiveaway(interaction) {
  const duration = parseDuration(interaction.options.getString('duur', true));
  if (!duration) return '❌ Gebruik een duur van 1 minuut t/m 90 dagen, bijvoorbeeld `30m`, `2h`, `3d` of `1w`.';
  const channel = interaction.options.getChannel('kanaal') || interaction.channel;
  if (!channel?.isTextBased() || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
    return '❌ Kies een gewoon tekst- of aankondigingskanaal.';
  }
  const permissions = channel.permissionsFor(interaction.guild.members.me);
  if (!permissions?.has(requiredChannelPermissions(channel))) {
    return '❌ Ik mis in dat kanaal: bekijken, berichten sturen, geschiedenis lezen, embeds plaatsen of bestanden toevoegen.';
  }
  const shouldPing = interaction.options.getBoolean('ping') ?? true;
  const selectedPingRole = interaction.options.getRole('pingrol');
  const pingRole = shouldPing
    ? selectedPingRole || await interaction.guild.roles.fetch(defaultGiveawayPingRoleId).catch(() => null)
    : null;
  if (pingRole?.id === interaction.guildId) return '❌ Kies een specifieke pingrol in plaats van @everyone.';
  if (pingRole && !pingRole.mentionable && !permissions.has(PermissionFlagsBits.MentionEveryone)) {
    return '❌ Ik kan de gekozen pingrol niet vermelden. Maak hem vermeldbaar of geef de bot toestemming om rollen te vermelden.';
  }
  const attachment = interaction.options.getAttachment('afbeelding');
  let customBackground;
  try { customBackground = await readCustomBackground(attachment); }
  catch { return '❌ De eigen afbeelding moet een geldige afbeelding van maximaal 10 MB zijn.'; }
  const prize = interaction.options.getString('prijs', true).trim();
  const winnerCount = interaction.options.getInteger('winnaars') || 1;
  const requiredRole = interaction.options.getRole('vereisterol');
  if (requiredRole?.id === interaction.guildId) return '❌ Kies een specifieke vereiste rol of laat die optie leeg.';
  const giveaway = {
    id: randomUUID().replaceAll('-', '').slice(0, 12),
    guildId: interaction.guildId,
    channelId: channel.id,
    messageId: null,
    prize,
    description: interaction.options.getString('beschrijving')?.trim() || null,
    hostId: interaction.user.id,
    requiredRoleId: requiredRole?.id || null,
    pingRoleId: pingRole?.id || null,
    winnerCount,
    participants: [],
    winnerIds: [],
    status: 'active',
    createdAt: Date.now(),
    endsAt: Date.now() + duration,
  };
  const banner = await renderGiveawayBanner({ prize, winners: winnerCount, customBackground });
  const payload = {
    embeds: [buildGiveawayEmbed(giveaway)],
    components: buildGiveawayButtons(giveaway),
    files: [new AttachmentBuilder(banner, { name: 'wesh-giveaway.png' }), new AttachmentBuilder(logoPath, { name: 'wesh-lounge.png' })],
    allowedMentions: pingRole ? { parse: [], roles: [pingRole.id] } : { parse: [] },
  };
  if (pingRole) payload.content = `<@&${pingRole.id}>`;
  const message = await channel.send(payload);
  giveaway.messageId = message.id;
  try { await store.set(giveaway); }
  catch (error) { await message.delete().catch(() => {}); throw error; }
  return `✅ Giveaway gestart in ${channel}! ${message.url}`;
}

async function endGiveaway(client, giveaway, endedBy = 'automatisch') {
  return withLock(giveaway.id, async () => {
    const current = store.get(giveaway.id);
    if (!current || current.status !== 'active') return { alreadyEnded: true, giveaway: current };
    current.status = 'ended';
    current.endedAt = Date.now();
    current.endedBy = endedBy;
    current.winnerIds = pickWinners(current.participants, current.winnerCount);
    await store.set(current);
    let channel;
    try {
      ({ channel } = await fetchGiveawayMessage(client, current));
      await refreshGiveawayMessage(client, current);
    } catch (error) {
      console.error(`Giveawaybericht ${current.messageId} kon niet worden bijgewerkt: ${error.code ?? error.message}`);
      return { giveaway: current, messageMissing: true };
    }
    const winnerText = current.winnerIds.length
      ? `🎉 Gefeliciteerd ${current.winnerIds.map(id => `<@${id}>`).join(', ')}! Jullie winnen **${current.prize}**. Neem contact op met <@${current.hostId}>.`
      : `😢 De giveaway voor **${current.prize}** is afgelopen zonder geldige deelnemers.`;
    await channel.send({ content: winnerText, allowedMentions: { parse: [], users: [...current.winnerIds, current.hostId] } });
    return { giveaway: current };
  });
}

export async function stopGiveaway(interaction, client) {
  const giveaway = findGiveaway(interaction, interaction.options.getString('berichtid'), 'active');
  if (!giveaway) return '❌ Geen actieve giveaway gevonden. Gebruik het commando in het giveaway-kanaal of vul een bericht-ID/link in.';
  return withLock(giveaway.id, async () => {
    const current = store.get(giveaway.id);
    if (!current || current.status !== 'active') return '❌ Deze giveaway is al afgelopen of gestopt.';
    current.status = 'cancelled';
    current.stoppedAt = Date.now();
    current.stoppedBy = interaction.user.id;
    current.winnerIds = [];
    await store.set(current);
    try { await refreshGiveawayMessage(client, current); }
    catch (error) {
      console.error(`Gestopt giveawaybericht ${current.messageId} kon niet worden bijgewerkt: ${error.code ?? error.message}`);
      return '⚠️ De giveaway is zonder winnaar gestopt, maar het originele bericht bestaat niet meer.';
    }
    return '✅ De hele giveaway is gestopt. Er is geen winnaar geloot.';
  });
}

export function isGiveawayButton(interaction) {
  return interaction.isButton() && interaction.customId.startsWith('giveaway:');
}

export async function handleGiveawayButton(interaction, client) {
  const [, action, id] = interaction.customId.split(':');
  const giveaway = store.get(id);
  if (!giveaway || giveaway.guildId !== interaction.guildId) return '❌ Deze giveaway bestaat niet meer.';
  if (action === 'list') {
    if (!giveaway.participants.length) return '👥 Er doet nog niemand mee.';
    const shown = giveaway.participants.slice(0, 50).map((userId, index) => `${index + 1}. <@${userId}>`).join('\n');
    const remaining = giveaway.participants.length - 50;
    return `👥 **Deelnemers (${giveaway.participants.length})**\n${shown}${remaining > 0 ? `\n…en nog ${remaining} anderen.` : ''}`;
  }
  if (giveaway.status === 'active' && Date.now() >= giveaway.endsAt) {
    await endGiveaway(client, giveaway);
    return '⏳ Deze giveaway is inmiddels afgelopen.';
  }
  return withLock(id, async () => {
    const current = store.get(id);
    if (current.status !== 'active' || Date.now() >= current.endsAt) {
      return '⏳ Deze giveaway is inmiddels afgelopen.';
    }
    const index = current.participants.indexOf(interaction.user.id);
    if (action === 'join') {
      if (interaction.user.bot) return '❌ Bots kunnen niet deelnemen.';
      if (index !== -1) return 'ℹ️ Je doet al mee aan deze giveaway.';
      const member = await interaction.guild.members.fetch(interaction.user.id);
      if (current.requiredRoleId && !member.roles.cache.has(current.requiredRoleId)) {
        return `❌ Je hebt <@&${current.requiredRoleId}> nodig om mee te doen.`;
      }
      current.participants.push(interaction.user.id);
      await store.set(current);
      await refreshGiveawayMessage(client, current);
      return `🎉 Je doet mee voor **${current.prize}**! Veel succes.`;
    }
    if (action === 'leave') {
      if (index === -1) return 'ℹ️ Je deed nog niet mee aan deze giveaway.';
      current.participants.splice(index, 1);
      await store.set(current);
      await refreshGiveawayMessage(client, current);
      return '↩️ Je deelname is verwijderd.';
    }
    return '❌ Onbekende giveaway-knop.';
  });
}

export async function initializeGiveaways(client) {
  await store.load();
  const processExpired = async () => {
    const due = store.all().filter(item => item.status === 'active' && item.endsAt <= Date.now());
    for (const giveaway of due) await endGiveaway(client, giveaway).catch(error =>
      console.error(`Automatisch beëindigen mislukt voor ${giveaway.id}: ${error.code ?? error.message}`));
  };
  await processExpired();
  clearInterval(scheduler);
  scheduler = setInterval(processExpired, 15_000);
  scheduler.unref?.();
}

export function stopGiveawayScheduler() {
  clearInterval(scheduler);
}
