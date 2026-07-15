const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt =>
      opt.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for kick').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
    if (!target.kickable) return interaction.reply({ content: '❌ I cannot kick that member.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot kick yourself.', ephemeral: true });

    await target.kick(reason);

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('👢 Member Kicked')
      .addFields(
        { name: 'User',   value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'By',     value: interaction.user.tag,                inline: true },
        { name: 'Reason', value: reason }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    // Log to mod-logs channel if configured
    const logChannel = interaction.guild.channels.cache.find(
      c => c.name === (process.env.MOD_LOG_CHANNEL ?? 'mod-logs')
    );
    logChannel?.send({ embeds: [embed] }).catch(() => {});
  },
};
