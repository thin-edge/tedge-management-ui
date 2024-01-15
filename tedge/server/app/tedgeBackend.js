// spawn
const { spawn } = require('child_process');
const { TaskQueue } = require('./taskqueue');
const fs = require('fs');
// emitter to signal completion of current task

const propertiesToJSON = require('properties-to-json');
const { MongoClient } = require('mongodb');

const MONGO_DB = 'localDB';
const MONGO_URL = `mongodb://${process.env.MONGO_HOST}:${process.env.MONGO_PORT}?directConnection=true`;
const MONGO_MEASUREMENT_COLLECTION = 'measurement';
const MONGO_SERIES_COLLECTION = 'serie';
const TEDGE_MGM_CONFIGURATION_FILE = '/etc/tedge/tedge-mgm/tedgeMgmConfig.json';
const MAX_MEASUREMENT = 2000;

class TedgeBackend {
  static cmdInProgress = false;
  static measurementCollection = null;
  static seriesCollection = null;
  jobShell = null;
  taskQueue = null;

  constructor(socket) {
    this.socket = socket;

    // bind this to all methods of notifier
    Object.keys(this.notifier).forEach((key) => {
      this.notifier[key] = this.notifier[key].bind(this);
    });
    console.log(`New constructor for socket: ${socket.id}`);
    if (
      TedgeBackend.measurementCollection == null ||
      TedgeBackend.seriesCollection == null
    ) {
      console.error(`Connect to mongo first: ${socket.id}`);
    } else {
      this.watchMeasurementCollection();
    }

    this.taskQueue = new TaskQueue();
    console.log(`Initialized taskQueue: ${this.taskQueue}`);
  }

  notifier = {
    sendProgress: function (job, task) {
      this.socket.emit('job-progress', {
        status: 'processing',
        progress: task.id,
        total: task.total,
        job: job,
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
        job: job,
        total: task.total
      });
    },
    sendJobStart: function (job, promptText, length) {
      this.cmdInProgress = true;
      this.socket.emit('job-progress', {
        status: 'start-job',
        progress: 0,
        job: job,
        promptText: promptText,
        total: length
      });
    },
    sendJobEnd: function (job, task) {
      this.cmdInProgress = false;
      this.socket.emit('job-progress', {
        status: 'end-job',
        progress: task.id,
        job: job,
        total: task.total
      });
    }
  };

  watchMeasurementCollection() {
    let changeStream = undefined;
    let localSocket = this.socket;
    // watch measurement collection for changes
    localSocket.on('new-measurement', function (message) {
      console.log(`New measurement cmd: ${message}`);
      // only start new changed stream if no old ones exists
      if (message == 'start' && !changeStream) {
        console.log(`Really starting measurement cmd: ${message}`);
        changeStream = TedgeBackend.measurementCollection.watch();
        changeStream.on('change', function (change) {
          localSocket.emit(
            'new-measurement',
            JSON.stringify(change.fullDocument)
          );
        });
      } else if (message == 'stop') {
        if (changeStream) {
          console.log(`Stop message stream: ${message}`);
          changeStream.close();
          changeStream = undefined;
        }
      }
    });
  }

  static async getMeasurements(req, res) {
    let displaySpan = req.query.displaySpan;
    let dateFrom = req.query.dateFrom;
    let dateTo = req.query.dateTo;
    if (displaySpan) {
      console.log(
        'Measurement query (last, after):',
        displaySpan,
        new Date(Date.now() - 1000 * parseInt(displaySpan))
      );
      let query = {
        datetime: {
          // 18 minutes ago (from now)
          $gt: new Date(Date.now() - 1000 * parseInt(displaySpan))
        }
      };
      let result = [];
      const cursor = TedgeBackend.measurementCollection
        .find(query)
        .limit(MAX_MEASUREMENT)
        .sort({ datetime: 1 });
      for await (const rawMeasurement of cursor) {
        result.push(rawMeasurement);
      }
      res.status(200).json(result);
    } else {
      console.log('Measurement query (from,to):', dateFrom, dateTo);
      let query = {
        datetime: {
          // 18 minutes ago (from now)
          $gt: new Date(dateFrom),
          $lt: new Date(dateTo)
        }
      };
      let result = [];
      const cursor = TedgeBackend.measurementCollection
        .find(query)
        .limit(MAX_MEASUREMENT)
        .sort({ datetime: 1 });
      for await (const rawMeasurement of cursor) {
        result.push(rawMeasurement);
      }
      res.status(200).json(result);
    }
  }

  static async connect2Mongo() {
    if (
      TedgeBackend.measurementCollection == null ||
      TedgeBackend.seriesCollection == null
    ) {
      console.log('Connecting to mongo ...', MONGO_URL, MONGO_DB);
      const client = await new MongoClient(MONGO_URL);
      const dbo = client.db(MONGO_DB);
      TedgeBackend.measurementCollection = dbo.collection(
        MONGO_MEASUREMENT_COLLECTION
      );
      TedgeBackend.seriesCollection = dbo.collection(MONGO_SERIES_COLLECTION);
    }
  }

  static async getMeasurementTypes(req, res) {
    console.log('Calling getMeasurementTypes ...');
    const query = {};
    const cursor = TedgeBackend.seriesCollection.find(query);
    // Print a message if no documents were found
    if (TedgeBackend.seriesCollection.countDocuments(query) === 0) {
      console.log('No series found!');
    }

    let result = [];
    for await (const measurementType of cursor) {
      const series = measurementType.series;
      measurementType.series = Object.keys(series);
      result.push(measurementType);
    }
    res.status(200).json(result);
  }

  static getTedgeConfiguration(req, res) {
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
        console.log('Output stdout:', Buffer.concat(stdoutChunks).toString());
        if (!sent) {
          let stdoutContent = Buffer.concat(stdoutChunks).toString();
          let config = propertiesToJSON(stdoutContent);
          res.status(200).json(config);
        }
      });
      console.log('Retrieved configuration');
    } catch (err) {
      console.error('Error when reading configuration: ' + err);
      res.status(500).json({ data: err });
    }
  }

  static getEdgeServiceStatus(req, res) {
    try {
      let sent = false;
      var stdoutChunks = [];

      const child = spawn('sh', [
        '-c',
        'rc-status -s | sed -r "s/ {30}//" | sort'
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
        console.log('Output stdout:', Buffer.concat(stdoutChunks).toString());
        if (!sent) {
          let stdoutContent = Buffer.concat(stdoutChunks).toString();
          //stdoutContent = stdoutContent.replace( /.*defunct.*\n/g, '')
          res.status(200).send({ result: stdoutContent });
        }
      });
      console.log('Retrieved job status');
    } catch (err) {
      console.error('Error when executing top: ' + err);
      res.status(500).json({ data: err });
    }
  }

  static async getTedgeMgmConfiguration(req, res) {
    let configuration;
    try {
      let ex = await TedgeBackend.fileExists(TEDGE_MGM_CONFIGURATION_FILE);
      if (!ex) {
        await fs.promises.writeFile(
          TEDGE_MGM_CONFIGURATION_FILE,
          `{"status": "BLANK", "analytics" : {
            "diagramName": "Analytics",
            "selectedMeasurements": []
          }}`
        );
      }
      let rawdata = await fs.promises.readFile(TEDGE_MGM_CONFIGURATION_FILE);
      let str = rawdata.toString();
      configuration = JSON.parse(str);
    //   if (!configuration?.status) configuration.status = 'BLANK';
    //   if (!configuration?.analytics)
    //     configuration.analytics = {
    //       diagramName: 'Analytics',
    //       selectedMeasurements: []
    //     };
      res.status(200).json(configuration);
      console.debug('Retrieved configuration', configuration);
    } catch (err) {
      console.error('Error when reading configuration: ' + err);
      res.status(500).json({ data: err });
    }
  }

  static async setTedgeMgmConfiguration(req, res) {
    let configuration = req.body;
    try {
      await fs.promises.writeFile(
        TEDGE_MGM_CONFIGURATION_FILE,
        JSON.stringify(configuration)
      );
      res.status(200).json(configuration);
      console.log('Saved configuration', configuration);
    } catch (err) {
      console.error('Error when saving configuration: ' + err);
      res.status(500).json({ data: err });
    }
  }

  static async fileExists(filename) {
    try {
      await fs.promises.stat(filename);
      return true;
    } catch (err) {
      //console.log('Testing code: ' + err.code)
      if (err.code === 'ENOENT') {
        return false;
      } else {
        throw err;
      }
    }
  }

  reset(msg) {
    try {
      console.log('Starting resetting ...');
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
      console.log('Restart plugins  ...');
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

  configure(msg) {
    try {
      console.log(
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
      console.log(`Stopping edge processes ${this.cmdInProgress}...`);
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
      console.log(`Starting edge ${this.cmdInProgress} ...`);
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
