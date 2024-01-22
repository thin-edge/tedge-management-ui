require('console-stamp')(console, {format:':date(HH:MM:ss.l)', level: 'info'});
// spawn
const { spawn } = require('child_process');
const { TaskQueue } = require('./taskQueue');
const { TedgeFileStore } = require('./tedgeFileStore');
const { TedgeMongoClient } = require('./tedgeMongoClient');
const fs = require('fs');

// emitter to signal completion of current task

const propertiesToJSON = require('properties-to-json');

const STORAGE_ENABLED = process.env.STORAGE_ENABLED == 'true';

const mqtt = require('mqtt');
const MQTT_BROKER = process.env.MQTT_BROKER;
const MQTT_PORT = process.env.MQTT_PORT;
const MQTT_URL = `mqtt://${MQTT_BROKER}:${MQTT_PORT}`;
const MQTT_TOPIC = 'te/+/+/+/+/m/+';

class TedgeBackend {
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
      this.socket.emit('job-progress', {
        status: 'processing',
        progress: task.id,
        total: task.total,
        job,
        cmd: task.cmd + ' ' + task.args.join(' ')
      });
    },
    sendResult: function (result) {
      this.socket.emit('job-output', result);
    },
    sendError: function (job, task, exitCode) {
      this.cmdInProgress = false;
      this.socket.emit('job-output', `${exitCode} (task ${task.id})`);
      this.socket.emit('job-progress', {
        status: 'error',
        progress: task.id,
        job,
        total: task.total
      });
    },
    sendJobStart: function (job, promptText, length) {
      this.cmdInProgress = true;
      this.socket.emit('job-progress', {
        status: 'start-job',
        progress: 0,
        job,
        promptText: promptText,
        total: length
      });
    },
    sendJobEnd: function (job, task) {
      this.cmdInProgress = false;
      this.socket.emit('job-progress', {
        status: 'end-job',
        progress: task.id,
        job,
        total: task.total
      });
      if (job == 'configure') {
        this.tedgeFileStore.setTedgeMgmConfigurationInternal({
          status: 'INITIALIZED'
        });
      } else if (job == 'start') {
        this.tedgeFileStore.setTedgeMgmConfigurationInternal({
          status: 'REGISTERED'
        });
      } else if (job == 'upload') {
        this.tedgeFileStore.setTedgeMgmConfigurationInternal({
          status: 'CERTIFICATE_UPLOADED'
        });
      } else if (job == 'reset') {
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
      this.clientStatus.isMongoConnected = this.tedgeMongoClient.isMongoConnected();
    }
  }

  initializeMQTT() {
    this.connectToMQTT();
    this.clientStatus.isMQTTConnected = this.mqttClient
      ? this.mqttClient.connected
      : false;
    this.watchMeasurementFromMQTT();
    console.info(`Connected to MQTT: ${this.clientStatus.isMQTTConnected}!`);
  }

  socketOpened(socket) {
    console.info(`TedgeBackend, open socket: ${socket.id}`);
    this.socket = socket;
    let self = this;
    socket.on('new-measurement', function (message) {
      // only start new changed stream if no old ones exists
      if (message == 'start') {
        self.clientStatus.isStreaming = true;
      } else if (message == 'stop') {
        self.clientStatus.isStreaming = false;
      }
    });
  }

  watchMeasurementFromMQTT() {
    let self = this;

    // watch measurement collection for changes
    this.mqttClient.on('connect', () => {
      self.mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (!err) {
          console.info(`Successfully subscribed to topic: ${MQTT_TOPIC}`);
        }
      });
    });
    console.info(`Start polling measurement from MQTT.`);

    this.mqttClient.on('message', (topic, message) => {
      // message is Buffer
      // console.info(`New measurement: ${message.toString()}`);
      const topicSplit = topic.split('/');
      const device = topicSplit[2];
      const type = topicSplit[6] == '' ? 'default' : topicSplit[6];
      const payload = JSON.parse(message.toString());
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
        self.socket.emit('new-measurement', JSON.stringify(document));

      if (!STORAGE_ENABLED) {
        self.tedgeFileStore.updateMeasurementTypes(document);
      } else {
        self.tedgeMongoClient.updateMeasurementTypes(document);
        self.tedgeMongoClient.storeMeasurement(document);
      }
    });
  }

  async connectToMQTT() {
    this.mqttClient = mqtt.connect(MQTT_URL, { reconnectPeriod: 5000 });
    console.info(`Connected to MQTT; ${MQTT_BROKER} ${MQTT_URL}`);
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
    if (STORAGE_ENABLED)
        this.tedgeMongoClient.getMeasurementTypes(req, res);
    else
        this.tedgeFileStore.getMeasurementTypes(req, res)
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

  async getTedgeConfiguration(req, res) {
    try {
      let sent = false;
      var stdoutChunks = [];
      const child = spawn('tedge', ['config', 'list']);

      child.stdout.on('data', (data) => {
        stdoutChunks = stdoutChunks.concat(data);
      });
      child.stderr.on('data', (data) => {
        console.error(`Output stderr: ${data}`);
        res.status(500).json(data);
        sent = true;
      });

      child.on('error', function (err) {
        console.error('Error : ' + err);
        res.status(500).json(err);
        sent = true;
      });

      child.stdout.on('end', (data) => {
        console.info('Output stdout:', Buffer.concat(stdoutChunks).toString());
        if (!sent) {
          let stdoutContent = Buffer.concat(stdoutChunks).toString();
          let config = propertiesToJSON(stdoutContent);
          res.status(200).json(config);
        }
      });
      console.info('Retrieved configuration');
    } catch (err) {
      console.error('Error getTedgeConfiguration: ' + err);
      res.status(500).json({ data: err });
    }
  }

  async getTedgeServiceStatus(req, res) {
    try {
      let sent = false;
      var stdoutChunks = [];

      const child = spawn('sh', [
        '-c',
        'rc-status -s | sed -r "s/ {10}//" | sort'
      ]);

      child.stdout.on('data', (data) => {
        stdoutChunks = stdoutChunks.concat(data);
      });
      child.stderr.on('data', (data) => {
        console.error(`Output stderr: ${data}`);
        res.status(500).json(data);
        sent = true;
      });

      child.on('error', function (err) {
        console.error('Error : ' + err);
        res.status(500).json(err);
        sent = true;
      });

      child.stdout.on('end', (data) => {
        console.info('Output stdout:', Buffer.concat(stdoutChunks).toString());
        if (!sent) {
          let stdoutContent = Buffer.concat(stdoutChunks).toString();
          res.status(200).send({ result: stdoutContent });
        }
      });
      console.info('Retrieved job status');
    } catch (err) {
      console.error('Error getTedgeServiceStatus: ' + err);
      res.status(500).json({ data: err });
    }
  }

  reset(msg) {
    try {
      console.info('Starting resetting ...');
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
        this.taskQueue.queueTasks(msg.job, msg.promptText, tasks, true);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      console.error(`The following error occurred: ${err.message}`);
    }
  }

  restartPlugins(msg) {
    try {
      console.info('Restart plugins  ...');
      const tasks = [
        {
          cmd: 'sudo',
          args: ['tedgectl', 'restart', 'c8y-firmware-plugin']
        }
      ];
      if (!this.cmdInProgress) {
        this.taskQueue.queueTasks(msg.job, msg.promptText, tasks, true);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      console.error(`The following error occurred: ${err.message}`);
    }
  }

  uploadCertificate(msg) {
    try {
      console.info('Upload certificate  ...');
      // empty job
      const tasks = [
        {
          cmd: 'echo',
          args: ['Upload certificate by UI ..., noting to do']
        }
      ];
      if (!this.cmdInProgress) {
        this.taskQueue.queueTasks(msg.job, msg.promptText, tasks, true);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      console.error(`The following error occurred: ${err.message}`);
    }
  }

  configure(msg) {
    try {
      console.info(
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
        this.taskQueue.queueTasks(msg.job, msg.promptText, tasks, false);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      console.error(`The following error occurred: ${err.message}`);
    }
  }

  stop(msg) {
    try {
      console.info(`Stopping edge processes ${this.cmdInProgress}...`);
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
        this.taskQueue.queueTasks(msg.job, msg.promptText, tasks, true);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      console.error(`The following error occurred: ${err.message}`);
    }
  }

  start(msg) {
    try {
      console.info(`Starting edge ${this.cmdInProgress} ...`);
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
        this.taskQueue.queueTasks(msg.job, msg.promptText, tasks, false);
        this.taskQueue.registerNotifier(this.notifier);
        this.taskQueue.start();
      } else {
        this.socket.emit('job-progress', {
          status: 'ignore',
          progress: 0,
          total: 0
        });
      }
    } catch (err) {
      console.error(`Error when starting edge:${err}`, err);
    }
  }
}
module.exports = { TedgeBackend };
