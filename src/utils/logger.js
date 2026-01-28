const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

const currentLevel = levels[process.env.LOG_LEVEL] || levels.info;

function formatMessage(level, ...args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    return [prefix, ...args];
}

const logger = {
    error: (...args) => {
        if (currentLevel >= levels.error) {
            console.error(...formatMessage('error', ...args));
        }
    },
    warn: (...args) => {
        if (currentLevel >= levels.warn) {
            console.warn(...formatMessage('warn', ...args));
        }
    },
    info: (...args) => {
        if (currentLevel >= levels.info) {
            console.log(...formatMessage('info', ...args));
        }
    },
    debug: (...args) => {
        if (currentLevel >= levels.debug) {
            console.log(...formatMessage('debug', ...args));
        }
    }
};

module.exports = logger;
