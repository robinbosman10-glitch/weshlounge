import { AttachmentBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { fileURLToPath } from 'node:url';

export const serverRulesChannelId = '1427785483475222559';
export const serverRulesMarker = 'Wesh Lounge • Server Rules';

export const serverRules = Object.freeze([
  { title: 'Be Respectful', text: "Show respect to everyone in the server. Harassment, bullying, or rude behavior won't be tolerated and may lead to being muted or kicked." },
  { title: 'No Adult Content', text: 'Keep the server safe for everyone. Sharing or discussing adult content is not allowed and will result in immediate action.' },
  { title: 'No Inappropriate Language', text: 'Please keep the chat clean. Avoid using offensive or inappropriate language to ensure a positive environment for all members.' },
  { title: 'No Spamming', text: "Don't flood the chat with repetitive messages, links, or excessive emojis. Spamming disrupts the flow of conversation and may lead to a mute or kick." },
  { title: 'No Advertisements', text: "Promoting your own or others' content without permission is not allowed. This includes sharing links to other servers, businesses, or products." },
  { title: 'Avoid False or Misleading Information', text: "Make sure what you share is accurate. Spreading false or misleading information can cause confusion and harm, and it won't be tolerated." },
  { title: 'No Server Raiding', text: 'Raiding or organizing a raid on this or any other server is strictly prohibited. It will result in an immediate ban from the server.' },
  { title: 'Don’t Share Your Personal Information', text: 'For your own safety, never share personal details like your real name, address, or passwords in the server.' },
  { title: 'Don’t Share Illegal or Pirated Content', text: 'Sharing illegal or pirated content, including software, movies, and music, is not allowed. Doing so may result in being banned.' },
  { title: "Follow Discord's Rules", text: "Make sure to follow Discord's Community Guidelines and Terms of Service. Any violation of Discord’s rules will be handled seriously." },
]);

const logoPath = fileURLToPath(new URL('./assets/logo.png', import.meta.url));
const bannerPath = fileURLToPath(new URL('./assets/server-rules-banner.webp', import.meta.url));

export function buildServerRulesMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x9b3bdb)
    .setAuthor({ name: 'WESH LOUNGE • OFFICIAL RULES', iconURL: 'attachment://wesh-lounge.png' })
    .setTitle('📜 Server Rules')
    .setDescription('Welcome to **Wesh Lounge**. These rules apply everywhere in the server. By staying in the server, you agree to follow them.')
    .addFields(serverRules.map((rule, index) => ({
      name: `Rule #${index + 1} — ${rule.title}`,
      value: rule.text,
      inline: false,
    })))
    .setThumbnail('attachment://wesh-lounge.png')
    .setImage('attachment://server-rules-banner.webp')
    .setFooter({ text: serverRulesMarker })
    .setTimestamp();
  return {
    embeds: [embed],
    files: [
      new AttachmentBuilder(logoPath, { name: 'wesh-lounge.png' }),
      new AttachmentBuilder(bannerPath, { name: 'server-rules-banner.webp' }),
    ],
    allowedMentions: { parse: [] },
  };
}

export async function syncServerRules(client) {
  const channel = await client.channels.fetch(serverRulesChannelId);
  if (!channel?.isTextBased() || !channel.messages) throw new Error('SERVER_RULES_CHANNEL_INVALID');
  const permissions = channel.permissionsFor(client.user);
  const required = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles];
  if (!permissions?.has(required)) throw new Error('SERVER_RULES_PERMISSIONS_MISSING');

  const messages = await channel.messages.fetch({ limit: 100 });
  const existing = [...messages.values()].find(message => message.author.id === client.user.id
    && message.embeds.some(embed => embed.footer?.text === serverRulesMarker));
  const payload = buildServerRulesMessage();
  if (existing) {
    await existing.edit({ ...payload, attachments: [] });
    return { created: false, message: existing };
  }
  return { created: true, message: await channel.send(payload) };
}
