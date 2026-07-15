/**
 * Prefix command: c!steal
 *
 * Reply to a message that contains:
 *  - A custom emoji  → adds it to the current guild
 *  - A sticker       → adds it to the current guild (requires Manage Emojis and Stickers)
 *
 * Does NOT handle slash command data/execute — only prefix (run).
 */
const { PermissionFlagsBits } = require('discord.js');
const https = require('https');
const http  = require('http');

module.exports = {
  prefix: 'steal',

  async run(message, args, client) {
    // ── Permission check ─────────────────────────────────────────────────────
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
      return message.reply('❌ You need the **Manage Emojis and Stickers** permission.');
    }
    if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
      return message.reply('❌ I need the **Manage Emojis and Stickers** permission.');
    }

    // ── Must be a reply ──────────────────────────────────────────────────────
    const ref = message.reference;
    if (!ref) {
      return message.reply('❌ Reply to a message that contains a custom emoji or sticker.');
    }

    let target;
    try {
      target = await message.channel.messages.fetch(ref.messageId);
    } catch {
      return message.reply('❌ Could not fetch the referenced message.');
    }

    const results = [];

    // ── 1. Steal custom emoji(s) from message content ────────────────────────
    // Matches both static <:name:id> and animated <a:name:id>
    const emojiRegex = /<(a)?:(\w+):(\d+)>/g;
    let match;
    const seenIds = new Set();

    while ((match = emojiRegex.exec(target.content)) !== null) {
      const animated = Boolean(match[1]);
      const name     = match[2];
      const id       = match[3];

      if (seenIds.has(id)) continue;
      seenIds.add(id);

      const ext = animated ? 'gif' : 'png';
      const url = `https://cdn.discordapp.com/emojis/${id}.${ext}?size=128&quality=lossless`;

      try {
        const attachment = await fetchBuffer(url);
        const created = await message.guild.emojis.create({
          attachment,
          name,
          reason: `Stolen by ${message.author.tag}`,
        });
        results.push(`✅ Emoji added: \`${created.name}\` ${created}`);
      } catch (err) {
        results.push(`❌ Failed to add emoji \`${name}\`: ${err.message}`);
      }
    }

    // ── 2. Steal sticker(s) ──────────────────────────────────────────────────
    for (const sticker of target.stickers.values()) {
      // Only guild stickers can be stolen (not Nitro/standard packs)
      if (sticker.guildId === message.guild.id) {
        results.push(`ℹ️ Sticker \`${sticker.name}\` is already from this server.`);
        continue;
      }

      // Standard pack stickers cannot be cloned
      if (!sticker.guildId) {
        results.push(`ℹ️ \`${sticker.name}\` is a standard sticker and cannot be added.`);
        continue;
      }

      const stickerUrl = sticker.url;
      if (!stickerUrl) {
        results.push(`❌ Could not get URL for sticker \`${sticker.name}\`.`);
        continue;
      }

      try {
        const buffer = await fetchBuffer(stickerUrl);
        const created = await message.guild.stickers.create({
          file: buffer,
          name: sticker.name,
          tags: sticker.tags ?? sticker.name.slice(0, 200),
          description: sticker.description ?? `Stolen from ${sticker.guildId}`,
          reason: `Stolen by ${message.author.tag}`,
        });
        results.push(`✅ Sticker added: \`${created.name}\``);
      } catch (err) {
        results.push(`❌ Failed to add sticker \`${sticker.name}\`: ${err.message}`);
      }
    }

    if (results.length === 0) {
      return message.reply('❌ That message contains no custom emojis or stealable stickers.');
    }

    await message.reply(results.join('\n'));
  },
};

// ── Fetch helper: returns a Buffer from a URL ────────────────────────────────
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers: { 'User-Agent': 'DiscordBot' } }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}
