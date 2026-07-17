const { logger } = require('../utils/logger');
const { addXp }  = require('../utils/db');
const { EmbedBuilder } = require('discord.js');

const PREFIX = 'c!';

module.exports = {
  name: 'messageCreate',
  once: false,

  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // ── Leveling XP ───────────────────────────────────────────────────────────
    const xpResult = addXp(message.guild.id, message.author.id);
    if (xpResult?.leveled) {
      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('⭐ Level Up!')
        .setDescription(
          `${message.author} reached **Level ${xpResult.level}**! Keep chatting to earn more XP.`
        )
        .setThumbnail(message.author.displayAvatarURL())
        .setTimestamp();

      message.channel.send({ embeds: [embed] }).catch(() => {});
    }

    // ── Prefix commands ───────────────────────────────────────────────────────
    const content = message.content;

    // Debug: log if message content is empty (intent issue)
    if (!content && message.content === '') {
      logger.warn(`Empty message content from ${message.author.tag} — MessageContent intent may not be active.`);
    }

    if (!content.toLowerCase().startsWith(PREFIX)) return;

    logger.info(`Prefix command received: "${content}" from ${message.author.tag}`);

    const args        = content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    logger.info(`Command name parsed: "${commandName}"`);

    const command = client.prefixCmds.get(commandName);
    if (!command) {
      logger.warn(`Unknown prefix command: "${commandName}"`);
      return;
    }

    try {
      await command.run(message, args, client);
    } catch (err) {
      logger.error(`Error in prefix command "${commandName}":`, err);
      message.reply(`❌ An error occurred: ${err.message}`).catch(() => {});
    }
  },
};
