import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const adCommand = new SlashCommandBuilder()
  .setName('ad')
  .setDescription('Plaats een advertentie met een rol, lid en Discord-uitnodiging.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption(o => o.setName('discord-link').setDescription('De Discord-uitnodigingslink').setRequired(true))
  .addRoleOption(o => o.setName('rol').setDescription('De rol die je wilt taggen').setRequired(true))
  .addUserOption(o => o.setName('lid').setDescription('Het lid dat je wilt taggen').setRequired(true));

export function normalizeInvite(input) {
  const match = /^(?:https?:\/\/)?(?:www\.)?(?:discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)([a-zA-Z0-9-]+)\/?$/.exec(input.trim());
  return match ? `https://discord.gg/${match[1]}` : null;
}

export function buildAd(link, roleId, userId) {
  return {
    content: `<@&${roleId}> - <@${userId}>\n\n${link}`,
    allowedMentions: { parse: [], roles: [roleId], users: [userId], repliedUser: false },
  };
}
