const { logger } = require('../utils/logger');
const { handleTicketButton } = require('../commands/tickets/ticket');

module.exports = {
  name: 'interactionCreate',
  once: false,

  async execute(interaction, client) {
    // ── Slash commands ────────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({ content: '❌ Unknown command.', ephemeral: true });
      }
      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error(`Error executing /${interaction.commandName}:`, err);
        const errMsg = { content: '❌ An error occurred while running that command.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          interaction.editReply(errMsg).catch(() => {});
        } else {
          interaction.reply(errMsg).catch(() => {});
        }
      }
      return;
    }

    // ── Button interactions ───────────────────────────────────────────────────
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('ticket_')) {
        try {
          await handleTicketButton(interaction);
        } catch (err) {
          logger.error('Ticket button error:', err);
          interaction.reply({ content: '❌ Ticket error.', ephemeral: true }).catch(() => {});
        }
      }
    }
  },
};
