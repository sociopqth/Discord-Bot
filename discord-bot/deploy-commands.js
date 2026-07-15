require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('@discordjs/rest');
const { logger } = require('./utils/logger');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;
  const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(folderPath, file));
    if ('data' in command) {
      commands.push(command.data.toJSON());
      logger.info(`Queued: ${command.data.name}`);
    }
  }
}

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  logger.error('DISCORD_TOKEN and CLIENT_ID must be set in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    logger.info(`Deploying ${commands.length} application (/) commands…`);

    let data;
    if (GUILD_ID) {
      // Guild deploy is instant — great for development
      data = await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
      );
      logger.info(`Successfully deployed ${data.length} guild commands to ${GUILD_ID}.`);
    } else {
      // Global deploy can take up to an hour to propagate
      data = await rest.put(
        Routes.applicationCommands(CLIENT_ID),
        { body: commands }
      );
      logger.info(`Successfully deployed ${data.length} global commands.`);
    }
  } catch (err) {
    logger.error('Deploy failed:', err);
  }
})();
