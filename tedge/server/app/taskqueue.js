const {logger, STORAGE_ENABLED} = require('./global')
// spawn
const { spawn } = require('child_process');
const events = require('events');

class TaskQueue {
  // emitter to signal completion of current the task
  taskReady;
  taskRunning = false;
  tasks = [];
  notifier;
  job;
  jobNumber = 0;

  constructor() {
    this.taskReady = new events.EventEmitter();
    this.runNextTask = this.runNextTask.bind(this);
    this.finishedTask = this.finishedTask.bind(this);
    this.taskReady.on('next-task', this.runNextTask);
    this.taskReady.on('finished-task', (task, exitCode) => {
      this.finishedTask(task, exitCode);
    });
  }

  finishedTask(task, exitCode) {
    this.taskRunning = false;
    // check error
    if (parseInt(exitCode) !== 0) {
      logger.error(`Error (event exit): ${exitCode} on task ${task.id}`);
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
        this.tasks = [];
      }
    } else {
      logger.info(`After processing task: ${JSON.stringify(task)}, ${task.id}`);
      // prepare next task
      this.taskReady.emit('next-task');
      // send job end when last task in job
      if (task.id + 1 == task.total) {
        this.notifier.sendJobEnd(this.job, task);
      }
    }
  }

  runNextTask() {
    if (!this.taskRunning && this.tasks.length > 0) {
      //logger.info('Currently queued tasks', this.tasks)
      this.taskRunning = true;
      let nextTask = this.tasks.shift();
      logger.info(
        `Start processing task: ${JSON.stringify(nextTask)}, ${nextTask.jobNumber}:${nextTask.id}`
      );
      this.notifier.sendProgress(this.job, nextTask);
      var taskSpawn = spawn(nextTask.cmd, nextTask.args);
      taskSpawn.stdout.on('data', (data) => {
        var buffer = new Buffer.from(data).toString();
        this.notifier.sendResult(buffer);
      });

      taskSpawn.stderr.on('data', (data) => {
        var buffer = new Buffer.from(data).toString();
        this.notifier.sendResult(buffer);
        logger.info(`Error processing task: ${buffer}`);
      });
      taskSpawn.on('exit', (exitCode) => {
        logger.info(`On (exit) processing task:`, nextTask);
        this.taskReady.emit(`finished-task`, nextTask, exitCode);
      });

      taskSpawn.on('error', (exitCode) => {
        logger.info(`On (exit) processing task:`, nextTask);
        this.taskReady.emit(`finished-task`, nextTask, exitCode);
      });
    }
  }

  queueTasks(job, newTasks, continueOnError) {
    logger.info('Queued tasks', this.tasks);
    let l = newTasks.length;
    this.job = job;
    this.jobNumber++;
    newTasks.forEach((element, i) => {
      this.tasks.push({
        ...element,
        id: i,
        total: l,
        jobNumber: this.jobNumber,
        continueOnError: element.continueOnError
          ? element.continueOnError
          : continueOnError
      });
    });
    logger.info('Queued tasks', this.tasks);
  }

  start() {
    this.notifier.sendJobStart(this.job,this.tasks[0].total);
    this.taskReady.emit('next-task');
  }

  registerNotifier(no) {
    this.notifier = no;
  }
}

module.exports = { TaskQueue };
