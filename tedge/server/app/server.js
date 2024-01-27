// overwrite logger output to add timestamp
const { logger, STORAGE_ENABLED, ANALYTICS_FLOW_ENABLED, PORT } = require('./global');
// use Express
const express = require('express');
const http = require('http');
const { makeGetRequest } = require('./utils');

// http-proxy
const { createProxyMiddleware } = require('http-proxy-middleware');
const socketIO = require('socket.io');

// create new instance of the express server
const app = express();
const { TedgeBackend } = require('./tedgeBackend');
const CERTIFICATE = '/etc/tedge/device-certs/tedge-certificate.pem';
const DEMO_TENANT = 'https://demo.cumulocity.com';
const tedgeBackend = new TedgeBackend();
const childLogger = logger.child({  service: 'Server' });

function customRouter(req) {
  let url = DEMO_TENANT;
  if (req.query) {
    url = `https://${req.query.proxy}`;
    childLogger.info(`Setting target url to: , ${url}, ${req.path}`);
  }
  return url;
}

const proxyToTargetUrl = createProxyMiddleware({
  target: 'https://demo.cumulocity.com',
  changeOrigin: true,
  secure: true,
  pathRewrite: { '^/c8yCloud': '' },
  router: customRouter,
  logLevel: 'debug'
});

// set up proxy
app.use('/c8yCloud', proxyToTargetUrl);

// define the JSON parser as a default way
// to consume and produce data through the
// exposed APIs
app.use(express.json());

// create link to Angular build directory
// the `ng build` command will save the result
// under the `dist` folder.
//var distDir = __dirname + "/../dist/cumulocity-tedge-setup";
var distDir = __dirname + '/../dist/apps/edge';
//app.use("/home", express.static(distDir));
app.use(express.static(distDir));

const server = http.createServer(app);
// Pass a http.Server instance to the listen method
// const io = new Server(server);
const io = socketIO(server);
// The server should start listening
server.listen(PORT, function () {
  var port = server.address().port;
  if (STORAGE_ENABLED) {
    tedgeBackend.connectToMongo();
  }
  childLogger.info(
    `App started on port: ${port}, isStorageEnabled: ${STORAGE_ENABLED}, isAnalyticsFlowEnabled: ${ANALYTICS_FLOW_ENABLED}`
  );
});

/*
 * "/api/inventory/managedObjects"
 *   GET: managedObjects from cloud, this call is bridged through the tedge agent
 */
app.get('/api/bridgedInventory/:externalId', function (req, res) {
  let externalId = req.params.externalId;
  childLogger.info(`Details for: ${externalId}`);
  /// # wget http://localhost:8001/c8y/identity/externalIds/c8y_Serial/monday-II

  makeGetRequest(
    `http://localhost:8001/c8y/identity/externalIds/c8y_Serial/${externalId}`
  )
    .then((result) => {
      childLogger.info(`First request data: ${result}`);
      let externalIdObject = JSON.parse(result);
      childLogger.info(`First request data parsed: ${externalIdObject}`);
      let deviceId = externalIdObject.managedObject.id;
      return makeGetRequest(
        `http://localhost:8001/c8y/inventory/managedObjects/${deviceId}`
      );
    })
    .then((result) => {
      childLogger.info(`Second request data: ${result}`);
      res.send(result);
    })
    .catch((error) => {
      childLogger.error(`Error getExternalId: ${error.message}`);
      res.status(500).json({ message: error.message });
    });
});

/*
 * "api/backend/configuration
 *   POST: Change analytics widget configuration
 */
app.post('/api/backend/configuration', function (req, res) {
  tedgeBackend.setBackendConfiguration(req, res);
});

/*
 * "api/backend/configuration"
 *   GET: Get analytics widget configuration
 */
app.get('/api/backend/configuration', function (req, res) {
  tedgeBackend.getBackendConfiguration(req, res);
});

/*
 * "/api/backend/certificate"
 *   GET: certificate
 */
app.get('/api/backend/certificate', function (req, res) {
  let deviceId = req.query.deviceId;
  childLogger.info(`Download certificate for : ${deviceId}`);
  res.status(200).sendFile(CERTIFICATE);
});

/*
 * "/api/backend/getLastMeasurements"
 *   GET: getLastMeasurements
 */
app.get('/api/backend/analytics/measurement', function (req, res) {
  tedgeBackend.getMeasurements(req, res);
});

/*
 *  "/api/backend/analytics/types"
 *   GET: series
 */
app.get('/api/backend/analytics/types', function (req, res) {
  tedgeBackend.getMeasurementTypes(req, res);
});

/*
 * "/api/storage/statistic"
 *   GET: statistic
 */
app.get('/api/backend/storage/statistic', function (req, res) {
  tedgeBackend.getStorageStatistic(req, res);
});

/*
 * "/api/storage/ttl"
 *   GET: ttl
 */
app.get('/api/backend/storage/ttl', function (req, res) {
  tedgeBackend.getStorageTTL(req, res);
});

/*
 * "/api/storage/ttl"
 *   POST: ttl
 */
app.post('/api/backend/storage/ttl', function (req, res) {
  tedgeBackend.updateStorageTTL(req, res);
});

/*
 * "api/tedge/cmd"
 *   POST: Create request log_upload, config_snapshot, config_update ...
 */
app.post('/api/tedge/cmd', function (req, res) {
  tedgeBackend.sendTedgeGenericCmdRequest(req, res);
});

/*
 * "api/tedge/cmd"
 *   GET: Get response for log_upload, config_snapshot, ...
 */
app.get('/api/tedge/cmd', function (req, res) {
  tedgeBackend.getTedgeGenericCmdResponse(req, res);
});

/*
 * "/api/tedge/type/:type"
 *   GET: Get response for log_upload, config_snapshot, ...
 */
app.get('/api/tedge/type/:type', function (req, res) {
    tedgeBackend.getTedgeGenericConfigType(req, res);
  });

/*
 * "/api/services"
 *   GET: services
 */
app.get('/api/tedge/services', function (req, res) {
  tedgeBackend.getTedgeServiceStatus(req, res);
});

/*
 * "/api/tedge/configuration"
 *   GET: tedge configuration
 */
app.get('/api/tedge/configuration', function (req, res) {
  tedgeBackend.getTedgeConfiguration(req, res);
});

/*
 *   Empty dummy responses to avoid errors in the browser logger
 */
app.get('/apps/*', function (req, res) {
  childLogger.info('Ignore request!');
  res.status(200).json({ result: 'OK' });
});
app.get('/tenant/loginOptions', function (req, res) {
  childLogger.info('Ignore request!');
  res.status(200).json({ result: 'OK' });
});

/*
 * open socket to receive command from web-ui and send back streamed measurements
 */
io.on('connection', function (socket) {
  childLogger.info(`New connection from web ui: ${socket.id}`);
  tedgeBackend.socketOpened(socket);
  socket.on('channel-job-submit', function (job) {
    childLogger.info(`New cmd submitted: ${JSON.stringify(job)} ${job.jobName}`);
    if (job.jobName == 'start') {
      tedgeBackend.start(job);
    } else if (job.jobName == 'stop') {
      tedgeBackend.stop(job);
    } else if (job.jobName == 'configure') {
      tedgeBackend.configure(job);
    } else if (job.jobName == 'reset') {
      tedgeBackend.reset(job);
    } else if (job.jobName == 'upload') {
      tedgeBackend.uploadCertificate(job);
    } else if (job.jobName == 'custom') {
      tedgeBackend.customCommand(job);
    } else {
      socket.emit('channel-job-progress', {
        status: 'ignore',
        progress: 0,
        total: 0
      });
    }
  });
});

io.on('close', function (socket) {
  childLogger.info(`Closing connection from web ui: ${socket.id}`);
});
