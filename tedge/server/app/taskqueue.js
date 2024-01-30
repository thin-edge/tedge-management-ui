const { logger } = require('./global');
// spawn
const { spawn } = require('child_process');
const events = require('events');

class TaskQueue {
  static childLogger;
  taskReady;
  taskRunning = false;
  jobRunning = false;
  dueTasks = [];
  jobQueue = [];
  notifier;
  job;
  jobNumber = 0;

  constructor() {
    TaskQueue.childLogger = logger.child({ service: 'TaskQueue' });
    this.taskReady = new events.EventEmitter();
    this.jobReady = new events.EventEmitter();
    this.runNextTask = this.runNextTask.bind(this);
    this.finishedTask = this.finishedTask.bind(this);
    this.runNextJob = this.runNextJob.bind(this);
    this.finishedJob = this.finishedJob.bind(this);
    this.taskReady.on('next-task', this.runNextTask);
    this.taskReady.on('finished-task', (task, exitCode) => {
      this.finishedTask(task, exitCode);
    });
    this.jobReady.on('next-job', this.runNextJob);
    this.jobReady.on('finished-job', (job, exitCode) => {
      this.finishedJob(job, exitCode);
    });
  }

  finishedJob(job, exitCode) {
    this.jobRunning = false;
    this.runNextJob();
  }

  finishedTask(task, exitCode) {
    this.taskRunning = false;
    // check error
    if (parseInt(exitCode) !== 0) {
      TaskQueue.childLogger.error(
        `Error (event exit): ${exitCode} on task ${task.id}`
      );
      this.notifier.sendError(this.job, task, exitCode);

      //continue if task failure is accepted
      if (task.continueOnError) {
        // prepare next task
        this.taskReady.emit('next-task');
        // send job end when last task in job
        if (task.id == task.total) {
          this.notifier.sendJobEnd(this.job, task);
        }
      } else {
        // delete all tasks from queue
        this.dueTasks = [];
      }
    } else {
      TaskQueue.childLogger.info(
        `After processing task: ${JSON.stringify(task)}, ${task.id}`
      );
      // prepare next task
      this.taskReady.emit('next-task');
      // send job end when last task in job
      if (task.id + 1 == task.total) {
        this.notifier.sendJobEnd(this.job, task);
        this.jobRunning = false;
        this.jobReady.emit('next-job');
      }
    }
  }

  runNextTask() {
    if (!this.taskRunning && this.dueTasks.length > 0) {
      TaskQueue.childLogger.info(
        `Currently queued tasks: ${JSON.stringify(this.job)},  ${JSON.stringify(this.dueTasks)}`
      );
      this.taskRunning = true;
      let nextTask = this.dueTasks.shift();
      // check if data is sent, when received in chunks
      let sent = false;
      let stdoutChunks = [];

      TaskQueue.childLogger.info(
        `Start processing task: ${JSON.stringify(nextTask)}, ${nextTask.jobNumber}:${nextTask.id}`
      );
      this.notifier.sendProgress(this.job, nextTask);
      var taskSpawn = spawn(nextTask.cmd, nextTask.args);
      taskSpawn.stdout.on('data', (data) => {
        stdoutChunks = stdoutChunks.concat(data);
        // var output = new Buffer.from(data).toString();
        // this.notifier.sendOutput(this.job, nextTask, output);
      });

      taskSpawn.stdout.on('end', (data) => {
        if (!sent) {
          let stdoutContent = Buffer.concat(stdoutChunks).toString();
          this.notifier.sendOutput(this.job, nextTask, stdoutContent);
        }
      });

      taskSpawn.stderr.on('data', (data) => {
        var error = new Buffer.from(data).toString();
        this.notifier.sendOutput(this.job, nextTask, error);
        // TODO this is called ven when no error occurs!!
        TaskQueue.childLogger.info(`Error processing task: ${error}`);
      });
      taskSpawn.on('exit', (exitCode) => {
        TaskQueue.childLogger.info(`On (exit) processing task:`, nextTask);
        this.taskReady.emit(`finished-task`, nextTask, exitCode);
      });

      taskSpawn.on('error', (exitCode) => {
        TaskQueue.childLogger.info(`On (exit) processing task:`, nextTask);
        this.taskReady.emit(`finished-task`, nextTask, exitCode);
      });
    }
  }

  queueJob(job, jobTasks, continueOnError) {
    TaskQueue.childLogger.info('Queued job ...');
    this.jobQueue.push({ job, jobTasks, continueOnError });
    this.jobReady.emit('next-job');
  }

  runNextJob() {
    TaskQueue.childLogger.info('Schedule job', this.dueTasks, this.jobRunning);
    if (!this.jobRunning) {
      if (this.jobQueue.length >= 1) {
        const nextJob = this.jobQueue.shift();
        const { job, jobTasks, continueOnError } = nextJob;
        let l = jobTasks.length;
        this.job = { ...job };
        this.jobNumber++;
        jobTasks.forEach((element, i) => {
          this.dueTasks.push({
            ...element,
            id: i,
            total: l,
            jobNumber: this.jobNumber,
            continueOnError: element.continueOnError
              ? element.continueOnError
              : continueOnError
          });
        });
        this.startJob();
        TaskQueue.childLogger.info('Queued tasks', this.dueTasks);
      }
    }
  }

  startJob() {
    this.jobRunning = true;
    this.notifier.sendJobStart(this.job, this.dueTasks[0].total);
    this.taskReady.emit('next-task');
  }

  registerNotifier(no) {
    this.notifier = no;
  }
}

module.exports = { TaskQueue };
