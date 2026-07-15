const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'guildMemberAdd',
  once: false,

  async execute(member, client) {
    const channelName = process.env.WELCOME_CHANNEL ?? 'welcome';
    const channel = member.guild.channels.cache.find(c => c.name === channelName);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('👋 Welcome!')
      .setDescription(
        `Hey ${member}, welcome to **${member.guild.name}**!\n\n` +
        `You are member **#${member.guild.memberCount}**.\n` +
        `Use \`/help\` to see what I can do.`
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: member.guild.name, iconURL: member.guild.iconURL() })
      .setTimestamp();

    channel.send({ embeds: [embed] }).catch(() => {});
  },
};
