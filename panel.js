import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { fileURLToPath } from 'node:url';

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

export function buildPanel() {
  const logo = new AttachmentBuilder(fileURLToPath(new URL('./assets/logo.png', import.meta.url)), { name: 'wesh-lounge.png' });
  const embed = new EmbedBuilder()
    .setColor(0x9b3bdb)
    .setTitle('WESH LOUNGE | Kies jouw rollen')
    .setThumbnail('attachment://wesh-lounge.png')
    .setDescription('Kies jouw meldingen en games. Klik op een knop om de rol te claimen; klik opnieuw om hem te verwijderen.')
    .addFields(
      { name: '🔔 Meldingen', value: '🎉 Giveaway-ping\n🎮 Gaming-ping' },
      { name: '🕹️ Game-rollen', value: '⛏️ Minecraft • 🪂 Fortnite • 🚗 FiveM\n🎯 Call of Duty • 🛡️ Rainbow Six Siege\n🚀 Among Us • ⚔️ League of Legends' },
    )
    .setFooter({ text: 'Wesh Lounge • Jij kiest je meldingen • Klik opnieuw om een rol te verwijderen' });
  const components = roleRows.map(row => new ActionRowBuilder().addComponents(
    ...row.map(id => new ButtonBuilder().setCustomId(id).setLabel(roles[id].label)
      .setEmoji(roles[id].emoji).setStyle(ButtonStyle.Primary)),
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
