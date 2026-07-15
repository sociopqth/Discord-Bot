const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const OpenAI = require('openai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Chat with an AI assistant')
    .addStringOption(opt =>
      opt.setName('message')
        .setDescription('What do you want to ask?')
        .setRequired(true)
        .setMaxLength(1000)),

  async execute(interaction) {
    const message = interaction.options.getString('message');

    if (!process.env.OPENAI_API_KEY) {
      return interaction.reply({
        content: '❌ OPENAI_API_KEY is not configured. Add it to your .env file.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a friendly and helpful Discord bot assistant. ' +
              'Keep responses concise (under 1800 characters) and use plain text. ' +
              'Do not use markdown headers.',
          },
          { role: 'user', content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const reply = completion.choices[0]?.message?.content?.trim() ?? '🤔 No response.';

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .addFields(
          { name: '💬 You', value: message.length > 1024 ? message.slice(0, 1021) + '…' : message },
          { name: '🤖 AI', value: reply.length > 1024 ? reply.slice(0, 1021) + '…' : reply }
        )
        .setTimestamp()
        .setFooter({ text: 'Powered by OpenAI' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply(`❌ OpenAI error: ${err.message}`);
    }
  },
};
