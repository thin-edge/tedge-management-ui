#!/bin/sh
# mqtt-collector.sh    Start service.
#

### BEGIN INIT INFO
# Provides:          mqtt-collector
# Required-Start:    mountdevsubfs
# Required-Stop:     mountdevsubfs
# Should-Stop:       umountfs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Start python script to listen to mqtt and send document to mongo.
### END INIT INFO

# These defaults are user-overridable in /etc/default/hwclock
DIR=/app
DAEMON=$DIR/__main__.py
DAEMON_NAME=mqtt-collector.sh
NAME=mqtt-collector

# Add any command line options for your daemon here
DAEMON_OPTS=""

# This next line determines what user the script runs as.
# Root generally not recommended but necessary if you are using the Raspberry Pi GPIO from Python.
DAEMON_USER=root

# The process ID of the script when it runs is stored here:
PIDFILE=/var/run/$DAEMON_NAME.pid
PYTHON_FILE="/app/__main__.py"

[ -f /app/env ] && . /app/env

do_start() {
     echo Starting Incapsula Script...
     echo $PIDFILE is the file where pid resides
    python3 $PYTHON_FILE & 
     RETVAL=`echo $?`
     [ $RETVAL -eq 0 ] && touch /var/lock/$NAME
}

do_stop() {
    echo $PIDFILE is removed
    kill `cat $PIDFILE`
    RETVAL=`echo $?`
    [ $RETVAL -eq 0 ] && rm -f /var/lock/$NAME
}

do_status() {
      if [ -e $PIDFILE ]; then
      echo $NAME is running, pid=`cat $PIDFILE`
      else
      echo $NAME is NOT running
      exit 1
      fi
}

case "$1" in

    start|stop)
        do_${1}
        ;;

    restart|reload|force-reload)
        do_stop
        do_start
        ;;

    status)
        status_of_proc "$DAEMON_NAME" "$DAEMON" && exit 0 || exit $?
        ;;

    *)
        echo "Usage: /etc/init.d/$DAEMON_NAME {start|stop|restart|status}"
        exit 1
        ;;

esac
exit 0