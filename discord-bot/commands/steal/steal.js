/**
 * Prefix command: c!steal
 * Reply to a message with a custom emoji or guild sticker to add it to this server.
 */
const { PermissionFlagsBits } = require('discord.js');
const https = require('https');
const http  = require('http');
const { logger } = require('../../utils/logger');

module.exports = {
  prefix: 'steal',

  async run(message, args, client) {
    // ── Permission check ─────────────────────────────────────────────────────
    const memberPerms = message.member?.permissions;
    const botPerms    = message.guild.members.me?.permissions;

    const hasManage = p =>
      p?.has(PermissionFlagsBits.ManageEmojisAndStickers) ||
      p?.has(PermissionFlagsBits.ManageGuildExpressions);

    if (!hasManage(memberPerms)) {
      return message.reply('❌ You need the **Manage Emojis and Stickers** permission.');
    }
    if (!hasManage(botPerms)) {
      return message.reply('❌ I need the **Manage Emojis and Stickers** permission.');
    }

    // ── Must be used as a reply ──────────────────────────────────────────────
    logger.info(`steal: reference = ${JSON.stringify(message.reference)}`);
    if (!message.reference?.messageId) {
      return message.reply(
        '❌ Use this command by **replying** to a message that contains a custom emoji or sticker.\n' +
        '> Right-click / long-press a message → Reply, then type `c!steal`.'
      );
    }

    // ── Fetch the target message ─────────────────────────────────────────────
    let target;
    try {
      target = await message.channel.messages.fetch(message.reference.messageId);
    } catch (err) {
      logger.error('steal: failed to fetch target message:', err.message);
      return message.reply('❌ Could not fetch that message. Make sure I can see this channel.');
    }

    logger.info(`steal: target content = "${target.content}"`);
    logger.info(`steal: target stickers = ${target.stickers.size}`);

    const results = [];

    // ── 1. Steal custom emoji(s) from message text ───────────────────────────
    // Matches <:name:id>  and  <a:name:id>  (animated)
    const emojiRegex = /<(a)?:(\w{2,32}):(\d{17,20})>/g;
    const seenIds    = new Set();
    let match;

    while ((match = emojiRegex.exec(target.content)) !== null) {
      const animated = Boolean(match[1]);
      const name     = match[2];
      const id       = match[3];
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      // Pass the URL directly — discord.js resolves it internally
      const ext        = animated ? 'gif' : 'png';
      const emojiUrl   = `https://cdn.discordapp.com/emojis/${id}.${ext}?size=128&quality=lossless`;

      try {
        const created = await message.guild.emojis.create({
          attachment: emojiUrl,
          name,
          reason: `Stolen by ${message.author.tag}`,
        });
        results.push(`✅ Added emoji: \`${created.name}\` ${created}`);
      } catch (err) {
        // Fall back to downloading a buffer if URL approach fails
        try {
          const buf     = await fetchBuffer(emojiUrl);
          const created = await message.guild.emojis.create({
            attachment: buf,
            name,
            reason: `Stolen by ${message.author.tag}`,
          });
          results.push(`✅ Added emoji: \`${created.name}\` ${created}`);
        } catch (err2) {
          results.push(`❌ Failed to add \`${name}\`: ${err2.message}`);
        }
      }
    }

    // ── 2. Steal sticker(s) ──────────────────────────────────────────────────
    for (const sticker of target.stickers.values()) {
      if (sticker.guildId === message.guild.id) {
        results.push(`ℹ️ \`${sticker.name}\` is already from this server.`);
        continue;
      }
      if (!sticker.guildId) {
        results.push(`ℹ️ \`${sticker.name}\` is a built-in sticker and cannot be copied.`);
        continue;
      }

      const stickerUrl = sticker.url;
      if (!stickerUrl) {
        results.push(`❌ Could not get URL for \`${sticker.name}\`.`);
        continue;
      }

      try {
        const buf     = await fetchBuffer(stickerUrl);
        const created = await message.guild.stickers.create({
          file:        { attachment: buf, name: `${sticker.name}.png` },
          name:        sticker.name,
          tags:        sticker.tags || '🙂',
          description: sticker.description || `Stolen from another server`,
          reason:      `Stolen by ${message.author.tag}`,
        });
        results.push(`✅ Added sticker: \`${created.name}\``);
      } catch (err) {
        results.push(`❌ Failed to add sticker \`${sticker.name}\`: ${err.message}`);
      }
    }

    if (results.length === 0) {
      return message.reply(
        '❌ No stealable content found.\n' +
        '> The message must contain a **custom emoji** (not a standard emoji) or a **guild sticker**.'
      );
    }

    await message.reply(results.join('\n'));
  },
};

// ── Buffer fetch with redirect support ──────────────────────────────────────
function fetchBuffer(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'DiscordBot (steal-cmd, 1.0)' } }, res => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(fetchBuffer(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data',  c  => chunks.push(c));
      res.on('end',   () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}
