const {
  logger,
  STORAGE_ENABLED,
  ANALYTICS_FLOW_ENABLED,
  BACKEND_CONFIGURATION_FILE,
  MEASUREMENT_TYPE_FILE,
  INTERVAL_AUTO_SAVE_SERIES
} = require('./global');

const {
  flattenJSONAndClean,
  aggregateAttributes,
  propertiesToJson,
  checkNested
} = require('./utils');
const fs = require('fs');
const { Store } = require('fs-json-store');
// spawn
const { spawn } = require('child_process');
const _forEach = require('lodash/forEach');

class TedgeFileStore {
  static childLogger;
  seriesStored = {};
  seriesStore = null;
  _backendConfiguration = null;

  constructor() {
    TedgeFileStore.childLogger = logger.child({ service: 'TedgeFileStore' });
  }

  async init() {
    // initialize configuration
    TedgeFileStore.childLogger.info(
      `init(): isStorageEnabled: ${STORAGE_ENABLED}, isAnalyticsFlowEnabled: ${ANALYTICS_FLOW_ENABLED}`
    );

    this.initializeMeasurementTypeStore();
    this.initializeBackendConfiguration(false);
    this.getBackendConfiguration();
  }

  async initializeBackendConfiguration(reset) {
    if (reset) {
      this.fileRemove(BACKEND_CONFIGURATION_FILE);
    }

    let exists = await this.fileExists(BACKEND_CONFIGURATION_FILE);
    if (!exists) {
      let initialContent = {
        status: 'BLANK',
        storageEnabled: STORAGE_ENABLED,
        systemManager: 'unknown',
        analyticsFlowEnabled: ANALYTICS_FLOW_ENABLED,
        analytics: {
          diagramName: 'Analytics',
          selectedMeasurements: []
        }
      };

      try {
        // test if tedge was already configured without tedge-mgm ui
        const tedgeConfiguration = await this.getEdgeConfiguration();
        if (checkNested(tedgeConfiguration, 'device', 'id')) {
          let deviceId = tedgeConfiguration.device.id;
          let c8yUrl = tedgeConfiguration.c8y.url;
          initialContent = {
            ...initialContent,
            status: 'INITIALIZED',
            deviceId,
            c8yUrl
          };
        }
      } catch (err) {
        TedgeFileStore.childLogger.error(
          `Error reading tedge configuration ...`,
          err
        );
      }

      try {
        // determine system manager
        const systemManager = await this.getSystemManager();
        if (systemManager) {
          initialContent = {
            ...initialContent,
            systemManager: systemManager
          };
        }
      } catch (err) {
        TedgeFileStore.childLogger.error(
          `Error determining system manager ...`,
          err
        );
      }

      await fs.promises.writeFile(
        BACKEND_CONFIGURATION_FILE,
        JSON.stringify(initialContent)
      );
    }
  }

  async initializeMeasurementTypeStore() {
    if (!STORAGE_ENABLED) {
      let ex = await this.fileExists(MEASUREMENT_TYPE_FILE);
      if (!ex) {
        await fs.promises.writeFile(MEASUREMENT_TYPE_FILE, `{}`);
      }
      this.seriesStore = new Store({
        file: MEASUREMENT_TYPE_FILE
      });
      TedgeFileStore.childLogger.info(
        `Initialized seriesStore: ${this.seriesStore}`
      );

      let self = this;
      this.seriesStore.read().then((data) => {
        self.seriesStored = data ?? {};
        TedgeFileStore.childLogger.debug(
          `Found seriesStored: ${JSON.stringify(self.seriesStored)}`
        );
        const result = aggregateAttributes(self.seriesStored);
        TedgeFileStore.childLogger.info(
          `Found seriesStored: ${JSON.stringify(result)}`
        );
        let selfAgain = self;
        setInterval(async function () {
          if (selfAgain.seriesStore) {
            await selfAgain.seriesStore.write(selfAgain.seriesStored);
          }
        }, INTERVAL_AUTO_SAVE_SERIES);
      });
    }
  }

  async getMeasurementTypes(req, res) {
    TedgeFileStore.childLogger.debug(
      `Called getMeasurementTypes: ${JSON.stringify(this.seriesStored)}`
    );
    let result = [];
    try {
      //   const options = { input: 'json' };
      //   const filter =
      //     '[to_entries | .[] | .value | to_entries | .[] | {device: .key, type: .value | to_entries[0].key, series: .value.series | keys_unsorted}]';
      //   result = JSON.parse(await jq.run(filter, this.seriesStored, options));
    //   Object.keys(this.seriesStored).forEach((deviceKey) => {
    //     const deviceSeries = this.seriesStored[deviceKey];
    //     Object.keys(deviceSeries).forEach((typeKey) => {
    //       result.push({
    //         device: deviceKey,
    //         type: typeKey,
    //         series: Object.keys(deviceSeries[typeKey].series)
    //       });
    //     });
    //   });

        _forEach(this.seriesStored, (valueDevice, keyDevice) => {
          const deviceSeries = valueDevice;
          _forEach(deviceSeries, (valueType,keyType) => {
            result.push({
              device: keyDevice,
              type: keyType,
              series: Object.keys(valueType.series)
            });
          });
        });

      TedgeFileStore.childLogger.info(
        `********Return transformed getMeasurementTypes: ${JSON.stringify(result)}`
      );

      if (res) {
        res.status(200).json(result);
      } else {
        return result;
      }
    } catch (err) {
      TedgeFileStore.childLogger.error(`Error getMeasurementTypes ...`, err);
      if (res) res.status(500).json({ data: err });
    }
  }

  async getDeviceStatistic(req, res) {
    TedgeFileStore.childLogger.debug(
      `Called getDeviceStatistic: ${JSON.stringify(this.seriesStored)}`
    );
    let result = [];

    try {
      result = await this.getMeasurementTypes();
      //   let aggregatedResult = aggregateAttributes(result);
      res.status(200).json(result);
    } catch (err) {
      TedgeFileStore.childLogger.error('Error getDeviceStatistic ... ', err);
      res.status(500).json({ data: err });
    }
  }

  updateMeasurementTypes(document) {
    const { device, payload, type } = document;
    const newSeries = flattenJSONAndClean(payload, '__');

    if (!this.seriesStored[device]) {
      this.seriesStored[device] = {};
    }
    if (!this.seriesStored[device][type]) {
      this.seriesStored[device][type] = {};
    }

    this.seriesStored[device][type]['series'] = {
      ...this.seriesStored[device][type]['series'],
      ...newSeries
    };
    TedgeFileStore.childLogger.debug(
      `Called updateMeasurementTypes: ${JSON.stringify(this.seriesStored)}`
    );
  }

  async getBackendConfiguration(req, res) {
    try {
      let rawdata = await fs.promises.readFile(BACKEND_CONFIGURATION_FILE);
      let rawdataStr = rawdata.toString();
      this._backendConfiguration = JSON.parse(rawdataStr);

      TedgeFileStore.childLogger.info(`Retrieved configuration ${rawdataStr}`);
      if (res) res.status(200).json(this._backendConfiguration);
    } catch (err) {
      TedgeFileStore.childLogger.error(
        `Error getBackendConfiguration ...`,
        err
      );
      if (res) res.status(500).json({ data: err });
    }
  }

  getBackendConfigurationCached() {
    return this._backendConfiguration;
  }

  async setBackendConfiguration(req, res) {
    let BackendConfiguration = req.body;
    this._backendConfiguration = {
      ...this._backendConfiguration,
      ...BackendConfiguration
    };

    try {
      await fs.promises.writeFile(
        BACKEND_CONFIGURATION_FILE,
        JSON.stringify(this._backendConfiguration)
      );
      TedgeFileStore.childLogger.info(`Saved backendConfiguration `);
      TedgeFileStore.childLogger.debug(
        `Saved backendConfiguration: ${JSON.stringify(this._backendConfiguration)}`
      );
      res.status(200).json(this._backendConfiguration);
    } catch (err) {
      TedgeFileStore.childLogger.error(
        `Error setBackendConfiguration ...`,
        err
      );
      res.status(500).json({ data: err });
    }
  }

  async upsertBackendConfiguration(backendConfiguration) {
    TedgeFileStore.childLogger.info(`Upsert backendConfiguration`);
    TedgeFileStore.childLogger.debug(
      `Upsert backendConfiguration: current: ${JSON.stringify(this._backendConfiguration)}, changes: ${JSON.stringify(backendConfiguration)}`
    );
    this._backendConfiguration = {
      ...this._backendConfiguration,
      ...backendConfiguration
    };

    try {
      await fs.promises.writeFile(
        BACKEND_CONFIGURATION_FILE,
        JSON.stringify(this._backendConfiguration)
      );
      TedgeFileStore.childLogger.debug(
        `Upsert backendConfiguration: ${JSON.stringify(this._backendConfiguration)}`
      );
    } catch (err) {
      TedgeFileStore.childLogger.error(
        'Error upsertBackendConfiguration ... ',
        err
      );
    }
  }

  async fileExists(filename) {
    try {
      await fs.promises.stat(filename);
      return true;
    } catch (err) {
      //TedgeFileStore.childLogger.info('Testing code: ' + err.code)
      if (err.code === 'ENOENT') {
        TedgeFileStore.childLogger.error(
          `Error fileExists, err.code is ENOENT, ${filename} ...`,
          err
        );
        return false;
      } else {
        TedgeFileStore.childLogger.error(
          `Error fileExists ${err.code}, ${filename}...`,
          err
        );
        return false;
      }
    }
  }

  async fileRemove(filename) {
    try {
      await fs.promises.unlink(filename);
      return true;
    } catch (err) {
      //TedgeFileStore.childLogger.info('Testing code: ' + err.code)
      if (err.code === 'ENOENT') {
        TedgeFileStore.childLogger.error(
          `Error fileRemove, err.code is ENOENT, ${filename} ...`,
          err
        );
        return false;
      } else {
        TedgeFileStore.childLogger.error(
          `Error fileRemove ${err.code}, ${filename}...`,
          err
        );
        return false;
      }
    }
  }

  async getEdgeConfiguration() {
    return new Promise(function (resolve, reject) {
      var stdoutChunks = [];

      const child = spawn('tedge', ['config', 'list']);

      child.stdout.on('data', (data) => {
        stdoutChunks = stdoutChunks.concat(data);
      });
      child.stderr.on('data', (data) => {
        TedgeFileStore.childLogger.error(`Output stderr: ${data}`);
        reject(`Output stderr: ${data}`);
      });

      child.on('error', function (err) {
        TedgeFileStore.childLogger.error('Error :', err);
      });

      child.stdout.on('end', (data) => {
        let stdoutContent = Buffer.concat(stdoutChunks).toString().trim();
        TedgeFileStore.childLogger.debug(`Output stdout: ${stdoutContent}`);
        let config = propertiesToJson(stdoutContent);
        resolve(config);
      });
    });
  }

  async getSystemManager() {
    return new Promise(function (resolve, reject) {
      var stdoutChunks = [];
      const child = spawn('sh', [
        '-c',
        `if command -V systemctl >/dev/null 2>&1; then SERVICE_MANAGER="systemd";
        elif command -V rc-service >/dev/null 2>&1; then SERVICE_MANAGER="openrc"; 
        elif command -V update-rc.d >/dev/null 2>&1; then SERVICE_MANAGER="sysvinit";
        elif [ -f /command/s6-rc ]; then SERVICE_MANAGER="s6_overlay";     
        elif command -V runsv >/dev/null 2>&1; then SERVICE_MANAGER="runit";
        elif command -V supervisorctl >/dev/null 2>&1; then SERVICE_MANAGER="supervisord";
        else echo "Could not detect the init system. Only openrc,runit,systemd,sysvinit,s6_overlay,supervisord are supported" >&2; SERVICE_MANAGER="unknown";
        fi && echo "$SERVICE_MANAGER"`
      ]);
      child.stdout.on('data', (data) => {
        stdoutChunks = stdoutChunks.concat(data);
      });
      child.stderr.on('data', (data) => {
        TedgeFileStore.childLogger.error(`Output stderr: ${data}`);
        reject(`Output stderr: ${data}`);
      });
      child.on('error', function (err) {
        TedgeFileStore.childLogger.error('Error :', err);
      });

      child.stdout.on('end', (data) => {
        let stdoutContent = Buffer.concat(stdoutChunks).toString().trim();
        TedgeFileStore.childLogger.info(`Output stdout: ${stdoutContent}`);
        resolve(stdoutContent);
      });
    });
  }
}
module.exports = { TedgeFileStore };
