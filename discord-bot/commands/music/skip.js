const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track'),

  async execute(interaction) {
    const queue = interaction.client.musicQueue.get(interaction.guildId);

    if (!queue || !queue.playing) {
      return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }

    if (!interaction.member?.voice?.channel) {
      return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    const skipped = queue.currentTrack;
    queue.player.stop(); // triggers AudioPlayerStatus.Idle → playNext

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⏭️ Skipped')
      .setDescription(skipped ? `**${skipped.title}**` : 'Current track')
      .addFields({ name: 'Queue remaining', value: `${queue.tracks.length} track(s)`, inline: true })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
