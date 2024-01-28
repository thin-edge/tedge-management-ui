// const logger = require('console-stamp')(console, {
//     format: ":date(isoDateTime) :label(7)",
// //    format: ":date(yyyy-mm-dd HH:MM:ss.lp) :label(7)",
//     level: 'info'
//   });

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, errors, label, prettyPrint, printf } = format;
const customFormat = printf(({ level, service, message, timestamp }) => {
  return `${timestamp} ${level}: ${service}: ${message}`;
});

const BACKEND_CONFIGURATION_FILE = '/etc/tedge/tedge-mgm/backendConfig.json';
const MEASUREMENT_TYPE_FILE = '/etc/tedge/tedge-mgm/measurementTypes.json';

const logger = createLogger({
  level: 'info',
//   defaultMeta: {
//     service: 'Server'
//   },
  format: combine(timestamp(), customFormat, errors({ stack: true })), 
  transports: [new transports.Console()]
});
module.exports = {
  PORT: process.env.PORT || 9080,
  MQTT_BROKER: process.env.MQTT_BROKER,
  MQTT_PORT: process.env.MQTT_PORT,
  MONGO_HOST: process.env.MONGO_HOST,
  MONGO_PORT: process.env.MONGO_PORT,
  STORAGE_ENABLED: process.env.STORAGE_ENABLED == 'true',
  ANALYTICS_FLOW_ENABLED: process.env.ANALYTICS_FLOW_ENABLED == 'true',
  DATE_FORMAT: 'isoDateTime',
  logger,
  BACKEND_CONFIGURATION_FILE,
  MEASUREMENT_TYPE_FILE
};
