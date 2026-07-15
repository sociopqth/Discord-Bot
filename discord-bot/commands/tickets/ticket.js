const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Post the ticket panel in the current channel')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') await setupTicket(interaction);
  },
};

async function setupTicket(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎫 Support Tickets')
    .setDescription(
      'Need help? Click the button below to open a private support ticket.\n\n' +
      '> One ticket per user. Our team will respond as soon as possible.'
    )
    .setFooter({ text: interaction.guild.name })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel('Open a Ticket')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫'),
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}

// ── Button handler (called from interactionCreate event) ─────────────────────

async function handleTicketButton(interaction) {
  if (interaction.customId === 'ticket_create') {
    await createTicket(interaction);
  } else if (interaction.customId === 'ticket_close') {
    await closeTicket(interaction);
  }
}

async function createTicket(interaction) {
  const guild    = interaction.guild;
  const user     = interaction.user;
  const existing = guild.channels.cache.find(c => c.name === `ticket-${user.id}`);

  if (existing) {
    return interaction.reply({
      content: `❌ You already have an open ticket: ${existing}`,
      ephemeral: true,
    });
  }

  // Find or create Tickets category
  const categoryName = process.env.TICKET_CATEGORY ?? 'Tickets';
  let category = guild.channels.cache.find(c => c.name === categoryName && c.type === ChannelType.GuildCategory);
  if (!category) {
    category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
    });
  }

  const channel = await guild.channels.create({
    name: `ticket-${user.id}`,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },
      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
        ],
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
        ],
      },
    ],
  });

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('🎫 New Ticket')
    .setDescription(
      `Welcome ${user}, a staff member will be with you shortly.\n\n` +
      'Please describe your issue in detail.'
    )
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒'),
  );

  await channel.send({ content: `${user}`, embeds: [embed], components: [closeRow] });

  await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
}

async function closeTicket(interaction) {
  const channel = interaction.channel;
  if (!channel.name.startsWith('ticket-')) {
    return interaction.reply({ content: '❌ This is not a ticket channel.', ephemeral: true });
  }

  await interaction.reply('🔒 Closing ticket in 5 seconds…');
  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

module.exports.handleTicketButton = handleTicketButton;
