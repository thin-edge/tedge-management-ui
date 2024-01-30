const {
  logger,
  STORAGE_ENABLED,
  MQTT_BROKER,
  MQTT_PORT,
  BACKEND_CONFIGURATION_FILE,
  MEASUREMENT_TYPE_FILE
} = require('./global');
const { TaskQueue } = require('./taskQueue');
const { TedgeFileStore } = require('./tedgeFileStore');
const { TedgeMongoClient } = require('./tedgeMongoClient');

const mqtt = require('mqtt');
const http = require('http');
const { makeGetRequest } = require('./utils');
const MQTT_URL = `mqtt://${MQTT_BROKER}:${MQTT_PORT}`;
const MQTT_TOPIC_MEASUREMENT = 'te/+/+/+/+/m/+';
const MQTT_TOPIC_CMD_PARTIAL = 'te/device/main///cmd';

class TedgeBackend {
  static childLogger;
  activeSubscriptions = {
    log_upload: [],
    config_snapshot: [],
    config_update: []
  };
  tedgeConfig = {
    logTypes: [],
    configTypes: []
  };
  mqttClient = null;
  tedgeMongoClient = null;
  tedgeFileStore = null;
  clientStatus = {
    isMQTTConnected: false,
    isMongoConnected: false,
    isStreaming: false
  };

  taskQueue = null;
  socket = null;

  notifier = {
    sendProgress: function (jobDefinition) {
      const { job, dueTasks, nextTask } = jobDefinition;
      this.socket.emit('channel-job-progress', {
        status: 'processing',
        progress: nextTask.id,
        total: job.total,
        jobName: job.jobName,
        cmd: nextTask.cmd + ' ' + nextTask.args.join(' ')
      });
    },
    sendOutput: function (jobDefinition, output) {
      const { job, dueTasks, nextTask } = jobDefinition;
      this.socket.emit('channel-job-output', {
        jobName: job.jobName,
        task: nextTask.cmd,
        output
      });
    },
    sendError: function (jobDefinition, exitCode) {
      const { job, nextTask } = jobDefinition;
      this.socket.emit('channel-job-output', {
        jobName: job.jobName,
        task: nextTask.cmd,
        output: `${exitCode} (task ${nextTask.id})`
      });
      this.socket.emit('channel-job-progress', {
        status: 'error',
        progress: nextTask.id,
        jobName: job.jobName,
        total: job.total
      });
    },
    sendJobStart: function (jobDefinition) {
      const { job } = jobDefinition;
      this.socket.emit('channel-job-progress', {
        status: 'start-job',
        progress: 0,
        jobName: job.jobName,
        promptText: job.promptText,
        total: job.total
      });
    },
    sendJobEnd: function (jobDefinition) {
      const { job, dueTasks, nextTask } = jobDefinition;
      this.socket.emit('channel-job-progress', {
        status: 'end-job',
        progress: nextTask.id,
        jobName: job.jobName,
        total: job.total
      });
      if (job.jobName == 'configureTedge') {
        this.tedgeFileStore.upsertBackendConfiguration({
          status: 'INITIALIZED',
          deviceId: job.deviceId
        });
        this.requestTedgeConfiguration({
          jobName: 'tedgeConfiguration',
          promptText: 'Get tedge configuration  ...'
        });
      } else if (job.jobName == 'startTedge') {
        this.tedgeFileStore.upsertBackendConfiguration({
          status: 'REGISTERED'
        });
        this.requestTedgeServiceStatus({
          jobName: 'serviceStatus',
          promptText: 'Get service status ...'
        });
      } else if (job.jobName == 'uploadCertificate') {
        this.tedgeFileStore.upsertBackendConfiguration({
          status: 'CERTIFICATE_UPLOADED'
        });
        this.requestTedgeConfiguration({
          jobName: 'tedgeConfiguration',
          promptText: 'Get tedge configuration  ...'
        });
      } else if (job.jobName == 'resetTedge') {
        this.tedgeFileStore.upsertBackendConfiguration({
          status: 'BLANK'
        });
        this.requestTedgeConfiguration({
          jobName: 'tedgeConfiguration',
          promptText: 'Get tedge configuration  ...'
        });
      } else if (
        // send uupdate on service status id service change
        (job.jobName == 'custom' &&
          job.args != undefined &&
          job.args.length >= 1 &&
          job.args[0] == 'rc-service') ||
        job.jobName == 'stopTedge'
      ) {
        this.requestTedgeServiceStatus({
          jobName: 'serviceStatus',
          promptText: 'Get service status ...'
        });
      }
    }
  };

  constructor() {
    TedgeBackend.childLogger = logger.child({ service: 'TedgeBackend' });
    this.tedgeFileStore = new TedgeFileStore();
    this.tedgeMongoClient = new TedgeMongoClient();

    // bind this to all methods of notifier
    Object.keys(this.notifier).forEach((key) => {
      this.notifier[key] = this.notifier[key].bind(this);
    });
    this.taskQueue = new TaskQueue();
    this.taskQueue.registerNotifier(this.notifier);
  }

  async initClients() {
    if (STORAGE_ENABLED) {
      this.tedgeMongoClient.init();
      this.clientStatus.isMongoConnected =
        this.tedgeMongoClient.isMongoConnected();
    }
    this.tedgeFileStore.init();
    this.initializeMQTT();
  }

  initializeMQTT() {
    this.connectToMQTT();
    this.watchMessagesFromMQTT();
    this.initializeTedgeConfigFromMQTT();
  }

  socketOpened(socket) {
    TedgeBackend.childLogger.info(
      `Open channel ''channel-measurement'' on socket : ${socket.id}`
    );
    this.socket = socket;
    let self = this;
    socket.on('channel-measurement', function (message) {
      // only start new changed stream if no old ones exists
      if (message == 'start') {
        self.clientStatus.isStreaming = true;
      } else if (message == 'stop') {
        self.clientStatus.isStreaming = false;
      }
    });
  }

  initializeTedgeConfigFromMQTT() {
    this.mqttClient.subscribe(`${MQTT_TOPIC_CMD_PARTIAL}/log_upload`);
    this.mqttClient.subscribe(`${MQTT_TOPIC_CMD_PARTIAL}/config_snapshot`);
  }

  watchMessagesFromMQTT() {
    let self = this;

    // watch measurement collection for changes
    this.mqttClient.on('connect', () => {
      self.mqttClient.subscribe(MQTT_TOPIC_MEASUREMENT, (err) => {
        if (!err) {
          TedgeBackend.childLogger.info(
            `Successfully subscribed to topic: ${MQTT_TOPIC_MEASUREMENT}`
          );
        }
      });
    });
    TedgeBackend.childLogger.info(`Start polling measurement from MQTT`);

    this.mqttClient.on('message', (topic, message) => {
      // message is Buffer
      // TedgeBackend.childLogger.info(`New measurement: ${message.toString()}`);
      const topicSplit = topic.split('/');
      const payload = JSON.parse(message.toString());
      // TedgeBackend.childLogger.info(`New message: topic ${topic}, ${topicSplit.length}`);
      TedgeBackend.childLogger.debug(
        `New message: topic ${topic}, ${topicSplit.length}, ${message.toString()}`
      );
      // branch on topic
      if (topicSplit[5]) {
        // test for new measurement
        if (topicSplit[5] === 'm') {
          const device = topicSplit[2];
          const type = topicSplit[6] == '' ? 'default' : topicSplit[6];
          const datetime = new Date(payload.time);
          delete payload.time;
          const document = {
            topic,
            device,
            payload,
            type,
            datetime
          };
          if (self.clientStatus.isStreaming && self.socket)
            self.socket.emit('channel-measurement', JSON.stringify(document));

          if (!STORAGE_ENABLED) {
            self.tedgeFileStore.updateMeasurementTypes(document);
          } else {
            self.tedgeMongoClient.updateMeasurementTypes(document);
            self.tedgeMongoClient.storeMeasurement(document);
          }
        } else if (topicSplit[5] === 'cmd') {
          TedgeBackend.childLogger.info(`New message (cmd): topic ${topic}`);

          const cmdType = topicSplit[6];
          TedgeBackend.childLogger.info(
            `New message (cmd)(${cmdType}): topic ${topic}`
          );
          // test for log_upload request or log_upload config
          if (topicSplit.length > 7) {
            const requestID = topicSplit[7];
            if (self.activeSubscriptions[cmdType].includes(requestID)) {
              const document = {
                cmdType,
                payload: {
                  ...payload,
                  requestID
                }
              };
              self.socket.emit('channel-tedge-cmd', document);
              if (['failed', 'successful'].includes(payload.status)) {
                const topic = `${MQTT_TOPIC_CMD_PARTIAL}/${cmdType}/${requestID}`;
                self.mqttClient.unsubscribe(topic);
                self.activeSubscriptions[cmdType] = self.activeSubscriptions[
                  cmdType
                ].reduce(
                  (activeSubs, anySub) => (
                    anySub !== requestID && activeSubs.push(anySub), activeSubs
                  ),
                  []
                );
                // publish empty message on channel to to release retained messages
                TedgeBackend.childLogger.info(
                  `Release retained messages (cmd)(${cmdType}): topic ${topic}`
                );
                self.mqttClient.publish(topic, '', { retain: true });
              }
            }
          } else {
            TedgeBackend.childLogger.info(
              `New message (cmd)(${cmdType})(end): topic ${topic} ${payload.types}`
            );
            if (cmdType === 'log_upload') {
              self.tedgeConfig.logTypes = payload.types;
            } else if (cmdType === 'config_snapshot') {
              self.tedgeConfig.configTypes = payload.types;
            }
          }
        }
      }
    });
  }

  async connectToMQTT() {
    this.mqttClient = mqtt.connect(MQTT_URL, { reconnectPeriod: 5000 });
    TedgeBackend.childLogger.info(
      `Connected to MQTT: ${MQTT_BROKER} ${MQTT_URL}`
    );
  }

  async setBackendConfiguration(req, res) {
    this.tedgeFileStore.setBackendConfiguration(req, res);
  }

  async getBackendConfiguration(req, res) {
    this.tedgeFileStore.getBackendConfiguration(req, res);
  }

  async getMeasurements(req, res) {
    this.tedgeMongoClient.getMeasurements(req, res);
  }

  async getMeasurementTypes(req, res) {
    if (STORAGE_ENABLED) this.tedgeMongoClient.getMeasurementTypes(req, res);
    else this.tedgeFileStore.getMeasurementTypes(req, res);
  }

  async getStorageStatistic(req, res) {
    this.tedgeMongoClient.getStorageStatistic(req, res);
  }

  async getStorageTTL(req, res) {
    this.tedgeMongoClient.getStorageTTL(req, res);
  }

  async updateStorageTTL(req, res) {
    this.tedgeMongoClient.updateStorageTTL(req, res);
  }

  async sendTedgeGenericCmdRequest(req, res) {
    // '{
    //   "status": "init",
    //   "requestID": "1234",
    //   "tedgeUrl": "
    // http://127.0.0.1:8000/tedge/file-transfer/example/log_upload/mosquitto-1234"
    // ,
    //   "type": "mosquitto",
    //   "dateFrom": "2013-06-22T17:03:14.000+02:00",
    //   "dateTo": "2013-06-23T18:03:14.000+02:00",
    //   "searchText": "ERROR",
    //   "lines": 1000
    // }'
    const { payload, cmdType, requestID } = req.body;
    const main = this.tedgeFileStore.getBackendConfigurationCached().deviceId;
    TedgeBackend.childLogger.info(`Request for deviceId: ${main}`);
    const tedgeUrl = `http://127.0.0.1:8000/tedge/file-transfer/main/${cmdType}/${payload.type}-${requestID}`;
    let topic = `${MQTT_TOPIC_CMD_PARTIAL}/${cmdType}/${requestID}`;
    payload.tedgeUrl = tedgeUrl;
    this.activeSubscriptions[cmdType].push(requestID);

    if (cmdType === 'config_update') {
      const options = {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain'
        }
      };
      const req = http.request(tedgeUrl, options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          TedgeBackend.childLogger.info(
            `Response from fileTransfer: ${responseData}`
          );
        });
      });

      req.on('error', (error) => {
        TedgeBackend.childLogger.info(
          `Error from fileTransfer: ${error.message}`
        );
        res.status(500).json({ data: err, requestID });
      });

      req.write(payload.configContent);
      req.end();
      payload.remoteUrl = 'http://www.my.url';
    }
    this.mqttClient.publish(topic, JSON.stringify(payload));
    this.mqttClient.subscribe(topic);
    res.status(200).json({ requestID });
  }

  async getTedgeGenericCmdResponse(req, res) {
    let tedgeUrl = req.query.tedgeUrl;
    // '{
    //   "status": "init",
    //   "requestID": "1234",
    //   "tedgeUrl": "
    // http://127.0.0.1:8000/tedge/file-transfer/example/log_upload/mosquitto-1234"
    // ,
    //   "type": "mosquitto",
    //   "dateFrom": "2013-06-22T17:03:14.000+02:00",
    //   "dateTo": "2013-06-23T18:03:14.000+02:00",
    //   "searchText": "ERROR",
    //   "lines": 1000
    // }'
    makeGetRequest(tedgeUrl).then((result) => {
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(result);
    });
  }

  async getTedgeGenericConfigType(req, res) {
    const configType = req.params.type;
    if (configType === 'logTypes') {
      res.status(200).json(this.tedgeConfig.logTypes);
    } else {
      res.status(200).json(this.tedgeConfig.configTypes);
    }
  }

  requestTedgeServiceStatus(job) {
    //   const child = spawn('sh', [
    //     '-c',
    //     'rc-status -s | sed -r "s/ {10}//" | sort | sed "$ a"'
    //   ]);

    //   const child = spawn('sh', [
    //     '-c',
    //     '( rc-status -s > /etc/tedge/tedge-mgm/rc-status.log ); cat /etc/tedge/tedge-mgm/rc-status.log'
    //   ]);
    try {
      TedgeBackend.childLogger.info(`Running command ${job.jobName} ...`);
      const tasks = [
        {
          cmd: 'sudo',
          args: ['rc-status', '-a']
        }
      ];

      this.taskQueue.queueJob(job, tasks, true);
    } catch (err) {
      TedgeBackend.childLogger.error(
        `Running command ${job.jobName} with error ...`,
        err
      );
    }
  }

  requestTedgeConfiguration(job) {
    try {
      TedgeBackend.childLogger.info(`Running command ${job.jobName} ...`);
      const tasks = [
        {
          cmd: 'sudo',
          args: ['tedge', 'config', 'list']
        }
      ];

      this.taskQueue.queueJob(job, tasks, true);
    } catch (err) {
      TedgeBackend.childLogger.error(
        `Running command ${job.jobName} with error ...`,
        err
      );
    }
  }

  resetTedge(job) {
    try {
      TedgeBackend.childLogger.info('Starting resetting ...');
      const tasks = [
        {
          cmd: 'sudo',
          args: ['tedge', 'cert', 'remove']
        },
        {
          cmd: 'sudo',
          args: ['tedge', 'disconnect', 'c8y']
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'stop', 'mosquitto']
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'stop', 'tedge-mapper-c8y']
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'stop', 'tedge-agent']
        },
        {
          cmd: 'sudo',
          args: ['rm', '-f', BACKEND_CONFIGURATION_FILE],
          continueOnError: true
        },
        {
          cmd: 'sudo',
          args: ['rm', '-f', MEASUREMENT_TYPE_FILE],
          continueOnError: true
        },
        {
          cmd: 'echo',
          args: ['Finished resetting edge']
        }
      ];

      this.taskQueue.queueJob(job, tasks, true);
    } catch (err) {
      TedgeBackend.childLogger.error(
        `Running command ${job.jobName} with error ...`,
        err
      );
    }
  }

  customCommand(job) {
    try {
      TedgeBackend.childLogger.info(`Running custom command ${job.args} ...`);
      const tasks = [
        {
          cmd: 'sudo',
          args: job.args
        }
      ];

      this.taskQueue.queueJob(job, tasks, true);
    } catch (err) {
      TedgeBackend.childLogger.error(
        `Running command ${job.jobName} with error ...`,
        err
      );
    }
  }

  uploadCertificate(job) {
    try {
      TedgeBackend.childLogger.info('Upload certificate  ...');
      // empty job
      const tasks = [
        {
          cmd: 'echo',
          args: ['Upload certificate by UI ..., noting to do']
        }
      ];

      this.taskQueue.queueJob(job, tasks, true);
    } catch (err) {
      TedgeBackend.childLogger.error(
        `Running command ${job.jobName} with error ...`,
        err
      );
    }
  }

  configureTedge(job) {
    try {
      TedgeBackend.childLogger.info(
        `Starting configuration of edge: ${job.deviceId}, ${job.tenantUrl}`
      );

      const tasks = [
        {
          cmd: 'sudo',
          args: ['tedge', 'cert', 'create', '--device-id', job.deviceId]
        },
        {
          cmd: 'sudo',
          args: ['tedge', 'config', 'set', 'c8y.url', job.tenantUrl]
        },
        {
          cmd: 'sudo',
          args: ['tedge', 'config', 'set', 'mqtt.bind.port', '1883']
        },
        {
          cmd: 'sudo',
          args: ['tedge', 'config', 'set', 'mqtt.bind.address', '0.0.0.0']
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'restart', 'collectd']
        }
      ];

      this.taskQueue.queueJob(job, tasks, false);
    } catch (err) {
      TedgeBackend.childLogger.error(
        `Running command ${job.jobName} with error ...`,
        err
      );
    }
  }

  stopTedge(job) {
    try {
      TedgeBackend.childLogger.info(`Stopping edge processes ...`);
      const tasks = [
        {
          cmd: 'sudo',
          args: ['tedge', 'disconnect', 'c8y'],
          continueOnError: true
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'stop', 'mosquitto'],
          continueOnError: true
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'stop', 'tedge-mapper-c8y'],
          continueOnError: true
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'stop', 'tedge-agent'],
          continueOnError: true
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'stop', 'collectd'],
          continueOnError: true
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'stop', 'tedge-mapper-collectd'],
          continueOnError: true
        }
      ];

      this.taskQueue.queueJob(job, tasks, true);
    } catch (err) {
      TedgeBackend.childLogger.error(
        `Running command ${job.jobName} with error ...`,
        err
      );
    }
  }

  startTedge(job) {
    try {
      TedgeBackend.childLogger.info(`Starting edge ...`);
      const tasks = [
        {
          cmd: 'sudo',
          args: ['tedge', 'connect', 'c8y'],
          continueOnError: true
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'start', 'collectd'],
          continueOnError: true
        },
        {
          cmd: 'sudo',
          args: ['tedgectl', 'start', 'tedge-mapper-collectd'],
          continueOnError: true
        }
      ];

      this.taskQueue.queueJob(job, tasks, false);
    } catch (err) {
      TedgeBackend.childLogger.error(`Error when starting edge:${err}`, err);
    }
  }
}
module.exports = { TedgeBackend };
