import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { fileURLToPath } from 'node:url';

export const roles = Object.freeze({
  'wesh:giveaway': { id: '1516850805322285258', label: 'Giveaway-ping', emoji: '🎉' },
  'wesh:gaming': { id: '1528781954416378027', label: 'Gaming-ping', emoji: '🎮' },
});

export const command = new SlashCommandBuilder()
  .setName('rollenpaneel')
  .setDescription('Plaats het Wesh Lounge rollenpaneel in dit kanaal.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export function buildPanel() {
  const logo = new AttachmentBuilder(fileURLToPath(new URL('./assets/logo.png', import.meta.url)), { name: 'wesh-lounge.png' });
  const embed = new EmbedBuilder()
    .setColor(0x9b3bdb)
    .setTitle('WESH LOUNGE | Kies jouw meldingen')
    .setThumbnail('attachment://wesh-lounge.png')
    .setDescription('Blijf op de hoogte van wat jij leuk vindt.\nKlik hieronder op een knop om jouw rol te claimen!')
    .addFields(
      { name: '🎉 Giveaway-ping', value: 'Ontvang een melding bij nieuwe giveaways. Doe mee en maak kans op mooie prijzen!' },
      { name: '🎮 Gaming-ping', value: 'Ontvang een melding voor gaming en samen spelen met de community.' },
    )
    .setFooter({ text: 'Wesh Lounge • Jij kiest je meldingen • Klik opnieuw om een rol te verwijderen' });
  const row = new ActionRowBuilder().addComponents(
    ...Object.entries(roles).map(([id, role]) => new ButtonBuilder()
      .setCustomId(id).setLabel(role.label).setEmoji(role.emoji).setStyle(ButtonStyle.Primary)),
  );
  return { embeds: [embed], components: [row], files: [logo], allowedMentions: { parse: [] } };
}

export async function toggleRole(guild, userId, choice) {
  const [role, me, member] = await Promise.all([
    guild.roles.fetch(choice.id), guild.members.fetchMe({ force: true }),
    guild.members.fetch({ user: userId, force: true }),
  ]);
  if (!role) return '❌ Deze rol bestaat niet in deze server. Vraag een beheerder om dit te controleren.';
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles) || role.managed || me.roles.highest.comparePositionTo(role) <= 0) {
    return '❌ Ik kan deze rol nog niet beheren. Een beheerder moet mij Rollen beheren geven en mijn botrol boven de pingrollen zetten.';
  }
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role.id, 'Wesh Lounge: rol verwijderd via rollenpaneel');
    return `✅ Je hebt **${choice.label}** verwijderd.`;
  }
  await member.roles.add(role.id, 'Wesh Lounge: rol geclaimd via rollenpaneel');
  return `✅ Je hebt **${choice.label}** ontvangen!`;
}
