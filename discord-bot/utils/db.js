/**
 * Simple JSON-file persistence layer.
 * Files are written to ./data/ relative to the bot root.
 * Each collection is a separate JSON file for clarity.
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function load(name) {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return {};
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return {};
  }
}

function save(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8');
}

// ── Leveling helpers ─────────────────────────────────────────────────────────
const XP_PER_MESSAGE = 15;
const XP_COOLDOWN_MS = 60_000; // 1 message per minute contributes XP
const xpCooldowns   = new Map(); // userId → last XP timestamp

function xpForLevel(level) {
  return 100 * level * level; // quadratic curve
}

function levelFromXp(xp) {
  let level = 0;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

function addXp(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  if (xpCooldowns.has(key) && now - xpCooldowns.get(key) < XP_COOLDOWN_MS) {
    return null; // on cooldown
  }
  xpCooldowns.set(key, now);

  const db = load('leveling');
  if (!db[guildId])         db[guildId] = {};
  if (!db[guildId][userId]) db[guildId][userId] = { xp: 0, level: 0 };

  db[guildId][userId].xp += XP_PER_MESSAGE;
  const newLevel = levelFromXp(db[guildId][userId].xp);
  const leveled  = newLevel > db[guildId][userId].level;
  db[guildId][userId].level = newLevel;
  save('leveling', db);

  return { xp: db[guildId][userId].xp, level: newLevel, leveled };
}

function getRank(guildId, userId) {
  const db = load('leveling');
  const guildData = db[guildId] ?? {};
  const entry = guildData[userId] ?? { xp: 0, level: 0 };

  // Sort by XP descending to get rank
  const sorted = Object.entries(guildData).sort(([, a], [, b]) => b.xp - a.xp);
  const rank   = sorted.findIndex(([id]) => id === userId) + 1;

  return {
    xp:      entry.xp,
    level:   entry.level,
    rank:    rank || sorted.length + 1,
    total:   sorted.length,
    nextXp:  xpForLevel(entry.level + 1),
  };
}

// ── Reaction role helpers ────────────────────────────────────────────────────
function getReactionRoles(guildId) {
  const db = load('reaction_roles');
  return db[guildId] ?? {};
}

/**
 * messageId → { emoji → roleId }
 */
function setReactionRole(guildId, messageId, emoji, roleId) {
  const db = load('reaction_roles');
  if (!db[guildId])              db[guildId] = {};
  if (!db[guildId][messageId])   db[guildId][messageId] = {};
  db[guildId][messageId][emoji] = roleId;
  save('reaction_roles', db);
}

function removeReactionRole(guildId, messageId, emoji) {
  const db = load('reaction_roles');
  if (db[guildId]?.[messageId]?.[emoji]) {
    delete db[guildId][messageId][emoji];
    save('reaction_roles', db);
  }
}

module.exports = {
  addXp,
  getRank,
  getReactionRoles,
  setReactionRole,
  removeReactionRole,
};
