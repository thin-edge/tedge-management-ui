from typing import List
from datetime import datetime
import paho.mqtt.client as mqtt
import pymongo
import pymongo.database
import pymongo.collection
import pymongo.errors
import threading
import os
import json
from flatten_json import flatten
import logging
import sys

MONGO_HOST = os.environ["MONGO_HOST"]
MONGO_PORT = int(os.environ["MONGO_PORT"])
MONGO_URI = f"mongodb://{MONGO_HOST}:{MONGO_PORT}"  # mongodb://user:pass@ip:port || mongodb://ip:port
MONGO_DB = "localDB"
MONGO_COLLECTION_MEASUREMENT = "measurement"
MONGO_COLLECTION_SERIES = "serie"
MONGO_TIMEOUT = 1  # Time in seconds

logger = logging.getLogger("mongo_client")
logger.setLevel(logging.INFO)


class Mongo(object):
    def __init__(self):
        self.client: pymongo.MongoClient = None
        self.database: pymongo.database.Database = None
        self.collectionMeasurement: pymongo.collection.Collection = None
        self.collectionSeries: pymongo.collection.Collection = None
        self.queue: List[mqtt.MQTTMessage] = list()

    def connect(self):
        logger.info("Connecting Mongo")
        self.client = pymongo.MongoClient(
            MONGO_URI, serverSelectionTimeoutMS=MONGO_TIMEOUT * 1000.0
        )
        self.database = self.client.get_database(MONGO_DB)
        self.collectionMeasurement = self.database.get_collection(
            MONGO_COLLECTION_MEASUREMENT
        )
        self.collectionSeries = self.database.get_collection(MONGO_COLLECTION_SERIES)

    def disconnect(self):
        logger.info("Disconnecting Mongo")
        if self.client:
            self.client.close()
            self.client = None

    def connected(self) -> bool:
        if not self.client:
            return False
        try:
            self.client.admin.command("ismaster")
        except pymongo.errors.PyMongoError:
            return False
        else:
            return True

    def save(self, msg: mqtt.MQTTMessage):
        # logger.info("Saving")
        if msg.retain:
            logger.info("Skipping retained message")
            return
        if self.connected():
            self._store(msg)
        else:
            self._enqueue(msg)

    def _enqueue(self, msg: mqtt.MQTTMessage):
        logger.info("Enqueuing")
        self.queue.append(msg)
        # TODO process queue

    def __store_thread_f(self, msg: mqtt.MQTTMessage):
        # logger.info("Storing")
        try:
            # Check here for payload parsing of measurement
            # for y, x in json.loads(msg.payload).items():
            #     if y == "type":
            #         messageType = x

            topic_split = msg.topic.split("/")
            device = topic_split[2]
            if len(topic_split) >= 7 and not topic_split[6] == "":
                messageType = topic_split[6]
            else:
                messageType = "default"
            payload = {}
            # initialize time with current time and overwrite with time in payload later
            time = datetime.now()
            try:
                payload = json.loads(msg.payload)
                if "time" in payload:
                    del payload["time"]
                # use time from message
                # TODO ignore time in payload for now since the timezone is not considered
                # if time in payload:
                #    time = payload.time
                #    logger.info("Time from payload", str(time))
            except Exception as ex:
                logger.error("Could not parse payload as json!")
                logger.error(ex, exc_info=True)
                payload = msg.payload

            document = {
                "topic": msg.topic,
                "device": device,
                "payload": payload,
                "type": messageType,
                "timestamp": int(time.timestamp()),
                "datetime": time,
            }
            resultMeasurement = self.collectionMeasurement.insert_one(document)

            # update series list
            seriesList = flatten(document["payload"], "__")
            seriesListCleaned = {}
            mongoDocument = {}
            mongoDocument["type"] = document["type"]
            mongoDocument["device"] = document["device"]
            mongoDocument["datetime"] = time
            mongoDocument["series"] = seriesListCleaned
            for key in seriesList:
                # ignore meta properties, since not relevant for series
                if key != "type" and key != "time":
                    # replace existing '.' for '-' to avoid being recognized as objects
                    seriesListCleaned[key.replace(".", "_")] = ""

            # resultSeries = self.collectionSeries.update_one(
            #     {"type": document["type"], "device": document["device"]}, {"$set": mongoDocument}, True
            # )
            # resultSeries = self.collectionSeries.update_one(
            #     {"type": document["type"], "device": document["device"]},
            #     {
            #         "$set": {
            #             "series": {
            #                 "$setUnion": [
            #                     {
            #                         "$ifNull": ["$series", {}]
            #                     },  ## If series field is missing, create an empty set
            #                     mongoDocument["series"],
            #                 ]
            #             }
            #         }
            #     },
            #     True,
            # )
            doc_count = self.collectionSeries.count_documents(
                {"type": document["type"], "device": document["device"]}
            )
            if doc_count == 0:
                logger.info(f"Inserting for {document['type']}, {document['device']}")
                self.collectionSeries.insert_one(
                    {"type": document["type"], "device": document["device"]}
                )

            resultSeries = self.collectionSeries.update_one(
                {"type": document["type"], "device": document["device"]},
                [
                    {
                        "$replaceWith": {
                            "series": {
                                "$mergeObjects": [
                                    mongoDocument["series"],
                                    "$series",
                                ]
                            },
                            "type": document["type"],
                            "device": document["device"],
                        }
                    },
                    {"$set": {"modified": "$$NOW"}},
                ],
                upsert=True,
            )
            logger.info(
                f"Saved measurementId/seriesId/modifiedCount: {resultMeasurement.inserted_id},  {resultSeries.modified_count}"
            )
            if not resultMeasurement.acknowledged:
                # Enqueue message if it was not saved properly
                self._enqueue(msg)
        except Exception as ex:
            logger.error(ex, exc_info=True)

    def _store(self, msg):
        th = threading.Thread(target=self.__store_thread_f, args=(msg,))
        th.daemon = True
        th.start()
