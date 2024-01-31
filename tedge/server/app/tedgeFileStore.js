const {
  logger,
  STORAGE_ENABLED,
  ANALYTICS_FLOW_ENABLED,
  BACKEND_CONFIGURATION_FILE,
  MEASUREMENT_TYPE_FILE,
  INTERVAL_AUTO_SAVE_SERIES
} = require('./global');

const { flattenJSONAndClean } = require('./utils');
const fs = require('fs');
const { Store } = require('fs-json-store');

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
    this.initializeBackendConfiguration();
    this.getBackendConfiguration();
  }

  async initializeBackendConfiguration() {
    let ex = await TedgeFileStore.fileExists(BACKEND_CONFIGURATION_FILE);
    if (!ex) {
      await fs.promises.writeFile(
        BACKEND_CONFIGURATION_FILE,
        `{"status": "BLANK", "storageEnabled": ${STORAGE_ENABLED}, "analyticsFlowEnabled": ${ANALYTICS_FLOW_ENABLED}, "analytics" : {
                    "diagramName": "Analytics",
                    "selectedMeasurements": []
                  }}`
      );
    }
  }

  async initializeMeasurementTypeStore() {
    if (!STORAGE_ENABLED) {
      let ex = await TedgeFileStore.fileExists(MEASUREMENT_TYPE_FILE);
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
        const result = this.aggregateAttributes(self.seriesStored);
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
      Object.keys(this.seriesStored).forEach((deviceKey) => {
        const deviceSeries = this.seriesStored[deviceKey];
        Object.keys(deviceSeries).forEach((typeKey) => {
          result.push({
            device: deviceKey,
            type: typeKey,
            series: Object.keys(deviceSeries[typeKey].series)
          });
        });
      });
      TedgeFileStore.childLogger.debug(
        `Return  transformed getMeasurementTypes: ${JSON.stringify(result)}`
      );
      if (res) res.status(200).json(result);
    } catch (err) {
      TedgeFileStore.childLogger.error(`Error getMeasurementTypes ...`, err);
      if (res) res.status(500).json({ data: err });
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
  async getBackendConfigurationCached() {
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

  aggregateAttributes(obj, level = 0) {
    const count = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'object') {
          count[key] = this.aggregateAttributes(obj[key], level + 1);
        } else {
          count[key] = 1;
        }
      }
    }

    // Sum the counts of child attributes at the current level
    const childCount = Object.values(count).reduce(
      (acc, val) => acc + (typeof val !== 'object' ? val : 1),
      0
    );

    return {
      attributes: childCount,
      children: count
    };
  }

  static async fileExists(filename) {
    try {
      await fs.promises.stat(filename);
      return true;
    } catch (err) {
      //TedgeFileStore.childLogger.info('Testing code: ' + err.code)
      if (err.code === 'ENOENT') {
        return false;
      } else {
        throw err;
      }
    }
  }
}
module.exports = { TedgeFileStore };
