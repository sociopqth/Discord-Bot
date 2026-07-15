const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot latency'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging…', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Roundtrip', value: `${roundtrip} ms`, inline: true },
        { name: 'API Heartbeat', value: `${Math.round(interaction.client.ws.ping)} ms`, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: '', embeds: [embed] });
  },
};
