const { logger, STORAGE_ENABLED, ANALYTICS_FLOW_ENABLED } = require('./global');

const { flattenJSONAndClean } = require('./utils');
const fs = require('fs');
const { Store } = require('fs-json-store');

const BACKEND_CONFIGURATION_FILE = '/etc/tedge/tedge-mgm/backendConfig.json';
const MEASUREMENT_TYPE_FILE = '/etc/tedge/tedge-mgm/measurementTypes.json';

class TedgeFileStore {
  static childLogger;
  seriesStored = {};
  seriesStore = null;
  _backendConfiguration = null;

  constructor() {
    TedgeFileStore.childLogger = logger.child({ service: 'TedgeFileStore' });
    TedgeFileStore.childLogger.info(
      `Constructor TypeStore, isStorageEnabled: ${STORAGE_ENABLED}, isAnalyticsFlowEnabled: ${ANALYTICS_FLOW_ENABLED}`
    );

    // initialize configuration
    this.getBackendConfiguration();
    this.initializeMeasurementTypeStore();
    this.initializeBackendConfiguration();
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
      TedgeFileStore.childLogger.info(`Initialized seriesStore: ${this.seriesStore}`);
      let self = this;
      this.seriesStore.read().then((data) => {
        self.seriesStored = data ?? {};
        TedgeFileStore.childLogger.info(`Found seriesStored: ${self.seriesStored}`);
        let selfAgain = self;
        setInterval(async function () {
          if (selfAgain.seriesStore) {
            await selfAgain.seriesStore.write(selfAgain.seriesStored);
          }
        }, 30000);
      });
    }
  }

  getMeasurementTypes(req, res) {
    let result = [];
    try {
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
      if (res) res.status(200).json(result);
    } catch (err) {
      TedgeFileStore.childLogger.error(`Error when reading configuration: ${err}`);
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
    // TedgeFileStore.childLogger.info(`Called updateMeasurementTypes: ${JSON.stringify(this.seriesStored)}`);
  }

  async getBackendConfiguration(req, res) {
    try {
      let rawdata = await fs.promises.readFile(BACKEND_CONFIGURATION_FILE);
      let rawdataStr = rawdata.toString();
      this._backendConfiguration = JSON.parse(rawdataStr);

      TedgeFileStore.childLogger.info(`Retrieved configuration ${rawdataStr}`);
      if (res) res.status(200).json(this._backendConfiguration);
    } catch (err) {
      TedgeFileStore.childLogger.error(`Error when reading configuration: ${err}`);
      if (res) res.status(500).json({ data: err });
    }
  }
  async getBackendConfigurationCached() {
    return this._backendConfiguration;
  }

  async setBackendConfiguration(req, res) {
    let BackendConfiguration = req.body;
    TedgeFileStore.childLogger.info(`Saving new configuration ${this._backendConfiguration}`);

    this._backendConfiguration = {
      ...this._backendConfiguration,
      ...BackendConfiguration
    };
    try {
      await fs.promises.writeFile(
        BACKEND_CONFIGURATION_FILE,
        JSON.stringify(this._backendConfiguration)
      );
      TedgeFileStore.childLogger.info('Saved configuration', this._backendConfiguration);
      res.status(200).json(this._backendConfiguration);
    } catch (err) {
      TedgeFileStore.childLogger.error(`Error when saving configuration: ${err}`);
      res.status(500).json({ data: err });
    }
  }

  async setBackendConfigurationInternal(backendConfiguration) {
    TedgeFileStore.childLogger.info(
      `Saving current: configuration ${this._backendConfiguration}, changes: ${backendConfiguration}`
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
      TedgeFileStore.childLogger.info('Saved configuration', this._backendConfiguration);
    } catch (err) {
      TedgeFileStore.childLogger.error('Error when saving configuration: ' + err);
    }
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
