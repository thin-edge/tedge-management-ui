// overwrite logger output to add timestamp
const { logger, STORAGE_ENABLED, MONGO_HOST, MONGO_PORT } = require('./global');

const { flattenJSONAndClean, aggregateAttributes } = require('./utils');

// emitter to signal completion of current task

const { MongoClient } = require('mongodb');

const MONGO_DB = 'localDB';
const MONGO_URL = `mongodb://${MONGO_HOST}:${MONGO_PORT}?directConnection=true`;
const MONGO_MEASUREMENT_COLLECTION = 'measurement';
const MONGO_SERIES_COLLECTION = 'serie';
const MAX_MEASUREMENT = 2000;
const NAME_INDEX_FOR_TTL = 'datetime_ttl';

class TedgeMongoClient {
  static childLogger;
  db = null;
  measurementCollection = null;
  seriesCollection = null;
  mongoConnected = false;

  constructor() {
    TedgeMongoClient.childLogger = logger.child({
      service: 'TedgeMongoClient'
    });
  }

  async init() {
    await this.connectMongo();
    TedgeMongoClient.childLogger.info(
      `init(): isMongoConnected: ${this.mongoConnected}`
    );
  }

  async connectMongo() {
    if (this.measurementCollection == null || this.seriesCollection == null) {
      TedgeMongoClient.childLogger.info(
        `Connecting to Mongo: ${MONGO_URL}, ${MONGO_DB}`
      );

      try {
        const client = new MongoClient(MONGO_URL);
        const dbo = client.db(MONGO_DB);
        await client.connect();

        this.db = dbo;
        this.measurementCollection = dbo.collection(
          MONGO_MEASUREMENT_COLLECTION
        );
        this.seriesCollection = dbo.collection(MONGO_SERIES_COLLECTION);
        this.mongoConnected = true;
        TedgeMongoClient.childLogger.info(`Connection status (connectMongo): ${this.mongoConnected} `);
      } catch (err) {
        TedgeMongoClient.childLogger.error(`Error connectMongo ... `, err);
        this.mongoConnected = false;
      }
    }
  }

  isMongoConnected() {
    TedgeMongoClient.childLogger.info(`Connection status (isMongoConnected): ${this.mongoConnected} `);
    return this.mongoConnected;
  }

  async getMeasurements(req, res) {
    let displaySpan = req.query.displaySpan;
    let dateFrom = req.query.dateFrom;
    let dateTo = req.query.dateTo;
    try {
      if (displaySpan) {

        TedgeMongoClient.childLogger.info(
          `Measurement query (last, after): ${displaySpan} - ${new Date(Date.now() - 1000 * parseInt(displaySpan))}`
        );
        let query = {
          datetime: {
            // 18 minutes ago (from now)
            $gt: new Date(Date.now() - 1000 * parseInt(displaySpan))
          }
        };

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

        TedgeMongoClient.childLogger.info(
          `Measurement query (from,to): ${dateFrom}, ${dateTo}`
        );
        let query = {
          datetime: {
            // 18 minutes ago (from now)
            $gt: new Date(dateFrom),
            $lt: new Date(dateTo)
          }
        };

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
      TedgeMongoClient.childLogger.error('Error getMeasurements ... ', err);
      res.status(500).json({ data: err });
    }
  }

  async getMeasurementTypes(req, res) {
    try {

      let result = [];
      TedgeMongoClient.childLogger.info('Calling getMeasurementTypes ...');
      const query = {};
      const cursor = this.seriesCollection.find(query);
      // Print a message if no documents were found
      if (this.seriesCollection.countDocuments(query) === 0) {
        TedgeMongoClient.childLogger.info('No series found!');
      }

      for await (const measurementType of cursor) {
        const series = measurementType.series;
        measurementType.series = Object.keys(series);
        result.push(measurementType);
      }

      res.status(200).json(result);
    } catch (err) {
      TedgeMongoClient.childLogger.error('Error getMeasurementTypes ... ', err);
      res.status(500).json({ data: err });
    }
  }

  async getDeviceStatistic(req, res) {
    try {

      let result = [];
      if (STORAGE_ENABLED) {
        TedgeMongoClient.childLogger.info('Calling getDeviceStatistic ...');
        const query = {};
        const cursor = this.seriesCollection.find(query);
        // Print a message if no documents were found
        if (this.seriesCollection.countDocuments(query) === 0) {
          TedgeMongoClient.childLogger.info('No series found!');
        }

        for await (const measurementType of cursor) {
          const series = measurementType.series;
          measurementType.series = Object.keys(series);
          result.push(measurementType);
        }

      } else {
        result = this.tedgeFileStore.getMeasurementTypes();
      }
      let aggregatedResult = aggregateAttributes(result);
      res.status(200).json(aggregatedResult);
    } catch (err) {
      TedgeMongoClient.childLogger.error('Error getDeviceStatistic ... ', err);
      res.status(500).json({ data: err });
    }
  }

  async storeMeasurement(document) {
    TedgeMongoClient.childLogger.debug('Calling storeMeasurement ...');
    try {
      const insertResult = await this.measurementCollection.insertOne(document);
    } catch (err) {
      TedgeMongoClient.childLogger.error(`Error storeMeasurement  ... `, err);
    }
  }

  async updateMeasurementTypes(document) {
    try {
      const { device, payload, type } = document;

      const series = flattenJSONAndClean(payload, '__');
      TedgeMongoClient.childLogger.debug('Calling updateMeasurementTypes ...');
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

      TedgeMongoClient.childLogger.debug(
        `Update measurementType, modifiedCount: ${updateResult.modifiedCount}, matchedCount: ${updateResult.matchedCount}`
      );
    } catch (err) {
      TedgeMongoClient.childLogger.error(
        `Error storing updateMeasurementTypes ... `,
        err
      );
    }
  }

  async getStorageStatistic(req, res) {
    try {
      TedgeMongoClient.childLogger.info('Calling getStorageStatistic ...');
      const result = await this.db.command({
        dbStats: 1
      });
      res.status(200).json(result);
    } catch (err) {
      TedgeMongoClient.childLogger.error('Error getStorageStatistic ... ', err);
      res.status(500).json({ data: err });
    }
  }

  async getStorageIndex(req, res) {
    try {
      TedgeMongoClient.childLogger.info('Calling getStorageIndex ...');
      const result = await this.measurementCollection.indexes();
      res.status(200).json(result);
    } catch (err) {
      TedgeMongoClient.childLogger.error('Error getStorageIndex ... ', err);
      res.status(500).json({ data: err });
    }
  }

  async updateStorageTTL(req, res) {
    try {
      const { ttl } = req.body;
      TedgeMongoClient.childLogger.info('Calling updateStorageTTL:', ttl);
      const result = await this.db.command({
        collMod: 'measurement',
        index: {
          name: NAME_INDEX_FOR_TTL,
          expireAfterSeconds: ttl
        }
      });
      res.status(200).json(result);
    } catch (err) {
      TedgeMongoClient.childLogger.error('Error updateStorageTTL ... ', err);
      res.status(500).json({ data: err });
    }
  }
}
module.exports = { TedgeMongoClient };
