/**
 * Prefix command: c!emoji
 *
 * Subcommands:
 *  c!emoji list              — lists all emojis with their names
 *  c!emoji delete <name>     — deletes an emoji by name
 *  c!emoji slots             — shows how many emoji slots are used/free
 */
const { PermissionFlagsBits } = require('discord.js');
const { logger } = require('../../utils/logger');

module.exports = {
  prefix: 'emoji',

  async run(message, args) {
    const sub = args[0]?.toLowerCase();

    // ── slots ────────────────────────────────────────────────────────────────
    if (!sub || sub === 'slots') {
      const EMOJI_LIMITS = { 0: 50, 1: 100, 2: 150, 3: 250 };
      const max      = EMOJI_LIMITS[message.guild.premiumTier] ?? 50;
      const statics  = message.guild.emojis.cache.filter(e => !e.animated).size;
      const animated = message.guild.emojis.cache.filter(e =>  e.animated).size;
      return message.reply(
        `**Emoji slots for ${message.guild.name}**\n` +
        `Static:   **${statics}/${max}** (${max - statics} free)\n` +
        `Animated: **${animated}/${max}** (${max - animated} free)\n\n` +
        `Use \`c!emoji list\` to see all emojis.\n` +
        `Use \`c!emoji delete <name>\` to remove one and free up a slot.`
      );
    }

    // ── list ─────────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const all      = [...message.guild.emojis.cache.values()];
      const statics  = all.filter(e => !e.animated);
      const animated = all.filter(e =>  e.animated);
      const max      = message.guild.maximumEmojis ?? 50;

      if (all.length === 0) return message.reply('This server has no custom emojis.');

      const fmt = list => list.map(e => `\`${e.name}\``).join(', ');

      const lines = [];
      if (statics.length)  lines.push(`**Static (${statics.length}/${max}):** ${fmt(statics)}`);
      if (animated.length) lines.push(`**Animated (${animated.length}/${max}):** ${fmt(animated)}`);

      // Split into 1900-char chunks
      const chunks = [];
      let cur = '';
      for (const line of lines) {
        if ((cur + '\n' + line).length > 1900) { chunks.push(cur); cur = line; }
        else cur = cur ? cur + '\n' + line : line;
      }
      if (cur) chunks.push(cur);

      for (const chunk of chunks) {
        await message.reply(chunk).catch(() => {});
      }
      return;
    }

    // ── delete ───────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const memberPerms = message.member?.permissions;
      const botPerms    = message.guild.members.me?.permissions;
      const hasManage   = p =>
        p?.has(PermissionFlagsBits.ManageEmojisAndStickers) ||
        p?.has(PermissionFlagsBits.ManageGuildExpressions);

      if (!hasManage(memberPerms)) {
        return message.reply('❌ You need the **Manage Emojis and Stickers** permission.');
      }
      if (!hasManage(botPerms)) {
        return message.reply('❌ I need the **Manage Emojis and Stickers** permission.');
      }

      const emojiName = args[1];
      if (!emojiName) {
        return message.reply('❌ Usage: `c!emoji delete <name>`\nExample: `c!emoji delete CrowSip`');
      }

      // Match by name (case-insensitive)
      const emoji = message.guild.emojis.cache.find(
        e => e.name.toLowerCase() === emojiName.toLowerCase()
      );

      if (!emoji) {
        return message.reply(
          `❌ No emoji named \`${emojiName}\` found in this server.\n` +
          `Use \`c!emoji list\` to see all emoji names.`
        );
      }

      try {
        const name = emoji.name;
        await emoji.delete(`Deleted by ${message.author.tag}`);
        logger.info(`emoji: deleted ${name} by ${message.author.tag}`);
        return message.reply(`✅ Deleted emoji \`${name}\`.`);
      } catch (err) {
        logger.error(`emoji: delete failed: ${err.message}`);
        return message.reply(`❌ Failed to delete: ${err.message}`);
      }
    }

    // ── unknown subcommand ───────────────────────────────────────────────────
    return message.reply(
      '**c!emoji commands:**\n' +
      '`c!emoji slots` — show free/used emoji slots\n' +
      '`c!emoji list` — list all emojis by name\n' +
      '`c!emoji delete <name>` — delete an emoji to free a slot'
    );
  },
};
