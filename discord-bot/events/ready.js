const { logger } = require('../utils/logger');

module.exports = {
  name: 'ready',
  once: true,

  execute(client) {
    logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

    client.user.setPresence({
      activities: [{ name: '/help | c!steal', type: 2 /* Listening */ }],
      status: 'online',
    });
  },
};
