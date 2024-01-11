import signal
import sys
from mongo import Mongo
from mqtt import MQTTClient
import logging

# define logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s [%(name)s.%(funcName)s:%(lineno)d] %(message)s",
    datefmt="%d/%b/%Y %H:%M:%S",
)
logger = logging.getLogger("mqtt_collector")
logger.setLevel(logging.INFO)

def terminate(_signal, _frame):
    logger.info("Stopping...", file=sys.stderr)
    sys.exit(0)

mongo = Mongo()
mqtt = MQTTClient(mongo)
signal.signal(signal.SIGTERM, terminate)

logger.info("Starting MQTT Collector ...")
logger.info("Connecting to Mongo ...")
mongo.connect()
logger.info("Connect to MQTT Broker ...")
mqtt.run()

try:
    signal.pause()
except KeyboardInterrupt:
    pass
finally:
    logger.info("Disconnecting from MQTT and Mongo ...")
    mqtt.stop()
    mongo.disconnect()
