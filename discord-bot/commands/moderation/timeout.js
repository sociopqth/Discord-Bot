const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout (mute) a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt =>
      opt.setName('user').setDescription('Member to timeout').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('minutes')
        .setDescription('Duration in minutes (1–40320 / 28 days)')
        .setMinValue(1).setMaxValue(40320).setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason').setRequired(false)),

  async execute(interaction) {
    const target  = interaction.options.getMember('user');
    const minutes = interaction.options.getInteger('minutes');
    const reason  = interaction.options.getString('reason') ?? 'No reason provided';

    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
    if (!target.moderatable) return interaction.reply({ content: '❌ I cannot timeout that member.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot timeout yourself.', ephemeral: true });

    const durationMs = minutes * 60 * 1000;
    await target.timeout(durationMs, reason);

    const until = new Date(Date.now() + durationMs);
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('⏱️ Member Timed Out')
      .addFields(
        { name: 'User',     value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'By',       value: interaction.user.tag,                inline: true },
        { name: 'Duration', value: `${minutes} minute(s)`,              inline: true },
        { name: 'Expires',  value: `<t:${Math.floor(until.getTime() / 1000)}:R>` },
        { name: 'Reason',   value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    const logChannel = interaction.guild.channels.cache.find(
      c => c.name === (process.env.MOD_LOG_CHANNEL ?? 'mod-logs')
    );
    logChannel?.send({ embeds: [embed] }).catch(() => {});
  },
};
