const { getReactionRoles } = require('../utils/db');
const { logger } = require('../utils/logger');

module.exports = {
  name: 'messageReactionAdd',
  once: false,

  async execute(reaction, user, client) {
    if (user.bot) return;

    // Fetch partial reaction/message if needed
    if (reaction.partial) {
      try { await reaction.fetch(); } catch { return; }
    }
    if (reaction.message.partial) {
      try { await reaction.message.fetch(); } catch { return; }
    }

    const guild = reaction.message.guild;
    if (!guild) return;

    const rrMap = getReactionRoles(guild.id);
    const messageRoles = rrMap[reaction.message.id];
    if (!messageRoles) return;

    // Match by emoji name or unicode
    const emojiKey = reaction.emoji.id
      ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name;

    const roleId = messageRoles[emojiKey];
    if (!roleId) return;

    try {
      const member = await guild.members.fetch(user.id);
      await member.roles.add(roleId, 'Reaction role');
    } catch (err) {
      logger.warn(`Failed to add reaction role ${roleId}:`, err.message);
    }
  },
};
