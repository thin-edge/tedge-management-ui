const logger = require('pino')()

module.exports = {
    STORAGE_ENABLED : process.env.STORAGE_ENABLED == 'true',
    logger: logger
};