import time
from datetime import datetime
import paho.mqtt.client as mqtt
import os
import logging

from mongo import Mongo

MQTT_BROKER = os.environ["MQTT_BROKER"]
MQTT_PORT = int(os.environ["MQTT_PORT"])
MQTT_KEEPALIVE = 60
MQTT_QOS = 2
# MQTT_TOPICS = ("c8y/#",)  # Array of topics to subscribe; '#' subscribe to ALL available topics
# te/device/<child_id>///m/<type>
# te/device/   main   ///m/<type>
# 0    1        2     34 5  6
MQTT_TOPICS = ("te/+/+/+/+/m/+",)

if isinstance(MQTT_TOPICS, str):
    MQTT_TOPICS = [e.strip() for e in MQTT_TOPICS.split(",")]

logger = logging.getLogger("mqtt_client")
logger.setLevel(logging.INFO)


class MQTTClient(object):
    def __init__(self, mongo: Mongo):
        self.mongo: Mongo = mongo
        self.mqtt_client = mqtt.Client(clean_session=True)
        self.mqtt_client.on_connect = self.on_connect
        self.mqtt_client.on_message = self.on_message
        self.mqtt_client.on_disconnect = self.on_disconnect
        self.mqtt_client.connected_flag = False  # set flag initially
        self.mqtt_client.bad_connection_flag = False  # set flag
        logger.info("Initializing MQTT ...")

    # noinspection PyUnusedLocal
    @staticmethod
    def on_connect(client: mqtt.Client, userdata, flags, rc):
        if rc == 0:
            logger.info(f"Connected OK Returned code = {str(rc)}")
            for topic in MQTT_TOPICS:
                client.subscribe(topic, MQTT_QOS)

    # noinspection PyUnusedLocal
    @staticmethod
    def on_disconnect(client: mqtt.Client, userdata, flags, rc=0):
        logger.info(f"Disconnected flags result-code {str(rc)} client_id")

    # noinspection PyUnusedLocal
    def on_message(self, client: mqtt.Client, userdata, msg: mqtt.MQTTMessage):
        self.mongo.save(msg)

    def run(self):
        logger.info(f"Running MQTT: {MQTT_BROKER},{MQTT_PORT}")
        try:
            self.mqtt_client.connect(MQTT_BROKER, MQTT_PORT, MQTT_KEEPALIVE)
            self.mqtt_client.loop_forever()
        except Exception as ex:
            logger.error("Connection failed ...")
            logger.error(ex, exc_info=True)

    def stop(self):
        logger.info("Stopping MQTTClient")
        self.mqtt_client.disconnect()
        self.mqtt_client.loop_stop()
