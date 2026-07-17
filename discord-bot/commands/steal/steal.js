/**
 * Prefix command: c!steal
 *
 * Two modes:
 *  1. c!steal               — reply to a message, steals all custom emojis/stickers in it
 *  2. c!steal <emoji1> ...  — type custom emojis directly in the command message
 *
 * Both modes can be combined (reply + emojis in command).
 */
const { PermissionFlagsBits } = require('discord.js');
const https = require('https');
const http  = require('http');
const { logger } = require('../../utils/logger');

// Custom emoji pattern: <:name:id> or <a:name:id>
const EMOJI_RE = /<(a)?:(\w{2,32}):(\d{15,20})>/g;

module.exports = {
  prefix: 'steal',

  async run(message, args, client) {

    // ── Permission check ─────────────────────────────────────────────────────
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

    // ── Collect emoji candidates ─────────────────────────────────────────────
    // Map of id → { animated, name, id }
    const candidates = new Map();

    // Mode 1: emojis typed directly in the c!steal message
    let m;
    EMOJI_RE.lastIndex = 0;
    while ((m = EMOJI_RE.exec(message.content)) !== null) {
      const [, a, name, id] = m;
      if (!candidates.has(id)) candidates.set(id, { animated: Boolean(a), name, id });
    }

    // Mode 2: emojis from the replied-to message
    if (message.reference?.messageId) {
      try {
        const target = await message.channel.messages.fetch(message.reference.messageId);
        logger.info(`steal: replied message content = "${target.content}"`);

        EMOJI_RE.lastIndex = 0;
        while ((m = EMOJI_RE.exec(target.content)) !== null) {
          const [, a, name, id] = m;
          if (!candidates.has(id)) candidates.set(id, { animated: Boolean(a), name, id });
        }

        // Stickers from replied message
        for (const sticker of target.stickers.values()) {
          logger.info(`steal: found sticker ${sticker.name} guildId=${sticker.guildId}`);
          if (sticker.guildId === message.guild.id) continue;
          if (!sticker.guildId) {
            await message.reply(`ℹ️ \`${sticker.name}\` is a built-in sticker and cannot be copied.`).catch(() => {});
            continue;
          }
          const stickerUrl = sticker.url;
          if (!stickerUrl) continue;
          logger.info(`steal: attempting sticker ${sticker.name} from ${stickerUrl}`);
          try {
            const buf     = await fetchBuffer(stickerUrl);
            const created = await message.guild.stickers.create({
              file:        { attachment: buf, name: `${sticker.name}.png` },
              name:        sticker.name,
              tags:        sticker.tags || '🙂',
              description: sticker.description || 'Stolen sticker',
              reason:      `Stolen by ${message.author.tag}`,
            });
            await message.reply(`✅ Added sticker: \`${created.name}\``).catch(() => {});
          } catch (err) {
            logger.error(`steal: sticker create failed: ${err.message}`);
            await message.reply(`❌ Sticker \`${sticker.name}\` failed: ${err.message}`).catch(() => {});
          }
        }
      } catch (err) {
        logger.error(`steal: fetch replied message failed: ${err.message}`);
        await message.reply(`❌ Could not fetch the replied message: ${err.message}`).catch(() => {});
      }
    }

    // ── Nothing to steal ─────────────────────────────────────────────────────
    if (candidates.size === 0) {
      return message.reply(
        '❌ No custom emojis found.\n' +
        '**Usage:**\n' +
        '• Reply to a message containing custom emojis and type `c!steal`\n' +
        '• Or type `c!steal` followed by the custom emojis directly\n\n' +
        '> Note: Standard emojis like 😀 cannot be stolen — only custom server emojis like <:example:123>'
      );
    }

    logger.info(`steal: ${candidates.size} emoji candidate(s) found`);

    // ── Emoji slot check ─────────────────────────────────────────────────────
    const maxEmojis    = message.guild.maximumEmojis ?? 50;
    const usedStatic   = message.guild.emojis.cache.filter(e => !e.animated).size;
    const usedAnimated = message.guild.emojis.cache.filter(e =>  e.animated).size;
    let slotsStatic    = maxEmojis - usedStatic;
    let slotsAnimated  = maxEmojis - usedAnimated;

    logger.info(`steal: slots — static ${slotsStatic}/${maxEmojis}, animated ${slotsAnimated}/${maxEmojis}`);

    // If both slot types are full, bail early with one clear message
    if (slotsStatic <= 0 && slotsAnimated <= 0) {
      return message.reply(
        `❌ **Your server is full on emojis!**\n` +
        `Static: ${usedStatic}/${maxEmojis} · Animated: ${usedAnimated}/${maxEmojis}\n\n` +
        `Delete some emojis first, then try again.\n` +
        `> Use \`c!emoji list\` to see all emojis, or \`c!emoji delete <name>\` to remove one.`
      );
    }

    // Send a working message immediately so the user sees progress
    const workingMsg = await message.reply(
      `⏳ Found **${candidates.size}** emoji(s) — adding them now. This may take a moment due to Discord rate limits…`
    ).catch(() => null);

    // ── Process each emoji ───────────────────────────────────────────────────
    const results = [];

    for (const { animated, name, id } of candidates.values()) {
      // Check slot availability
      const slots = animated ? slotsAnimated : slotsStatic;
      if (slots <= 0) {
        results.push(`❌ \`${name}\` — server is full on ${animated ? 'animated' : 'static'} emoji slots (${maxEmojis} max).`);
        continue;
      }

      const ext      = animated ? 'gif' : 'png';
      const emojiUrl = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
      logger.info(`steal: trying emoji ${name} (${id}) animated=${animated}`);

      // Skip if already in this guild
      if (message.guild.emojis.cache.some(e => e.id === id)) {
        results.push(`ℹ️ \`${name}\` is already in this server.`);
        continue;
      }

      try {
        // Fetch image buffer (15s timeout for the HTTP download only)
        const buf = await withTimeout(fetchBuffer(emojiUrl), 15_000, `Download timed out for ${name}`);
        logger.info(`steal: buffer ${name} = ${buf.length} bytes`);

        // No timeout on emojis.create — Discord.js handles rate limits internally
        const created = await message.guild.emojis.create({
          attachment: buf,
          name,
          reason: `Stolen by ${message.author.tag}`,
        });

        logger.info(`steal: ✅ created ${name}`);
        if (animated) usedAnimated + 1; else usedEmojis + 1; // track locally (cosmetic)
        results.push(`✅ \`${created.name}\` ${created}`);
      } catch (err) {
        logger.error(`steal: failed ${name}: ${err.message}`);
        results.push(`❌ \`${name}\` — ${err.message}`);
      }
    }

    // ── Send results ─────────────────────────────────────────────────────────
    if (results.length === 0) return;

    const chunks = [];
    let current  = '';
    for (const line of results) {
      if ((current + '\n' + line).length > 1900) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? current + '\n' + line : line;
      }
    }
    if (current) chunks.push(current);

    for (const chunk of chunks) {
      await message.reply(chunk).catch(err => logger.error('steal: reply failed:', err.message));
    }
  },
};

// ── Timeout wrapper ──────────────────────────────────────────────────────────
function withTimeout(promise, ms, msg) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

// ── Buffer fetch with redirect support ──────────────────────────────────────
function fetchBuffer(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    if (redirects === 0) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'DiscordBot (steal, 1.0)' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(fetchBuffer(res.headers.location, redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data',  c  => chunks.push(c));
      res.on('end',   () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}
