import { Client, Events, GatewayIntentBits, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { buildPanel, command, roles, toggleRole } from './panel.js';
import { adCommand, buildAd, normalizeInvite } from './ad.js';
import {
  giveawayCommand, giveawayStopCommand, handleGiveawayButton,
  initializeGiveaways, isGiveawayButton, startGiveaway, stopGiveaway,
  stopGiveawayScheduler,
} from './giveaway.js';

const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN ontbreekt. Voeg je bot-token toe aan de hostingvariabelen of aan .env.');
  process.exit(1);
}
const client = new Client({ intents: [GatewayIntentBits.Guilds], allowedMentions: { parse: [] } });
const busy = new Set();
const enabled = guild => !process.env.GUILD_ID || guild.id === process.env.GUILD_ID;
// Alleen dit commando bijwerken; eventuele andere commando's blijven behouden.
async function register(guild) {
  if (!enabled(guild)) return;
  try {
    await guild.commands.create(command.toJSON());
    await guild.commands.create(adCommand.toJSON());
    await guild.commands.create(giveawayCommand.toJSON());
    await guild.commands.create(giveawayStopCommand.toJSON());
    console.log(`/rollenpaneel, /ad en giveawaycommando's geregistreerd in ${guild.name}`);
  } catch (error) {
    console.error(`Registratie mislukt in ${guild.id}: ${error.code ?? error.name}`);
  }
}
client.once(Events.ClientReady, async ready => {
  console.log(`${ready.user.tag} is online.`);
  await initializeGiveaways(ready);
  for (const guild of ready.guilds.cache.values()) await register(guild);
});
client.on(Events.GuildCreate, register);
client.on(Events.Error, error => console.error(`Discord fout: ${error.code ?? error.name}`));
client.on(Events.InteractionCreate, async interaction => {
  const isPanel = interaction.isChatInputCommand() && interaction.commandName === 'rollenpaneel';
  const isAd = interaction.isChatInputCommand() && interaction.commandName === 'ad';
  const isGiveawayCommand = interaction.isChatInputCommand()
    && ['giveaway', 'giveawaystop'].includes(interaction.commandName);
  const giveawayButton = isGiveawayButton(interaction);
  const choice = interaction.isButton() ? roles[interaction.customId] : undefined;
  if (!isPanel && !isAd && !isGiveawayCommand && !giveawayButton && !choice) return;
  try {
    if (!interaction.inGuild() || !interaction.guild || !enabled(interaction.guild)) {
      await interaction.reply({ content: 'Dit paneel werkt alleen in de ingestelde server.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (isGiveawayCommand) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.editReply('❌ Alleen beheerders kunnen dit commando gebruiken.');
        return;
      }
      const result = interaction.commandName === 'giveaway'
        ? await startGiveaway(interaction)
        : await stopGiveaway(interaction, client);
      await interaction.editReply(result);
      return;
    }
    if (giveawayButton) {
      await interaction.editReply({ content: await handleGiveawayButton(interaction, client), allowedMentions: { parse: [] } });
      return;
    }
    if (isPanel || isAd) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        await interaction.editReply('❌ Alleen beheerders kunnen dit commando gebruiken.');
        return;
      }
      const channel = interaction.channel;
      const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.EmbedLinks,
        channel?.isThread() ? PermissionFlagsBits.SendMessagesInThreads : PermissionFlagsBits.SendMessages];
      if (isPanel) needed.push(PermissionFlagsBits.AttachFiles);
      if (!channel?.isTextBased() || !channel.permissionsFor(client.user)?.has(needed)) {
        await interaction.editReply('❌ Geef mij in dit kanaal: Kanaal bekijken, Berichten verzenden, Links insluiten en Bestanden bijvoegen. In een thread heb ik ook Berichten verzenden in threads nodig.');
        return;
      }
      if (isAd) {
        const link = normalizeInvite(interaction.options.getString('discord-link', true));
        if (!link) {
          await interaction.editReply('❌ Vul een geldige Discord-uitnodigingslink in, zoals https://discord.gg/voorbeeld.');
          return;
        }
        const role = interaction.options.getRole('rol', true);
        const user = interaction.options.getUser('lid', true);
        if (role.id === interaction.guildId) {
          await interaction.editReply('❌ Kies een specifieke rol om te taggen.');
          return;
        }
        try { await interaction.guild.members.fetch(user.id); }
        catch (error) {
          if (error.code !== 10007) throw error;
          await interaction.editReply('❌ Kies een lid van deze server.');
          return;
        }
        if (!role.mentionable && !channel.permissionsFor(client.user)?.has(PermissionFlagsBits.MentionEveryone)) {
          await interaction.editReply('❌ Deze rol kan ik niet pingen. Maak de rol vermeldbaar of geef mij toestemming om alle rollen te vermelden.');
          return;
        }
        await channel.send(buildAd(link, role.id, user.id));
        await interaction.editReply('✅ De advertentie is geplaatst!');
      } else {
        await channel.send(buildPanel());
        await interaction.editReply('✅ Het rollenpaneel staat in dit kanaal!');
      }
      return;
    }
    const key = `${interaction.guildId}:${interaction.user.id}`;
    if (busy.has(key)) {
      await interaction.editReply('Je vorige rolkeuze wordt nog verwerkt. Probeer het zo opnieuw.');
      return;
    }
    busy.add(key);
    try {
      await interaction.editReply(await toggleRole(interaction.guild, interaction.user.id, choice));
    } finally {
      busy.delete(key);
    }
  } catch (error) {
    console.error(`Interactie mislukt: ${error.code ?? error.name}`);
    const content = '❌ Dit is niet gelukt. Controleer de botrechten en probeer daarna opnieuw.';
    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content });
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    } catch { /* De interactie is mogelijk verlopen. */ }
  }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopGiveawayScheduler();
  client.destroy();
  process.exit(0);
});
client.login(token).catch(error => {
  console.error(`Inloggen mislukt (${error.code ?? error.name}). Controleer DISCORD_TOKEN.`);
  process.exitCode = 1;
  client.destroy();
});
