const {logger, STORAGE_ENABLED, NODE_RED_ENABLED} = require('./global')

const { flattenJSONAndClean } = require('./utils');
const fs = require('fs');
const { Store } = require('fs-json-store');
// emitter to signal completion of current task

const TEDGE_MGM_CONFIGURATION_FILE = '/etc/tedge/tedge-mgm/tedgeMgmConfig.json';
const TEDGE_TYPE_STORE_FILE = '/etc/tedge/tedge-mgm/tedgeSeriesStore.json';

class TedgeFileStore {
  seriesStored = {};
  seriesStore = null;
  _tedgeMgmConfiguration = null;

  constructor() {
    logger.info(`Constructor TypeStore, isStorageEnabled:  ${STORAGE_ENABLED}, isNodeRedEnabled:  ${NODE_RED_ENABLED}`);

    // initialize configuration
    this.getTedgeMgmConfiguration();
    this.initializeTypeStore();
    this.initializeTedgeMgmConfiguration();
  }

  async initializeTedgeMgmConfiguration() {
    let ex = await TedgeFileStore.fileExists(TEDGE_MGM_CONFIGURATION_FILE);
    if (!ex) {
      await fs.promises.writeFile(
        TEDGE_MGM_CONFIGURATION_FILE,
        `{"status": "BLANK", "storageEnabled": ${STORAGE_ENABLED}, "nodeRedEnabled": ${NODE_RED_ENABLED}, "analytics" : {
                    "diagramName": "Analytics",
                    "selectedMeasurements": []
                  }}`
      );
    }
  }

  async initializeTypeStore() {
    if (!STORAGE_ENABLED) {
      let ex = await TedgeFileStore.fileExists(TEDGE_TYPE_STORE_FILE);
      if (!ex) {
        await fs.promises.writeFile(TEDGE_TYPE_STORE_FILE, `{}`);
      }
      this.seriesStore = new Store({
        file: TEDGE_TYPE_STORE_FILE
      });
      logger.info(`Initialized seriesStore: ${this.seriesStore}`);
      let self = this;
      this.seriesStore.read().then((data) => {
        self.seriesStored = data ?? {};
        logger.info(`Found seriesStored: ${self.seriesStored}`);
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
      logger.error(`Error when reading configuration: ${err}`);
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
    // logger.info(`Called updateMeasurementTypes: ${JSON.stringify(this.seriesStored)}`);
  }

  async getTedgeMgmConfiguration(req, res) {
    try {
      let rawdata = await fs.promises.readFile(TEDGE_MGM_CONFIGURATION_FILE);
      let str = rawdata.toString();
      this._tedgeMgmConfiguration = JSON.parse(str);

      logger.debug('Retrieved configuration', this._tedgeMgmConfiguration);
      if (res) res.status(200).json(this._tedgeMgmConfiguration);
    } catch (err) {
      logger.error(`Error when reading configuration: ${err}`);
      if (res) res.status(500).json({ data: err });
    }
  }
  async getTedgeMgmConfigurationCached() {
    return this._tedgeMgmConfiguration;
  }

  async setTedgeMgmConfiguration(req, res) {
    let tedgeMgmConfiguration = req.body;
    logger.info(`Saving new configuration ${this._tedgeMgmConfiguration}`);

    this._tedgeMgmConfiguration = {
      ...this._tedgeMgmConfiguration,
      ...tedgeMgmConfiguration
    };
    try {
      await fs.promises.writeFile(
        TEDGE_MGM_CONFIGURATION_FILE,
        JSON.stringify(this._tedgeMgmConfiguration)
      );
      logger.info('Saved configuration', this._tedgeMgmConfiguration);
      res.status(200).json(this._tedgeMgmConfiguration);
    } catch (err) {
      logger.error(`Error when saving configuration: ${err}`);
      res.status(500).json({ data: err });
    }
  }

  async setTedgeMgmConfigurationInternal(tedgeMgmConfiguration) {
    logger.info(
      `Saving current: configuration ${this._tedgeMgmConfiguration}, changes: ${tedgeMgmConfiguration}`
    );
    this._tedgeMgmConfiguration = {
      ...this._tedgeMgmConfiguration,
      ...tedgeMgmConfiguration
    };
    try {
      await fs.promises.writeFile(
        TEDGE_MGM_CONFIGURATION_FILE,
        JSON.stringify(this._tedgeMgmConfiguration)
      );
      logger.info('Saved configuration', this._tedgeMgmConfiguration);
    } catch (err) {
      logger.error('Error when saving configuration: ' + err);
    }
  }

  static async fileExists(filename) {
    try {
      await fs.promises.stat(filename);
      return true;
    } catch (err) {
      //logger.info('Testing code: ' + err.code)
      if (err.code === 'ENOENT') {
        return false;
      } else {
        throw err;
      }
    }
  }
}
module.exports = { TedgeFileStore };
