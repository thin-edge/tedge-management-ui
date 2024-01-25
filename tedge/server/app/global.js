// const logger = require('console-stamp')(console, {
//     format: ":date(isoDateTime) :label(7)",
// //    format: ":date(yyyy-mm-dd HH:MM:ss.lp) :label(7)",
//     level: 'info'
//   });

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint, printf } = format;
const myFormat = printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
  });

const logger = createLogger({
  level: 'info',
  format: combine( timestamp(), myFormat),
  transports: [new transports.Console()]
});
module.exports = {
  STORAGE_ENABLED: process.env.STORAGE_ENABLED == 'true',
  NODE_RED_ENABLED: process.env.NODE_RED_ENABLED == 'true',
  DATE_FORMAT: 'isoDateTime',
  logger
};
