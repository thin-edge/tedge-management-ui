const { logger, STORAGE_ENABLED } = require('./global');
// spawn
const { spawn } = require('child_process');
const { TaskQueue } = require('./taskQueue');
const { TedgeFileStore } = require('./tedgeFileStore');
const { TedgeMongoClient } = require('./tedgeMongoClient');
const fs = require('fs');

// emitter to signal completion of current task

const propertiesToJSON = require('properties-to-json');

const mqtt = require('mqtt');
const MQTT_BROKER = process.env.MQTT_BROKER;
const MQTT_PORT = process.env.MQTT_PORT;
const MQTT_URL = `mqtt://${MQTT_BROKER}:${MQTT_PORT}`;
const MQTT_MEASUREMENT_TOPIC = 'te/+/+/+/+/m/+';
const MQTT_LOGFILE_TOPIC = 'te/device/main///cmd/log_upload';

class TedgeBackend {
  activeSubscriptions = {
    logUpload: []
  };
  tedgeConfig = {
    logUpload: []
  };
  mqttClient = null;
  tedgeMongoClient = null;
  tedgeFileStore = null;
  clientStatus = {
    isMQTTConnected: false,
    isMongoConnected: false,
    isStreaming: false
  };

  cmdInProgress = false;
  taskQueue = null;
  socket = null;

  notifier = {
    sendProgress: function (job, task) {
      this.socket.emit('channel-job-progress', {
        status: 'processing',
        progress: task.id,
        total: task.total,
        job: job.jobName,
        cmd: task.cmd + ' ' + task.args.join(' ')
      });
    },
    sendResult: function (result) {
      this.socket.emit('channel-job-output', result);
    },
    sendError: function (job, task, exitCode) {
      this.cmdInProgress = false;
      this.socket.emit('channel-job-output', `${exitCode} (task ${task.id})`);
      this.socket.emit('channel-job-progress', {
        status: 'error',
        progress: task.id,
        job: job.jobName,
        total: task.total
      });
    },
    sendJobStart: function (job, length) {
      this.cmdInProgress = true;
      this.socket.emit('channel-job-progress', {
        status: 'start-job',
        progress: 0,
        job: job.jobName,
        promptText: job.promptText,
        total: length
      });
    },
    sendJobEnd: function (job, task) {
      this.cmdInProgress = false;
      this.socket.emit('channel-job-progress', {
        status: 'end-job',
        progress: task.id,
        job: job.jobName,
        total: task.total
      });
      if (job.jobName == 'configure') {
        this.tedgeFileStore.setTedgeMgmConfigurationInternal({
          status: 'INITIALIZED',
          deviceId: job.deviceId
        });
      } else if (job.jobName == 'start') {
        this.tedgeFileStore.setTedgeMgmConfigurationInternal({
          status: 'REGISTERED'
        });
      } else if (job.jobName == 'upload') {
        this.tedgeFileStore.setTedgeMgmConfigurationInternal({
          status: 'CERTIFICATE_UPLOADED'
        });
      } else if (job.jobName == 'reset') {
        this.tedgeFileStore.setTedgeMgmConfigurationInternal({
          status: 'BLANK'
        });
      }
    }
  };

  constructor() {
    this.tedgeFileStore = new TedgeFileStore();
    this.tedgeMongoClient = new TedgeMongoClient();

    // bind this to all methods of notifier
    Object.keys(this.notifier).forEach((key) => {
      this.notifier[key] = this.notifier[key].bind(this);
    });
    this.taskQueue = new TaskQueue();
    // initialize configuration
    this.tedgeFileStore.getTedgeMgmConfiguration();
    this.initializeMQTT();
    if (STORAGE_ENABLED) {
      this.tedgeMongoClient.initializeMongo();
      this.clientStatus.isMongoConnected =
        this.tedgeMongoClient.isMongoConnected();
    }
  }

  initializeMQTT() {
    this.connectToMQTT();
    this.clientStatus.isMQTTConnected = this.mqttClient
      ? this.mqttClient.connected
      : false;
    this.watchMessagesFromMQTT();
    this.initializeTedgeConfigFromMQTT();
    logger.info(`Connected to MQTT: ${this.clientStatus.isMQTTConnected}!`);
  }

  socketOpened(socket) {
    logger.info(`TedgeBackend, open socket: ${socket.id}`);
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
    this.mqttClient.subscribe(MQTT_LOGFILE_TOPIC);
  }

  watchMessagesFromMQTT() {
    let self = this;

    // watch measurement collection for changes
    this.mqttClient.on('connect', () => {
      self.mqttClient.subscribe(MQTT_MEASUREMENT_TOPIC, (err) => {
        if (!err) {
          logger.info(
            `Successfully subscribed to topic: ${MQTT_MEASUREMENT_TOPIC}`
          );
        }
      });
    });
    logger.info(`Start polling measurement from MQTT.`);

    this.mqttClient.on('message', (topic, message) => {
      // message is Buffer
      // logger.info(`New measurement: ${message.toString()}`);
      const topicSplit = topic.split('/');
      const payload = JSON.parse(message.toString());
      logger.info(`New message: topic ${topic}, ${topicSplit.length}, ${message.toString()}`);
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
          logger.info(`New message (cmd): topic ${topic}`);

          // test for new log_upload cmd
          if (topicSplit[6] === 'log_upload') {
            logger.info(`New message (cmd)(log_upload): topic ${topic}`);

            // test for log_upload request or log_upload config
            if (topicSplit.length > 7) {
              const requestID = topicSplit[7];
              if (self.activeSubscriptions.logUpload.includes(requestID)) {
                const document = {
                  ...payload,
                  requestID
                };
                self.socket.emit(
                  'channel-log-upload',
                  JSON.stringify(document)
                );
                if (['failed', 'successful'].includes(payload.status)) {
                  const topic = `${MQTT_LOGFILE_TOPIC}/${payload.requestID}`;
                  self.mqttClient.unsubscribe(topic);
                  self.activeSubscriptions.logUpload =
                    self.activeSubscriptions.logUpload.reduce(
                      (activeSubs, anySub) => (
                        anySub !== payload.requestID && activeSubs.push(anySub),
                        activeSubs
                      ),
                      []
                    );
                }
              }
            } else {
            logger.info(`New message (cmd)(log_upload)(end): topic ${topic} ${payload.types}`);

              // new log_upload config
              // {
              //     "types": [
              //       "mosquitto",
              //       "software-management",
              //       "c8y_CustomOperation"
              //     ]
              // }
              self.tedgeConfig.logUpload = payload.types;
            }
          }
        }
      }
    });
  }

  async connectToMQTT() {
    this.mqttClient = mqtt.connect(MQTT_URL, { reconnectPeriod: 5000 });
    logger.info(`Connected to MQTT; ${MQTT_BROKER} ${MQTT_URL}`);
  }

  async connectToMongo() {
    this.tedgeMongoClient.connectToMongo();
  }

  async setTedgeMgmConfiguration(req, res) {
    this.tedgeFileStore.setTedgeMgmConfiguration(req, res);
  }

  async getTedgeMgmConfiguration(req, res) {
    this.tedgeFileStore.getTedgeMgmConfiguration(req, res);
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

  async requestTedgeLogfile(req, res) {
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
    const requestMessage = req.body;
    requestMessage.tedgeUrl = `http://127.0.0.1:8000/tedge/file-transfer/wednesday-I/log_upload/${requestMessage.type}-${requestMessage.requestID}`
    const topic = `${MQTT_LOGFILE_TOPIC}/${requestMessage.requestID}`;
    this.mqttClient.publish(topic, JSON.stringify(requestMessage));
    this.mqttClient.subscribe(topic);
    this.activeSubscriptions.logUpload.push(requestMessage.requestID);
    res.status(200).json({ requestID: requestMessage.requestID });
  }

  async getTedgeLogTypes(req, res) {
    res.status(200).json(this.tedgeConfig.logUpload);
  }

  async getTedgeConfiguration(req, res) {
    try {
      let sent = false;
      var stdoutChunks = [];
      const child = spawn('tedge', ['config', 'list']);

      child.stdout.on('data', (data) => {
        stdoutChunks = stdoutChunks.concat(data);
      });
      child.stderr.on('data', (data) => {
        logger.error(`Output stderr: ${data}`);
        res.status(500).json(data);
        sent = true;
      });

      child.on('error', function (err) {
        logger.error('Error : ' + err);
        res.status(500).json(err);
        sent = true;
      });

      child.stdout.on('end', (data) => {
        logger.info('Output stdout:', Buffer.concat(stdoutChunks).toString());
        if (!sent) {
          let stdoutContent = Buffer.concat(stdoutChunks).toString();
          let config = propertiesToJSON(stdoutContent);
          res.status(200).json(config);
        }
      });
      logger.info('Retrieved configuration');
    } catch (err) {
      logger.error('Error getTedgeConfiguration: ' + err);
      res.status(500).json({ data: err });
    }
  }

  async getTedgeServiceStatus(req, res) {
    try {
      let sent = false;
      var stdoutChunks = [];

      //   const child = spawn('sh', [
      //     '-c',
      //     'rc-status -s | sed -r "s/ {10}//" | sort | sed "$ a"'
      //   ]);

      //   const child = spawn('sh', [
      //     '-c',
      //     '( rc-status -s > /etc/tedge/tedge-mgm/rc-status.log ); cat /etc/tedge/tedge-mgm/rc-status.log'
      //   ]);

      const child = spawn('sh', ['-c', 'rc-status -a']);

      child.stdout.on('data', (data) => {
        stdoutChunks = stdoutChunks.concat(data);
      });
      child.stderr.on('data', (data) => {
        logger.error(`Output stderr: ${data}`);
        if (!sent) {
          res.status(500).json(data);
          sent = true;
        }
      });

      child.on('error', function (err) {
        logger.error('Error : ' + err);
        if (!sent) {
          res.status(500).json(data);
          sent = true;
        }
      });

      child.stdout.on('end', (data) => {
        logger.info('Output stdout:', Buffer.concat(stdoutChunks).toString());
        if (!sent) {
          let stdoutContent = Buffer.concat(stdoutChunks).toString();
          res.status(200).send({ result: stdoutContent });
          sent = true;
        }
      });
      logger.info('Retrieved job status');
    } catch (err) {
      logger.error('Error getTedgeServiceStatus: ' + err);
      res.status(500).json({ data: err });
    }
  }

  reset(msg) {
    try {
      logger.info('Starting resetting ...');
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
          cmd: 'echo',
          args: ['Finished resetting edge']
        }
      ];
      if (!this.cmdInProgress) {
        this.taskQueue.queueTasks(msg, tasks, true);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('channel-job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      logger.error(`The following error occurred: ${err.message}`);
    }
  }

  restartPlugins(msg) {
    try {
      logger.info('Restart plugins  ...');
      const tasks = [
        {
          cmd: 'sudo',
          args: ['tedgectl', 'restart', 'c8y-firmware-plugin']
        }
      ];
      if (!this.cmdInProgress) {
        this.taskQueue.queueTasks(msg, tasks, true);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('channel-job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      logger.error(`The following error occurred: ${err.message}`);
    }
  }

  customCommand(msg) {
    try {
      logger.info(`Running custom command ${msg.args} ...`);
      const tasks = [
        {
          cmd: 'sudo',
          args: msg.args
        }
      ];
      if (!this.cmdInProgress) {
        this.taskQueue.queueTasks(msg, tasks, true);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('channel-job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      logger.error(`The following error occurred: ${err.message}`);
    }
  }

  uploadCertificate(msg) {
    try {
      logger.info('Upload certificate  ...');
      // empty job
      const tasks = [
        {
          cmd: 'echo',
          args: ['Upload certificate by UI ..., noting to do']
        }
      ];
      if (!this.cmdInProgress) {
        this.taskQueue.queueTasks(msg, tasks, true);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('channel-job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      logger.error(`The following error occurred: ${err.message}`);
    }
  }

  configure(msg) {
    try {
      logger.info(
        `Starting configuration of edge: ${msg.deviceId}, ${msg.tenantUrl}`
      );

      const tasks = [
        {
          cmd: 'sudo',
          args: ['tedge', 'cert', 'create', '--device-id', msg.deviceId]
        },
        {
          cmd: 'sudo',
          args: ['tedge', 'config', 'set', 'c8y.url', msg.tenantUrl]
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
      if (!this.cmdInProgress) {
        //this.taskQueue.queueTasks(msg.job, msg.promptText, tasks, false);
        this.taskQueue.queueTasks(msg, tasks, false);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('channel-job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      logger.error(`The following error occurred: ${err.message}`);
    }
  }

  stop(msg) {
    try {
      logger.info(`Stopping edge processes ${this.cmdInProgress}...`);
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
      if (!this.cmdInProgress) {
        this.taskQueue.queueTasks(msg, tasks, true);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('channel-job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      logger.error(`The following error occurred: ${err.message}`);
    }
  }

  start(msg) {
    try {
      logger.info(`Starting edge ${this.cmdInProgress} ...`);
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

      if (!this.cmdInProgress) {
        this.taskQueue.queueTasks(msg, tasks, false);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('channel-job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      logger.error(`Error when starting edge:${err}`, err);
    }
  }
}
module.exports = { TedgeBackend };
