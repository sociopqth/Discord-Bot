const { getReactionRoles } = require('../utils/db');
const { logger } = require('../utils/logger');

module.exports = {
  name: 'messageReactionRemove',
  once: false,

  async execute(reaction, user, client) {
    if (user.bot) return;

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

    const emojiKey = reaction.emoji.id
      ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>`
      : reaction.emoji.name;

    const roleId = messageRoles[emojiKey];
    if (!roleId) return;

    try {
      const member = await guild.members.fetch(user.id);
      await member.roles.remove(roleId, 'Reaction role removed');
    } catch (err) {
      logger.warn(`Failed to remove reaction role ${roleId}:`, err.message);
    }
  },
};
