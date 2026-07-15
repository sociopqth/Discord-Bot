const { SlashCommandBuilder } = require('discord.js');
const { joinAndPlay } = require('../../utils/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('Song name or YouTube URL')
        .setRequired(true)),

  async execute(interaction) {
    const query = interaction.options.getString('query');
    await joinAndPlay(interaction, query, interaction.client.musicQueue);
  },
};
