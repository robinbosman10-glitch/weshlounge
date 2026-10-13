import { PermissionFlagsBits } from 'discord.js';

export const memberTagChannelId = '1555192509209124935';
export const memberTagRoleId = '1427788437297172622';

export async function sendMemberTagOnce(client) {
  const channel = await client.channels.fetch(memberTagChannelId);
  if (!channel?.isTextBased() || !channel.messages || !channel.guild) throw new Error('MEMBER_TAG_CHANNEL_INVALID');
  const role = await channel.guild.roles.fetch(memberTagRoleId);
  if (!role) throw new Error('MEMBER_TAG_ROLE_MISSING');
  const permissions = channel.permissionsFor(client.user);
  const required = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];
  if (!permissions?.has(required)) throw new Error('MEMBER_TAG_PERMISSIONS_MISSING');
  if (!role.mentionable && !permissions.has(PermissionFlagsBits.MentionEveryone)) {
    throw new Error('MEMBER_TAG_ROLE_NOT_MENTIONABLE');
  }

  const content = `<@&${memberTagRoleId}>`;
  const messages = await channel.messages.fetch({ limit: 100 });
  const existing = [...messages.values()].find(message => message.author.id === client.user.id
    && message.content.trim() === content);
  if (existing) return { sent: false, message: existing };
  return {
    sent: true,
    message: await channel.send({ content, allowedMentions: { parse: [], roles: [memberTagRoleId] } }),
  };
}
