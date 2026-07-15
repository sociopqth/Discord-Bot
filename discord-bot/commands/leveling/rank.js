const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRank } = require('../../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your XP rank')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to check (defaults to you)').setRequired(false)),

  async execute(interaction) {
    const target  = interaction.options.getUser('user') ?? interaction.user;
    const guildId = interaction.guildId;
    const data    = getRank(guildId, target.id);

    const progress = data.nextXp > 0
      ? Math.min(Math.floor((data.xp / data.nextXp) * 20), 20)
      : 20;
    const bar =
      '█'.repeat(progress) + '░'.repeat(20 - progress);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`⭐ Rank Card — ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: 'Rank',  value: `#${data.rank} of ${data.total}`, inline: true },
        { name: 'Level', value: `${data.level}`,                  inline: true },
        { name: 'XP',    value: `${data.xp} / ${data.nextXp}`,   inline: true },
        { name: 'Progress', value: `\`${bar}\` ${progress * 5}%` }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
