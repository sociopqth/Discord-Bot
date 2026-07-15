const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt =>
      opt.setName('user').setDescription('Member to ban').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for ban').setRequired(false))
    .addIntegerOption(opt =>
      opt.setName('delete_days')
        .setDescription('Days of messages to delete (0–7)')
        .setMinValue(0).setMaxValue(7).setRequired(false)),

  async execute(interaction) {
    const target      = interaction.options.getMember('user');
    const reason      = interaction.options.getString('reason')      ?? 'No reason provided';
    const deleteDays  = interaction.options.getInteger('delete_days') ?? 0;

    if (!target) return interaction.reply({ content: '❌ Member not found.', ephemeral: true });
    if (!target.bannable) return interaction.reply({ content: '❌ I cannot ban that member.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ You cannot ban yourself.', ephemeral: true });

    // DM the user before banning so the DM can be delivered
    await target.send({
      embeds: [{
        color: 0xED4245,
        title: `You have been banned from ${interaction.guild.name}`,
        fields: [{ name: 'Reason', value: reason }],
        timestamp: new Date().toISOString(),
      }],
    }).catch(() => {});

    await target.ban({ reason, deleteMessageDays: deleteDays });

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔨 Member Banned')
      .addFields(
        { name: 'User',   value: `${target.user.tag} (${target.user.id})`, inline: true },
        { name: 'By',     value: interaction.user.tag,                     inline: true },
        { name: 'Reason', value: reason },
        { name: 'Messages Deleted', value: `${deleteDays} day(s)`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    const logChannel = interaction.guild.channels.cache.find(
      c => c.name === (process.env.MOD_LOG_CHANNEL ?? 'mod-logs')
    );
    logChannel?.send({ embeds: [embed] }).catch(() => {});
  },
};
