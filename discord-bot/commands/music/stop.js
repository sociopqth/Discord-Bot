const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and disconnect from voice'),

  async execute(interaction) {
    const queue = interaction.client.musicQueue.get(interaction.guildId);

    if (!queue) {
      return interaction.reply({ content: '❌ Nothing is playing.', ephemeral: true });
    }

    if (!interaction.member?.voice?.channel) {
      return interaction.reply({ content: '❌ You must be in a voice channel.', ephemeral: true });
    }

    queue.tracks = [];
    queue.playing = false;
    queue.player.stop();
    queue.connection.destroy();
    interaction.client.musicQueue.delete(interaction.guildId);

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('⏹️ Stopped')
      .setDescription('Playback stopped and disconnected.')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
