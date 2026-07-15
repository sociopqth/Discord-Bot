const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { setReactionRole, removeReactionRole } = require('../../utils/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Manage reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Link an emoji reaction on a message to a role')
        .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
        .addStringOption(o => o.setName('emoji').setDescription('Emoji (unicode or :name:)').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a reaction role mapping')
        .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
        .addStringOption(o => o.setName('emoji').setDescription('Emoji to remove').setRequired(true))),

  async execute(interaction) {
    const sub       = interaction.options.getSubcommand();
    const messageId = interaction.options.getString('message_id');
    const emoji     = interaction.options.getString('emoji');

    if (sub === 'add') {
      const role = interaction.options.getRole('role');

      // Verify the message exists in any channel of this guild
      let found = false;
      for (const channel of interaction.guild.channels.cache.values()) {
        if (!channel.isTextBased()) continue;
        try {
          const msg = await channel.messages.fetch(messageId);
          if (msg) { found = true; break; }
        } catch { /* not in this channel */ }
      }

      if (!found) {
        return interaction.reply({ content: '❌ Message not found in this server.', ephemeral: true });
      }

      setReactionRole(interaction.guildId, messageId, emoji, role.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Reaction Role Added')
        .addFields(
          { name: 'Message', value: messageId,  inline: true },
          { name: 'Emoji',   value: emoji,       inline: true },
          { name: 'Role',    value: `${role}`,   inline: true }
        );

      await interaction.reply({ embeds: [embed] });
    } else if (sub === 'remove') {
      removeReactionRole(interaction.guildId, messageId, emoji);

      await interaction.reply({
        embeds: [{
          color: 0xED4245,
          title: '🗑️ Reaction Role Removed',
          fields: [
            { name: 'Message', value: messageId, inline: true },
            { name: 'Emoji',   value: emoji,     inline: true },
          ],
        }],
      });
    }
  },
};
