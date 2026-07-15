const LEVELS = { info: '✅', warn: '⚠️ ', error: '❌', debug: '🔍' };

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(level, ...args) {
  const icon = LEVELS[level] ?? '  ';
  const prefix = `[${timestamp()}] ${icon} [${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

const logger = {
  info:  (...a) => log('info',  ...a),
  warn:  (...a) => log('warn',  ...a),
  error: (...a) => log('error', ...a),
  debug: (...a) => log('debug', ...a),
};

module.exports = { logger };
