import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const roles = Object.freeze({
  'wesh:giveaway': { id: '1516850805322285258', label: 'Giveaway-ping', emoji: '🎉' },
  'wesh:gaming': { id: '1528781954416378027', label: 'Gaming-ping', emoji: '🎮' },
  'wesh:minecraft': { id: '1555695172187062312', label: 'Minecraft', emoji: '⛏️' },
  'wesh:fortnite': { id: '1559535598438580245', label: 'Fortnite', emoji: '🪂' },
  'wesh:fivem': { id: '1559535757310435408', label: 'FiveM', emoji: '🚗' },
  'wesh:callofduty': { id: '559535941675262053', label: 'Call of Duty', emoji: '🎯' },
  'wesh:rainbowsix': { id: '1559536185519640636', label: 'Rainbow Six Siege', emoji: '🛡️' },
  'wesh:amongus': { id: '1559536458333814926', label: 'Among Us', emoji: '🚀' },
  'wesh:leagueoflegends': { id: '1557409898621567157', label: 'League of Legends', emoji: '⚔️' },
});

const roleRows = [
  ['wesh:giveaway', 'wesh:gaming'],
  ['wesh:minecraft', 'wesh:fortnite', 'wesh:fivem', 'wesh:callofduty'],
  ['wesh:rainbowsix', 'wesh:amongus', 'wesh:leagueoflegends'],
];

export const command = new SlashCommandBuilder()
  .setName('rollenpaneel')
  .setDescription('Plaats het Wesh Lounge rollenpaneel in dit kanaal.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const emojiSegmenter = new Intl.Segmenter('nl', { granularity: 'grapheme' });

function emojiFromRoleName(name) {
  const trimmed = name?.trimStart();
  if (!trimmed) return null;
  const custom = trimmed.match(/^<(a?):([\w~]+):(\d+)>/);
  if (custom) return { animated: custom[1] === 'a', name: custom[2], id: custom[3] };
  const first = emojiSegmenter.segment(trimmed)[Symbol.iterator]().next().value?.segment;
  return first && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(first) ? first : null;
}

export function roleEmoji(role, fallback) {
  return role?.unicodeEmoji || emojiFromRoleName(role?.name) || fallback;
}

function customEmojiData(emoji) {
  return { animated: Boolean(emoji.animated), name: emoji.name, id: emoji.id };
}

function roleIconEmojiName(role) {
  const iconPart = role.icon.replace(/[^a-z\d]/gi, '').slice(0, 8).toLowerCase();
  return `wr2_${role.id}_${iconPart}`;
}

function panelError(message, code, cause) {
  return Object.assign(new Error(message, { cause }), { code, userMessage: `❌ ${message}` });
}

async function transparentRoleIcon(url, fetchIcon) {
  const response = await fetchIcon(url);
  if (!response.ok) throw new Error(`ROLE_ICON_DOWNLOAD_${response.status}`);
  const source = Buffer.from(await response.arrayBuffer());
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  let head = 0;
  let tail = 0;
  let alreadyTransparent = false;
  const channels = info.channels;
  const pixelOffset = pixel => pixel * channels;
  const isWhiteBackground = pixel => {
    const offset = pixelOffset(pixel);
    if (data[offset + 3] < 240) {
      alreadyTransparent = true;
      return false;
    }
    return data[offset] >= 215 && data[offset + 1] >= 215 && data[offset + 2] >= 215;
  };
  const enqueue = pixel => {
    if (visited[pixel] || !isWhiteBackground(pixel)) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }
  for (let y = 1; y < info.height - 1; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }

  // Een afbeelding die al transparantie heeft hoeft niet opnieuw uitgeknipt te worden.
  if (!alreadyTransparent) {
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % info.width;
      const y = Math.floor(pixel / info.width);
      if (x > 0) enqueue(pixel - 1);
      if (x + 1 < info.width) enqueue(pixel + 1);
      if (y > 0) enqueue(pixel - info.width);
      if (y + 1 < info.height) enqueue(pixel + info.width);
    }
    for (let pixel = 0; pixel < pixels; pixel += 1) {
      if (!visited[pixel]) continue;
      const offset = pixelOffset(pixel);
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }

  return sharp(data, { raw: info })
    .resize({ width: 128, height: 128, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function roleIconEmojis(guild, guildRoles, fetchIcon) {
  const iconRoles = [...new Set(Object.values(roles).map(choice => guildRoles?.get(choice.id))
    .filter(role => role?.icon))];
  if (!iconRoles.length) return new Map();

  const me = guild.members.me || await guild.members.fetchMe();
  if (!me.permissions.any(PermissionFlagsBits.CreateGuildExpressions | PermissionFlagsBits.ManageGuildExpressions)) {
    throw panelError('Geef de bot **Expressies maken** zodat ik de rolafbeeldingen exact op de knoppen kan zetten.', 'ROLE_ICON_EMOJI_PERMISSION');
  }

  let guildEmojis;
  try { guildEmojis = await guild.emojis.fetch(); }
  catch (error) {
    throw panelError('Ik kon de serveremoji\'s niet ophalen. Controleer mijn rechten en probeer opnieuw.', 'ROLE_ICON_EMOJI_FETCH', error);
  }

  const result = new Map();
  for (const role of iconRoles) {
    const name = roleIconEmojiName(role);
    let emoji = [...guildEmojis.values()].find(candidate => candidate.name === name);
    if (!emoji) {
      try {
        emoji = await guild.emojis.create({
          attachment: await transparentRoleIcon(role.iconURL({ extension: 'png', size: 128 }), fetchIcon),
          name,
          reason: `Wesh Lounge rollenpaneel: icoon van ${role.name}`,
        });
        guildEmojis.set(emoji.id, emoji);
      } catch (error) {
        const slots = error.code === 30008 || error.code === 30018
          ? ' Er zijn geen vrije serveremoji-plaatsen meer.' : '';
        throw panelError(`De rolafbeelding van **${role.name}** kon niet als serveremoji worden aangemaakt.${slots}`, 'ROLE_ICON_EMOJI_CREATE', error);
      }
    }
    result.set(role.id, customEmojiData(emoji));
  }
  return result;
}

function emojiText(emoji) {
  if (typeof emoji === 'string') return emoji;
  return `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`;
}

export async function buildPanel(guild, { fetchIcon = fetch } = {}) {
  let guildRoles = guild?.roles?.cache;
  if (guild) {
    try { guildRoles = await guild.roles.fetch(); }
    catch { /* Gebruik de cache en daarna de vaste reserve-emoji. */ }
  }
  const iconEmojis = guild ? await roleIconEmojis(guild, guildRoles, fetchIcon) : new Map();
  const emojis = Object.fromEntries(Object.entries(roles).map(([key, choice]) => [
    key,
    iconEmojis.get(choice.id) || roleEmoji(guildRoles?.get(choice.id), choice.emoji),
  ]));
  const roleLine = key => `${emojiText(emojis[key])} ${roles[key].label}`;
  const logo = new AttachmentBuilder(fileURLToPath(new URL('./assets/logo.png', import.meta.url)), { name: 'wesh-lounge.png' });
  const embed = new EmbedBuilder()
    .setColor(0x9b3bdb)
    .setTitle('WESH LOUNGE | Kies jouw rollen')
    .setThumbnail('attachment://wesh-lounge.png')
    .setDescription('Kies jouw meldingen en games. Klik op een knop om de rol te claimen; klik opnieuw om hem te verwijderen.')
    .addFields(
      { name: '🔔 Meldingen', value: `${roleLine('wesh:giveaway')}\n${roleLine('wesh:gaming')}` },
      { name: '🕹️ Game-rollen', value: `${roleLine('wesh:minecraft')} • ${roleLine('wesh:fortnite')} • ${roleLine('wesh:fivem')}\n${roleLine('wesh:callofduty')} • ${roleLine('wesh:rainbowsix')}\n${roleLine('wesh:amongus')} • ${roleLine('wesh:leagueoflegends')}` },
    )
    .setFooter({ text: 'Wesh Lounge • Jij kiest je meldingen • Klik opnieuw om een rol te verwijderen' });
  const components = roleRows.map(row => new ActionRowBuilder().addComponents(
    ...row.map(id => new ButtonBuilder().setCustomId(id).setLabel(roles[id].label)
      .setEmoji(emojis[id]).setStyle(ButtonStyle.Primary)),
  ));
  return { embeds: [embed], components, files: [logo], allowedMentions: { parse: [] } };
}

export async function toggleRole(guild, userId, choice) {
  const [role, me, member] = await Promise.all([
    guild.roles.fetch(choice.id), guild.members.fetchMe({ force: true }),
    guild.members.fetch({ user: userId, force: true }),
  ]);
  if (!role) return '❌ Deze rol bestaat niet in deze server. Vraag een beheerder om dit te controleren.';
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles) || role.managed || me.roles.highest.comparePositionTo(role) <= 0) {
    return '❌ Ik kan deze rol nog niet beheren. Een beheerder moet mij Rollen beheren geven en mijn botrol boven de gekozen rollen zetten.';
  }
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role.id, 'Wesh Lounge: rol verwijderd via rollenpaneel');
    return `✅ Je hebt **${choice.label}** verwijderd.`;
  }
  await member.roles.add(role.id, 'Wesh Lounge: rol geclaimd via rollenpaneel');
  return `✅ Je hebt **${choice.label}** ontvangen!`;
}
