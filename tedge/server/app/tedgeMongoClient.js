const { flattenJSONAndClean } = require('./utils');

// emitter to signal completion of current task

const { MongoClient } = require('mongodb');

const STORAGE_ENABLED = process.env.STORAGE_ENABLED == 'true';

const MONGO_DB = 'localDB';
const MONGO_URL = `mongodb://${process.env.MONGO_HOST}:${process.env.MONGO_PORT}?directConnection=true`;
const MONGO_MEASUREMENT_COLLECTION = 'measurement';
const MONGO_SERIES_COLLECTION = 'serie';
const MAX_MEASUREMENT = 2000;
const NAME_INDEX_FOR_TTL = 'datetime_ttl';

class TedgeMongoClient {
  db = null;
  measurementCollection = null;
  seriesCollection = null;
  mongoConnected = false;

  constructor() {
    console.info(`Constructor TedgeMongoClient, storage: ${STORAGE_ENABLED}`);
  }

  initializeMongo() {
    this.connectToMongo();
    console.info(`Connect to Mongo: ${this.mongoConnected}!`);
  }

  async connectToMongo() {
    if (this.measurementCollection == null || this.seriesCollection == null) {
      console.info('Connecting to mongo ...', MONGO_URL, MONGO_DB);
      try {
        const client = await new MongoClient(MONGO_URL);
        const dbo = client.db(MONGO_DB);
        this.db = dbo;
        this.measurementCollection = dbo.collection(
          MONGO_MEASUREMENT_COLLECTION
        );
        this.seriesCollection = dbo.collection(MONGO_SERIES_COLLECTION);
        this.mongoConnected = true;
      } catch (error) {
        console.error(`Error storing measurement: ${error}`);
      }
    }
  }

  isMongoConnected() {
    return this.mongoConnected;
  }

  async getMeasurements(req, res) {
    let displaySpan = req.query.displaySpan;
    let dateFrom = req.query.dateFrom;
    let dateTo = req.query.dateTo;
    try {
      if (displaySpan) {
        console.info(
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
        // let query = {};
        let result = [];
        const cursor = await this.measurementCollection
          .find(query)
          .limit(MAX_MEASUREMENT)
          .sort({ datetime: 1 });
        for await (const rawMeasurement of cursor) {
          result.push(rawMeasurement);
        }
        res.status(200).json(result);
      } else {
        console.info('Measurement query (from,to):', dateFrom, dateTo);
        let query = {
          datetime: {
            // 18 minutes ago (from now)
            $gt: new Date(dateFrom),
            $lt: new Date(dateTo)
          }
        };
        // let query = {};
        let result = [];
        const cursor = await this.measurementCollection
          .find(query)
          .limit(MAX_MEASUREMENT)
          .sort({ datetime: 1 });
        for await (const rawMeasurement of cursor) {
          result.push(rawMeasurement);
        }
        res.status(200).json(result);
      }
    } catch (err) {
      console.error('Error getMeasurements: ' + err);
      res.status(500).json({ data: err });
    }
  }

  async getMeasurementTypes(req, res) {
    try {
      let result = [];
      if (STORAGE_ENABLED) {
        console.info('Calling getMeasurementTypes ...');
        const query = {};
        const cursor = this.seriesCollection.find(query);
        // Print a message if no documents were found
        if (this.seriesCollection.countDocuments(query) === 0) {
          console.info('No series found!');
        }
        for await (const measurementType of cursor) {
          const series = measurementType.series;
          measurementType.series = Object.keys(series);
          result.push(measurementType);
        }
      } else {
        result = this.tedgeFileStore.getMeasurementTypes();
      }
      res.status(200).json(result);
    } catch (err) {
      console.error('Error getMeasurementTypes: ' + err);
      res.status(500).json({ data: err });
    }
  }

  async storeMeasurement(document) {
    console.debug('Calling storeMeasurement ...');
    try {
      const insertResult = await this.measurementCollection.insertOne(document);
    } catch (error) {
      console.error(`Error storing measurement: ${error}`);
    }
  }

  async updateMeasurementTypes(document) {
    try {
      const { device, payload, type } = document;
      const series = flattenJSONAndClean(payload, '__');
      console.debug('Calling updateMeasurementTypes ...');
      const updateResult = await this.seriesCollection.updateOne(
        { type, device },
        [
          {
            $replaceWith: {
              series: {
                $mergeObjects: [series, '$series']
              },
              type,
              device
            }
          },
          { $set: { modified: '$$NOW' } }
        ],
        {
          upsert: true
        }
      );
      console.debug(
        `Update measurementType, modifiedCount: ${updateResult.modifiedCount}, matchedCount: ${updateResult.matchedCount}`
      );
    } catch (error) {
      console.error(`Error storing measurementType: ${error}`);
    }
  }

  async getStorageStatistic(req, res) {
    try {
      console.info('Calling getStorageStatistic ...');
      const result = await this.db.command({
        dbStats: 1
      });
      res.status(200).json(result);
    } catch (err) {
      console.error('Error getStorageStatistic: ', err);
      res.status(500).json({ data: err });
    }
  }

  async getStorageTTL(req, res) {
    try {
      console.info('Calling getStorageTTL ...');
      const result = await this.measurementCollection.indexes();
      res.status(200).json(result);
    } catch (err) {
      console.error('Error getStorageTTL: ', err);
      res.status(500).json({ data: err });
    }
  }

  async updateStorageTTL(req, res) {
    try {
      const { ttl } = req.body;
      console.info('Calling updateStorageTTL:', ttl);
      const result = await this.db.command({
        collMod: 'measurement',
        index: {
          name: NAME_INDEX_FOR_TTL,
          expireAfterSeconds: ttl
        }
      });
      res.status(200).json(result);
    } catch (err) {
      console.error('Error updateStorageTTL: ', err);
      res.status(500).json({ data: err });
    }
  }
}
module.exports = { TedgeMongoClient };
