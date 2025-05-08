const {
  logger,
  STORAGE_ENABLED,
  MQTT_HOST,
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
const MQTT_URL = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
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
    isStorageConnected: false,
    isStreaming: false
  };
  tedgeConfiguration = null;

  taskQueue = null;
  socket = null;

  emitter = {
    sendProgress: function (jobDefinition) {
      const { job, jobTasks, nextTask } = jobDefinition;
      this.socket.emit('channel-job-progress', {
        jobName: job.jobName,
        status: 'processing',
        cmd: nextTask.cmd + ' ' + nextTask.args.join(' '),
        currentTask: job.currentTask,
        totalTask: job.totalTask,
        displayingProgressBar: job.displayingProgressBar
      });
    },
    sendOutput: function (jobDefinition, output) {
      const { job, jobTasks, nextTask } = jobDefinition;
      const services = [];
      if (job.jobName == 'serviceStatus') {
        const backendConfiguration =
          this.tedgeFileStore.getBackendConfigurationCached();
        const systemManager = backendConfiguration.systemManager;
        TedgeBackend.childLogger.info(
          `Running serviceStatus ${systemManager} ${output} ...`
        );

        if (systemManager == 'openrc') {
          const pattern = /^\s*(\S+)\s+\[\s*(\w+).*\]/gm;
          const deduplicateServices = [];
          let match;
          while ((match = pattern.exec(output)) !== null) {
            const [, service, status] = match;
            // console.log('Service', first, service);
            const color =
              status == 'started'
                ? 'green'
                : status == 'stopped'
                  ? 'red'
                  : 'orange';
            // remove duplicate service reported on different runlevels
            if (!deduplicateServices.includes(service)) {
              services.push({ id: service, service, status, color });
              deduplicateServices.push(service);
            }
          }
        } else if (systemManager == 'systemd') {
          //A(?:nt|pple)
          const pattern = /^\s+([\w\-\.]+)\s+([\w\-\.]+)\s+(\S+)\s+(\S+).*/gm;
          let match;
          while ((match = pattern.exec(output)) !== null) {
            let [, service, load, active, status] = match;
            // console.log('Service', first, service);
            if (['running', 'active'].includes(status)) status = 'started';
            else if (status === 'exited') status = 'stopped';
            else if (status === 'activating') status = 'starting';
            else if (status === 'deactivating') status = 'deactivating';
            else if (status === 'failed') status = 'crashed';
            [service] = service.split('.');
            const color =
              status == 'started'
                ? 'green'
                : ['stopped', 'crashed'].includes(status)
                  ? 'red'
                  : 'orange';
            // ignore header
            if (service !== 'UNIT') {
              services.push({ id: service, service, status, color });
            }
          }
        }
        output = JSON.stringify(services);
      }
      this.socket.emit('channel-task-output', {
        jobName: job.jobName,
        currentTask: job.currentTask,
        task: nextTask.cmd,
        output
      });
    },
    sendError: function (jobDefinition, exitCode) {
      const { job, nextTask } = jobDefinition;
      this.socket.emit('channel-task-output', {
        jobName: job.jobName,
        task: nextTask.cmd,
        output: `${exitCode} (task ${job.currentTask})`
      });
      this.socket.emit('channel-job-progress', {
        jobName: job.jobName,
        status: 'error',
        currentTask: job.currentTask,
        totalTask: job.totalTask
      });
    },
    sendJobStart: function (jobDefinition) {
      const { job } = jobDefinition;
      this.socket.emit('channel-job-progress', {
        jobName: job.jobName,
        status: 'start-job',
        promptText: job.promptText,
        currentTask: job.currentTask,
        totalTask: job.totalTask
      });
    },
    sendJobEnd: function (jobDefinition) {
      const { job, jobTasks, nextTask } = jobDefinition;
      this.socket.emit('channel-job-progress', {
        jobName: job.jobName,
        status: 'end-job',
        currentTask: job.currentTask,
        totalTask: job.totalTask
      });

      if (job.jobName == 'configureTedge') {
        this.tedgeFileStore.upsertBackendConfiguration({
          status: 'INITIALIZED',
          deviceId: job.deviceId,
          c8yUrl: job.c8yUrl
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
        this.tedgeFileStore.initializeBackendConfiguration(true);
        this.requestTedgeConfiguration({
          jobName: 'tedgeConfiguration',
          promptText: 'Get tedge configuration  ...'
        });
      } else if (
        // send update on service status id service change
        (job.jobName == 'custom' &&
          job.args != undefined &&
          job.args.length >= 1 &&
          job.args[0] == 'tedgectl') ||
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

    // bind this to all methods of emitter
    Object.keys(this.emitter).forEach((key) => {
      this.emitter[key] = this.emitter[key].bind(this);
    });
    this.taskQueue = new TaskQueue(this.emitter);

    TedgeBackend.childLogger.info(`Init taskBackend ...`);
    //this.taskQueue = new TaskQueue(this.emitter);
  }

  async initClients() {
    if (STORAGE_ENABLED) {
      await this.tedgeMongoClient.init();
      this.clientStatus.isStorageConnected =
        this.tedgeMongoClient.isMongoConnected();
    }
    this.tedgeFileStore.init();
    this.initializeMQTT();
  }

  initializeMQTT() {
    this.connectMQTT();
    this.listenMessagesFromMQTT();
    this.initializeTedgeConfigFromMQTT();
  }

  socketOpened(socket) {
    TedgeBackend.childLogger.info(
      `Open channel 'channel-measurement' on socket : ${socket.id}`
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

  listenMessagesFromMQTT() {
    let self = this;

    // listen measurement collection for changes
    this.mqttClient.on('connect', () => {
      self.clientStatus.isMQTTConnected = self.mqttClient.connected;
      self.mqttClient.subscribe(MQTT_TOPIC_MEASUREMENT, (err) => {
        if (!err) {
          TedgeBackend.childLogger.info(
            `Successfully subscribed to topic: ${MQTT_TOPIC_MEASUREMENT}`
          );
        }
      });
    });
    this.mqttClient.on('disconnect', () => {
      self.clientStatus.isMQTTConnected = self.mqttClient.connected;
      TedgeBackend.childLogger.info(
        `Disconnected from MQTT: ${self.mqttClient.connected}`
      );
    });
    this.mqttClient.on('error', error => {
      self.clientStatus.isMQTTConnected = self.mqttClient.connected;
      TedgeBackend.childLogger.info(
        `${error}, isMQTTConnected: ${self.mqttClient.connected}`
      );
    });
    this.mqttClient.on('close', () => {
      self.clientStatus.isMQTTConnected = self.mqttClient.connected;
      TedgeBackend.childLogger.debug(
        `Close from MQTT: ${self.mqttClient.connected}`
      );
    });
    TedgeBackend.childLogger.info(`Start polling for measurements from MQTT`);

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

  async connectMQTT() {
    TedgeBackend.childLogger.info(
      `About to connect to MQTT: ${MQTT_HOST} ${MQTT_URL}`
    );
    this.mqttClient = mqtt.connect(MQTT_URL, { reconnectPeriod: 10000 });
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

  async getDeviceStatistic(req, res) {
    if (STORAGE_ENABLED) this.tedgeMongoClient.getDeviceStatistic(req, res);
    else this.tedgeFileStore.getDeviceStatistic(req, res);
  }

  async getStorageIndex(req, res) {
    this.tedgeMongoClient.getStorageIndex(req, res);
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
        TedgeBackend.childLogger.error(
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

  getClientStatus(req, res) {
    TedgeBackend.childLogger.info(
      `Return clientStatus: ${JSON.stringify(this.clientStatus)}`
    );
    res.status(200).json(this.clientStatus);
  }

  requestTedgeServiceStatus(job) {
    try {
      TedgeBackend.childLogger.info(`Running command ${job.jobName} ...`);
      let jobTasks;
      const backendConfiguration =
        this.tedgeFileStore.getBackendConfigurationCached();

      if (backendConfiguration.systemManager == 'openrc') {
        jobTasks = [
          {
            cmd: 'sudo',
            args: ['tedgectl', 'is_available']
          }
        ];
        job.continueOnError = true;
        this.taskQueue.queueJob(job, jobTasks);
      } else if (backendConfiguration.systemManager == 'systemd') {
        jobTasks = [
          {
            cmd: 'sudo',
            args: [
              'systemctl',
              'list-units',
              '--type=service',
              '--all',
              //  '--state=active',
              '--no-pager'
            ]
          }
        ];
        job.continueOnError = true;
        this.taskQueue.queueJob(job, jobTasks);
      } else {
        this.socket.emit('channel-job-progress', {
          status: 'ignore',
          currentTask: 0,
          totalTask: 0
        });
      }
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
      const jobTasks = [
        {
          cmd: 'sudo',
          args: ['tedge', 'config', 'list']
        }
      ];

      job.continueOnError = true;
      this.taskQueue.queueJob(job, jobTasks);
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
      const jobTasks = [
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

      job.continueOnError = true;
      this.taskQueue.queueJob(job, jobTasks);
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
      const jobTasks = [
        {
          cmd: 'sudo',
          args: job.args
        }
      ];

      job.continueOnError = true;
      this.taskQueue.queueJob(job, jobTasks);
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
      const jobTasks = [
        {
          cmd: 'echo',
          args: ['Upload certificate by UI ..., noting to do']
        }
      ];

      job.continueOnError = true;
      this.taskQueue.queueJob(job, jobTasks);
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
        `Starting configuration of edge: ${job.deviceId}, ${job.c8yUrl}`
      );

      const jobTasks = [
        {
          cmd: 'sudo',
          args: ['tedge', 'cert', 'create', '--device-id', job.deviceId]
        },
        {
          cmd: 'sudo',
          args: ['tedge', 'config', 'set', 'c8y.url', job.c8yUrl]
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

      job.continueOnError = true;
      this.taskQueue.queueJob(job, jobTasks);
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
      const jobTasks = [
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

      job.continueOnError = true;
      this.taskQueue.queueJob(job, jobTasks);
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
      const jobTasks = [
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

      job.continueOnError = false;
      this.taskQueue.queueJob(job, jobTasks);
    } catch (err) {
      TedgeBackend.childLogger.error(`Error when starting edge:${err}`, err);
    }
  }
}
module.exports = { TedgeBackend };
