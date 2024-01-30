const { logger } = require('./global');
// spawn
const { spawn } = require('child_process');
const events = require('events');

class TaskQueue {
  static childLogger;
  taskReady = null;
  jobReady = null;
  taskRunning = false;
  jobRunning = false;
  //   dueTasks = [];
  jobQueue = [];
  notifier;
  //   job;
  jobNumber = 0;

  constructor() {
    TaskQueue.childLogger = logger.child({ service: 'TaskQueue' });
    this.taskReady = new events.EventEmitter();
    this.taskReady.on('next-task', (jobDefinition) => {
      this.runNextTask(jobDefinition);
    });
    this.taskReady.on('finished-task', (jobDefinition, exitCode) => {
      this.finishedTask(jobDefinition, exitCode);
    });
    this.runNextTask = this.runNextTask.bind(this);
    this.finishedTask = this.finishedTask.bind(this);

    this.jobReady = new events.EventEmitter();
    this.runNextJob = this.runNextJob.bind(this);
    this.finishedJob = this.finishedJob.bind(this);
    this.jobReady.on('next-job', () => this.runNextJob());
    this.jobReady.on('finished-job', (jobDefinition, exitCode) => {
      this.finishedJob(jobDefinition, exitCode);
    });
  }

  finishedJob(jobDefinition, exitCode) {
    this.jobRunning = false;
    this.runNextJob();
  }

  finishedTask(jobDefinition, exitCode) {
    const { job, dueTasks, nextTask } = jobDefinition;
    this.taskRunning = false;
    // check error
    if (parseInt(exitCode) !== 0) {
      TaskQueue.childLogger.error(
        `Error (event exit): ${exitCode} on task ${job.nextTaskNumber}`
      );
      this.notifier.sendError(jobDefinition, exitCode);

      //continue if task failure is accepted
      const continueOnError = nextTask.continueOnError
        ? nextTask.continueOnError
        : job.continueOnError;
      if (continueOnError) {
        // prepare next task
        this.taskReady.emit('next-task', jobDefinition);
        // send job end when last task in job
        if (job.nextTaskNumber == job.total) {
          this.notifier.sendJobEnd(jobDefinition);
        }
      } else {
        // delete all tasks from queue
        dueTasks = [];
      }
    } else {
      TaskQueue.childLogger.info(
        `After processing task: ${JSON.stringify(nextTask)}, ${job.nextTaskNumber}`
      );
      // prepare next task
      this.taskReady.emit('next-task', jobDefinition);
      // send job end when last task in job
      if (job.nextTaskNumber == job.total) {
        this.notifier.sendJobEnd(jobDefinition);
        this.jobRunning = false;
        this.jobReady.emit('next-job', jobDefinition);
      }
    }
  }

  runNextTask(jobDefinition) {
    const { job, dueTasks } = jobDefinition;

    if (!this.taskRunning && dueTasks.length > 0) {
      TaskQueue.childLogger.info(
        `Currently queued tasks: ${JSON.stringify(job)},  ${JSON.stringify(dueTasks)}`
      );
      this.taskRunning = true;
      let nextTask = dueTasks.shift();
      job.nextTaskNumber = job.nextTaskNumber + 1;
      // check if data is sent, when received in chunks
      let sent = false;
      let stdoutChunks = [];

      TaskQueue.childLogger.info(
        `Start processing task: ${JSON.stringify(nextTask)}, ${job.nextTaskNumber}`
      );
      this.notifier.sendProgress({ job, dueTasks, nextTask });
      var taskSpawn = spawn(nextTask.cmd, nextTask.args);
      taskSpawn.stdout.on('data', (data) => {
        stdoutChunks = stdoutChunks.concat(data);
        // var output = new Buffer.from(data).toString();
        // this.notifier.sendOutput(this.job, nextTask, output);
      });

      taskSpawn.stdout.on('end', (data) => {
        if (!sent) {
          let stdoutContent = Buffer.concat(stdoutChunks).toString();
          this.notifier.sendOutput({ job, dueTasks, nextTask }, stdoutContent);
        }
      });

      taskSpawn.stderr.on('data', (data) => {
        var errorOutput = new Buffer.from(data).toString();
        this.notifier.sendOutput({ job, dueTasks, nextTask }, errorOutput);
        // TODO this is called ven when no error occurs!!
        TaskQueue.childLogger.error(`Error processing task ... ${errorOutput}`);
      });
      taskSpawn.on('exit', (exitCode) => {
        TaskQueue.childLogger.info(
          `On (exit) processing task: ${job.nextTaskNumber}`
        );
        this.taskReady.emit(
          `finished-task`,
          { job, dueTasks, nextTask },
          exitCode
        );
      });

      taskSpawn.on('error', (exitCode) => {
        TaskQueue.childLogger.info(
          `On (exit) processing task${job.nextTaskNumber}`
        );
        this.taskReady.emit(
          `finished-task`,
          { job, dueTasks, nextTask },
          exitCode
        );
      });
    }
  }

  queueJob(job, jobTasks) {
    TaskQueue.childLogger.info('Queued job ...');
    this.jobQueue.push({ job, jobTasks });
    this.jobReady.emit('next-job');
  }

  runNextJob() {
    TaskQueue.childLogger.info(`Schedule job ${this.jobRunning}`);
    if (!this.jobRunning) {
      if (this.jobQueue.length >= 1) {
        const nextJob = this.jobQueue.shift();
        const { job, jobTasks } = nextJob;
        job.nextTaskNumber = 0;
        job.total = jobTasks.length;
        this.jobNumber++;
        job.jobNumber = this.jobNumber;
        let dueTasks = jobTasks;
        this.startJob({ job, dueTasks });
        TaskQueue.childLogger.info('Queued tasks', this.dueTasks);
      }
    }
  }

  startJob(jobDefinition) {
    this.jobRunning = true;
    this.notifier.sendJobStart(jobDefinition);
    this.taskReady.emit('next-task', jobDefinition);
  }

  registerNotifier(no) {
    this.notifier = no;
  }
}

module.exports = { TaskQueue };
