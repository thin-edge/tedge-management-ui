import signal
import sys
from mongo import Mongo
from mqtt import MQTT

def terminate(_signal, _frame):
    print("Stopping...", file=sys.stderr)
    sys.exit(0)

mongo = Mongo()
mqtt = MQTT(mongo)
signal.signal(signal.SIGTERM, terminate)

mongo.connect()
mqtt.run()

try:
    signal.pause()
except KeyboardInterrupt:
    pass
finally:
    print("Disconnecting from mqtt and mongodb...", file=sys.stderr)
    mqtt.stop()
    mongo.disconnect()
