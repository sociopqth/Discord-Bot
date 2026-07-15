const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📖 Command Reference')
      .setDescription('Here is everything I can do:')
      .addFields(
        {
          name: '⚙️ General',
          value: [
            '`/ping` — Check bot latency',
            '`/help` — This menu',
          ].join('\n'),
        },
        {
          name: '🔨 Moderation',
          value: [
            '`/kick <user> [reason]` — Kick a member',
            '`/ban <user> [reason]` — Ban a member',
            '`/timeout <user> <minutes> [reason]` — Timeout a member',
          ].join('\n'),
        },
        {
          name: '🎫 Tickets',
          value: '`/ticket setup` — Post the ticket panel in the current channel',
        },
        {
          name: '🎭 Reaction Roles',
          value: '`/reactionrole add <messageId> <emoji> <role>` — Link an emoji reaction to a role\n`/reactionrole remove <messageId> <emoji>` — Remove a reaction role',
        },
        {
          name: '🎵 Music',
          value: [
            '`/play <query>` — Play a song (YouTube search or URL)',
            '`/skip` — Skip the current track',
            '`/stop` — Stop playback and leave the channel',
          ].join('\n'),
        },
        {
          name: '🤖 AI',
          value: '`/chat <message>` — Chat with GPT',
        },
        {
          name: '⭐ Leveling',
          value: '`/rank [user]` — Show XP rank card',
        },
        {
          name: '🪄 Prefix Commands',
          value: [
            '`c!steal` *(reply to a message)* — Steal custom emoji or sticker into this server',
          ].join('\n'),
        }
      )
      .setFooter({ text: 'Prefix: c! • Slash: /' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
