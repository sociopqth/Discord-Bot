require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const http = require('http');

// ── Health-check server (only in deployed/artifact context where PORT is set) ─
if (process.env.PORT) {
  http.createServer((req, res) => {
    res.writeHead(req.url === '/healthz' ? 200 : 404);
    res.end(req.url === '/healthz' ? 'OK' : 'Not Found');
  }).listen(Number(process.env.PORT));
}
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { logger } = require('./utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildEmojisAndStickers,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.GuildMember,
  ],
});

// ── Attach collections ──────────────────────────────────────────────────────
client.commands   = new Collection(); // slash commands
client.prefixCmds = new Collection(); // prefix commands
client.musicQueue = new Map();        // guildId → queue state

// ── Auto-load slash commands ─────────────────────────────────────────────────
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
  const folderPath = path.join(commandsPath, folder);
  if (!fs.statSync(folderPath).isDirectory()) continue;
  const commandFiles = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(folderPath, file));
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      logger.info(`Loaded slash command: ${command.data.name}`);
    }
    // prefix commands export a `prefix` property instead of `data`
    if ('prefix' in command && 'run' in command) {
      client.prefixCmds.set(command.prefix, command);
      logger.info(`Loaded prefix command: ${command.prefix}`);
    }
  }
}

// ── Auto-load events ─────────────────────────────────────────────────────────
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  logger.info(`Registered event: ${event.name}`);
}

// ── Login ────────────────────────────────────────────────────────────────────
if (!process.env.DISCORD_TOKEN) {
  logger.error('DISCORD_TOKEN is not set in .env — aborting.');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN).catch(err => {
  if (err.message?.includes('disallowed intents')) {
    logger.error(
      'LOGIN FAILED — Privileged Intents are not enabled.\n' +
      '  → Go to discord.com/developers/applications → Bot\n' +
      '  → Enable "Server Members Intent" and "Message Content Intent"\n' +
      '  → Save Changes, then restart the bot.'
    );
  } else {
    logger.error('Failed to login:', err.message);
  }
  process.exit(1);
});
