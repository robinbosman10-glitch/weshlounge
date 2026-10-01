import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType,
  EmbedBuilder, FileUploadBuilder, LabelBuilder, MessageFlags, ModalBuilder,
  PermissionFlagsBits, RoleSelectMenuBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} from 'discord.js';
import { randomUUID } from 'node:crypto';
import { parseDuration, startGiveaway } from './giveaway.js';

const prefix = 'giveawayform:';
const lifetime = 30 * 60_000;

export function isGiveawayFormInteraction(interaction) {
  return (interaction.isChatInputCommand() && interaction.commandName === 'giveaway')
    || ((interaction.isButton() || interaction.isModalSubmit()) && interaction.customId.startsWith(prefix));
}

function input(id, label, placeholder, maxLength, value, required = true, style = TextInputStyle.Short) {
  const field = new TextInputBuilder().setCustomId(id).setStyle(style).setRequired(required)
    .setMaxLength(maxLength).setPlaceholder(placeholder);
  if (value) field.setValue(value);
  return new LabelBuilder().setLabel(label).setTextInputComponent(field);
}

export function buildDetailsModal(draft) {
  return new ModalBuilder().setCustomId(`${prefix}details:${draft.id}`).setTitle('Wesh Lounge • Giveaway')
    .addLabelComponents(
      input('prijs', 'Wat geef je weg?', 'Bijvoorbeeld: 1 maand Discord Nitro', 80, draft.prize),
      input('duur', 'Hoe lang duurt de giveaway?', 'Bijvoorbeeld: 30m, 2h, 3d of 1w', 30, draft.duration),
      input('winnaars', 'Aantal winnaars', '1 tot en met 20', 2, draft.winners || '1'),
      input('beschrijving', 'Beschrijving (optioneel)', 'Extra informatie voor deelnemers', 500, draft.description, false, TextInputStyle.Paragraph),
    );
}

export function buildSettingsModal(draft) {
  const channel = new ChannelSelectMenuBuilder().setCustomId('kanaal').setPlaceholder('Huidige kanaal')
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(0).setMaxValues(1).setRequired(false);
  if (draft.channelId && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(draft.channelType)) {
    channel.setDefaultChannels(draft.channelId);
  }
  const pingRole = new RoleSelectMenuBuilder().setCustomId('pingrol').setPlaceholder('Standaard: Giveaway-ping')
    .setMinValues(0).setMaxValues(1).setRequired(false);
  if (draft.pingRoleId) pingRole.setDefaultRoles(draft.pingRoleId);
  const requiredRole = new RoleSelectMenuBuilder().setCustomId('vereisterol').setPlaceholder('Iedereen kan meedoen')
    .setMinValues(0).setMaxValues(1).setRequired(false);
  if (draft.requiredRoleId) requiredRole.setDefaultRoles(draft.requiredRoleId);
  const ping = new StringSelectMenuBuilder().setCustomId('ping').setMinValues(1).setMaxValues(1)
    .setRequired(true).addOptions(
      { label: 'Ja, ping de gekozen rol', value: 'yes', default: draft.ping !== false },
      { label: 'Nee, geen ping', value: 'no', default: draft.ping === false },
    );
  return new ModalBuilder().setCustomId(`${prefix}settings:${draft.id}`).setTitle('Giveaway • Extra instellingen')
    .addLabelComponents(
      new LabelBuilder().setLabel('Kanaal').setDescription('Laat leeg voor het kanaal waarin je /giveaway gebruikt.').setChannelSelectMenuComponent(channel),
      new LabelBuilder().setLabel('Rol om te pingen').setDescription('Laat leeg voor de standaard Giveaway-ping.').setRoleSelectMenuComponent(pingRole),
      new LabelBuilder().setLabel('Vereiste rol (optioneel)').setDescription('Laat leeg als iedereen mag deelnemen.').setRoleSelectMenuComponent(requiredRole),
      new LabelBuilder().setLabel('Ping versturen?').setStringSelectMenuComponent(ping),
      new LabelBuilder().setLabel('Eigen afbeelding (optioneel)')
        .setDescription(draft.attachment ? 'Een nieuwe upload vervangt je afbeelding. Leeg laten behoudt de huidige.' : 'Upload een afbeelding tot 10 MB, of gebruik de automatische banner.')
        .setFileUploadComponent(new FileUploadBuilder().setCustomId('afbeelding').setMinValues(0).setMaxValues(1).setRequired(false)),
    );
}

export function readDetails(fields) {
  const values = {
    prize: fields.getTextInputValue('prijs').trim(),
    duration: fields.getTextInputValue('duur').trim(),
    winners: fields.getTextInputValue('winnaars').trim(),
    description: fields.getTextInputValue('beschrijving').trim(),
  };
  if (!values.prize) return { values, error: '❌ Vul een prijs in.' };
  if (!parseDuration(values.duration)) return { values, error: '❌ Gebruik een duur van 1 minuut t/m 90 dagen, bijvoorbeeld 30m, 2h, 3d of 1w.' };
  if (!/^\d{1,2}$/.test(values.winners) || Number(values.winners) < 1 || Number(values.winners) > 20) {
    return { values, error: '❌ Vul een heel aantal winnaars van 1 tot en met 20 in.' };
  }
  return { values };
}

export function buildDraftReview(draft, error) {
  const embed = new EmbedBuilder().setColor(0x9255ff).setTitle('🎁 Jouw Wesh Lounge-giveaway')
    .setDescription('Controleer je gegevens. Klik op **Publiceren** om de giveaway te starten.')
    .addFields(
      { name: 'Prijs', value: draft.prize || 'Nog invullen', inline: true },
      { name: 'Duur', value: draft.duration || 'Nog invullen', inline: true },
      { name: 'Winnaars', value: draft.winners || '1', inline: true },
      { name: 'Kanaal', value: `<#${draft.channelId}>`, inline: true },
      { name: 'Ping', value: draft.ping === false ? 'Geen ping' : `<@&${draft.pingRoleId || '1516850805322285258'}>`, inline: true },
      { name: 'Vereiste rol', value: draft.requiredRoleId ? `<@&${draft.requiredRoleId}>` : 'Iedereen kan meedoen', inline: true },
      { name: 'Beschrijving', value: draft.description || 'Standaard communitytekst' },
      { name: 'Banner', value: draft.attachment ? 'Eigen afbeelding met Wesh Lounge-logo en prijs' : 'Automatisch aangepast aan de prijs' },
    ).setFooter({ text: 'Alleen jij ziet dit overzicht • Formulier verloopt na 30 minuten' });
  const button = (action, label, style = ButtonStyle.Secondary) => new ButtonBuilder()
    .setCustomId(`${prefix}${action}:${draft.id}`).setLabel(label).setStyle(style);
  return {
    content: error || '', embeds: [embed], allowedMentions: { parse: [] },
    components: [new ActionRowBuilder().addComponents(
      button('edit', 'Gegevens aanpassen'), button('options', 'Extra instellingen'),
      button('autoimage', 'Automatische banner').setDisabled(!draft.attachment),
      button('publish', 'Publiceren', ButtonStyle.Success).setDisabled(!draft.valid),
      button('cancel', 'Annuleren', ButtonStyle.Danger),
    )],
  };
}

export class GiveawayFormManager {
  constructor({ publish = startGiveaway, now = Date.now } = {}) {
    this.drafts = new Map();
    this.publish = publish;
    this.now = now;
  }

  async acknowledge(interaction) {
    if (interaction.isButton() || interaction.isFromMessage?.()) await interaction.deferUpdate();
    else await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }

  async handle(interaction) {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Alleen beheerders kunnen dit formulier gebruiken.', flags: MessageFlags.Ephemeral });
      return;
    }
    for (const [id, draft] of this.drafts) {
      if (draft.expiresAt <= this.now() && draft.state !== 'publishing') this.drafts.delete(id);
    }
    if (interaction.isChatInputCommand()) {
      const draft = {
        id: randomUUID(), userId: interaction.user.id, guildId: interaction.guildId,
        channelId: interaction.channelId, originalChannelId: interaction.channelId,
        channelType: interaction.channel?.type, originalChannelType: interaction.channel?.type,
        winners: '1', ping: true, valid: false, state: 'editing', expiresAt: this.now() + lifetime,
      };
      this.drafts.set(draft.id, draft);
      await interaction.showModal(buildDetailsModal(draft));
      return;
    }
    const [, action, id] = interaction.customId.split(':');
    const draft = this.drafts.get(id);
    if (!draft || draft.userId !== interaction.user.id || draft.guildId !== interaction.guildId) {
      await interaction.reply({ content: '❌ Dit formulier is verlopen of hoort bij iemand anders. Gebruik opnieuw /giveaway.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (draft.state === 'publishing') {
      await interaction.reply({ content: '⏳ Deze giveaway wordt al gepubliceerd.', flags: MessageFlags.Ephemeral });
      return;
    }
    if (interaction.isButton() && action === 'edit') {
      await interaction.showModal(buildDetailsModal(draft));
      return;
    }
    if (interaction.isButton() && action === 'options') {
      await interaction.showModal(buildSettingsModal(draft));
      return;
    }
    if (interaction.isButton() && action === 'publish') {
      if (!draft.valid) {
        await interaction.reply({ content: '❌ Vul eerst geldige giveawaygegevens in.', flags: MessageFlags.Ephemeral });
        return;
      }
      draft.state = 'publishing';
      try {
        await this.acknowledge(interaction);
        const channel = await interaction.guild.channels.fetch(draft.channelId);
        const pingRole = draft.pingRoleId ? await interaction.guild.roles.fetch(draft.pingRoleId) : null;
        const requiredRole = draft.requiredRoleId ? await interaction.guild.roles.fetch(draft.requiredRoleId) : null;
        if (!channel || (draft.pingRoleId && !pingRole) || (draft.requiredRoleId && !requiredRole)) {
          draft.state = 'editing';
          await interaction.editReply(buildDraftReview(draft, '❌ Een gekozen kanaal of rol bestaat niet meer. Pas de instellingen aan.'));
          return;
        }
        const result = await this.publish(interaction, {
          prize: draft.prize, duration: draft.duration, winnerCount: Number(draft.winners),
          description: draft.description, channel, ping: draft.ping, pingRole, requiredRole, attachment: draft.attachment,
        });
        if (result.startsWith('✅')) {
          this.drafts.delete(id);
          await interaction.editReply({ content: result, embeds: [], components: [], allowedMentions: { parse: [] } });
        } else {
          draft.state = 'editing';
          await interaction.editReply(buildDraftReview(draft, result));
        }
      } catch (error) {
        draft.state = 'editing';
        throw error;
      }
      return;
    }
    await this.acknowledge(interaction);
    if (interaction.isButton() && action === 'cancel') {
      this.drafts.delete(id);
      await interaction.editReply({ content: '✅ Formulier geannuleerd. Er is geen giveaway gestart.', embeds: [], components: [] });
      return;
    }
    let error;
    if (interaction.isModalSubmit() && action === 'details') {
      const result = readDetails(interaction.fields);
      Object.assign(draft, result.values);
      error = result.error;
      draft.valid = !error;
    } else if (interaction.isModalSubmit() && action === 'settings') {
      const channelId = interaction.fields.getField('kanaal').values?.[0];
      const selectedChannel = interaction.fields.getSelectedChannels('kanaal')?.get(channelId);
      const attachment = interaction.fields.getUploadedFiles('afbeelding')?.first();
      if (attachment && (!attachment.contentType?.startsWith('image/') || attachment.size > 10 * 1024 * 1024)) {
        error = '❌ Upload een geldige afbeelding van maximaal 10 MB.';
      } else {
        draft.channelId = channelId || draft.originalChannelId;
        draft.channelType = selectedChannel?.type ?? draft.originalChannelType;
        draft.pingRoleId = interaction.fields.getField('pingrol').values?.[0] || null;
        draft.requiredRoleId = interaction.fields.getField('vereisterol').values?.[0] || null;
        draft.ping = interaction.fields.getStringSelectValues('ping')[0] !== 'no';
        draft.attachment = attachment || draft.attachment;
      }
    } else if (interaction.isButton() && action === 'autoimage') {
      draft.attachment = undefined;
    }
    await interaction.editReply(buildDraftReview(draft, error));
  }
}

export const giveawayForms = new GiveawayFormManager();
