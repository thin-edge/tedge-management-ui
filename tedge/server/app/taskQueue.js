const { logger } = require('./global');
// spawn
const { spawn } = require('child_process');
const { EventEmitter } = require('events');

class TaskQueue {
  static childLogger;

  taskReady = null;
  taskRunning = false;

  jobReady = null;
  jobRunning = false;
  jobQueue = [];
  currentJob = 0;

  emitter = null;

  constructor(em) {
    this.emitter = em;
    TaskQueue.childLogger = logger.child({ service: 'TaskQueue' });
    TaskQueue.childLogger.info(`Init taskQueue: emitter: ${this.emitter}`);
    this.taskReady = new EventEmitter();
    this.taskReady.on('next-task', (jobDefinition) => {
      this.runNextTask(jobDefinition);
    });
    this.taskReady.on('finished-task', (jobDefinition, exitCode) => {
      this.finishedTask(jobDefinition, exitCode);
    });

    this.runNextTask = this.runNextTask.bind(this);
    this.finishedTask = this.finishedTask.bind(this);

    this.jobReady = new EventEmitter();
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
    const { job, jobTasks, nextTask } = jobDefinition;
    this.taskRunning = false;

    // check error
    if (parseInt(exitCode) !== 0) {
      TaskQueue.childLogger.error(
        `Error, exitCode : ${exitCode} on task ${job.currentTask}`
      );
      this.emitter.sendError(jobDefinition, exitCode);

      //continue if task failure is accepted
      const continueOnError = nextTask.continueOnError
        ? nextTask.continueOnError
        : job.continueOnError;
      if (continueOnError) {
        // prepare next task
        this.taskReady.emit('next-task', jobDefinition);
        // send job end when last task in job
        if (job.currentTask == job.totalTask) {
          this.emitter.sendJobEnd(jobDefinition);
          this.jobRunning = false;
          this.jobReady.emit('next-job', jobDefinition);
        } else {
          // prepare next task
          this.taskReady.emit('next-task', jobDefinition);
        }
      } else {
        // delete all remaining tasks from queue
        this.jobRunning = false;
        jobTasks = [];
      }
    } else {
      TaskQueue.childLogger.info(
        `Successfully processed task: ${JSON.stringify(nextTask)}, ${job.currentTask}`
      );
      // send job-end when last task in job
      if (job.currentTask == job.totalTask) {
        this.emitter.sendJobEnd(jobDefinition);
        this.jobRunning = false;
        this.jobReady.emit('next-job', jobDefinition);
      } else {
        // prepare next task
        this.taskReady.emit('next-task', jobDefinition);
      }
    }
  }

  runNextTask(jobDefinition) {
    const { job, jobTasks } = jobDefinition;

    if (!this.taskRunning && jobTasks.length > 0) {
      TaskQueue.childLogger.info(
        `Currently queued tasks: ${JSON.stringify(job)},  ${JSON.stringify(jobTasks)}`
      );
      this.taskRunning = true;
      let nextTask = jobTasks.shift();
      job.currentTask = job.currentTask + 1;
      let stdoutChunks = [];
      let stderrChunks = [];

      TaskQueue.childLogger.info(
        `Start processing task: ${JSON.stringify(nextTask)}, currentTask: ${job.currentTask}`
      );
      this.emitter.sendProgress({ job, jobTasks, nextTask });
      var taskSpawn = spawn(nextTask.cmd, nextTask.args);
      // listen on stdout
      taskSpawn.stdout.on('data', (data) => {
        stdoutChunks = stdoutChunks.concat(data);
      });
      taskSpawn.stdout.on('end', (data) => {
        let stdoutContent = Buffer.concat(stdoutChunks).toString();
        this.emitter.sendOutput({ job, jobTasks, nextTask }, stdoutContent);
      });

      // listen on stderr
      taskSpawn.stderr.on('data', (data) => {
        stderrChunks = stderrChunks.concat(data);
      });
      taskSpawn.stderr.on('end', (data) => {
        var errorOutput = new Buffer.from(stderrChunks).toString();
        var errorOutputRaw = new Buffer.from(stderrChunks);
        for (const value of errorOutputRaw.values()) {
          TaskQueue.childLogger.warn(
            `****** value: ... -|${value}|- ${errorOutputRaw.length}`
          );
        }
        if (errorOutputRaw.length >= 1 && errorOutputRaw[0] == 0) {
          // ignore the output
        } else {
          this.emitter.sendOutput({ job, jobTasks, nextTask }, errorOutput);
          TaskQueue.childLogger.warn(
            `Error output from task: ${errorOutput}`
          );
        }
      });

      taskSpawn.on('exit', (exitCode) => {
        TaskQueue.childLogger.info(
          `On exit: ${exitCode}, processing task: ${job.currentTask}`
        );
        this.taskReady.emit(
          `finished-task`,
          { job, jobTasks, nextTask },
          exitCode
        );
      });

      taskSpawn.on('error', (exitCode) => {
        TaskQueue.childLogger.info(
          `On error: ${exitCode}, processing task: ${job.currentTask}`
        );
        this.taskReady.emit(
          `finished-task`,
          { job, jobTasks, nextTask },
          exitCode
        );
      });
    }
  }

  queueJob(job, jobTasks) {
    TaskQueue.childLogger.info(`Queued next job with ${jobTasks.length} tasks`);
    this.jobQueue.push({ job, jobTasks });
    this.jobReady.emit('next-job');
  }

  runNextJob() {
    TaskQueue.childLogger.info(`Schedule job ${this.jobRunning}`);

    if (!this.jobRunning) {
      if (this.jobQueue.length >= 1) {
        const nextJob = this.jobQueue.shift();
        const { job, jobTasks } = nextJob;
        job.currentTask = 0;
        job.totalTask = jobTasks.length;
        this.currentJob++;
        job.currentJob = this.currentJob;
        this.startJob({ job, jobTasks });
        TaskQueue.childLogger.info(`Run next job with ${jobTasks.length} tasks`);
      }
    }
  }

  startJob(jobDefinition) {
    this.jobRunning = true;
    this.emitter.sendJobStart(jobDefinition);
    this.taskReady.emit('next-task', jobDefinition);
  }
}

module.exports = { TaskQueue };
