FROM python:3.10-slim-buster

RUN apt-get update
RUN apt-get install vim -y
RUN apt-get install procps -y

# copy init script
WORKDIR /
# COPY --chmod=755 ./etc/init.d/mqtt-collector.sh ./etc/init.d
# COPY --chmod=755 ./etc/systemd/system/mqtt-collector.service ./etc/systemd/system

# copy app
COPY ./app /app

COPY ./LICENSE.md /
COPY ./README.md /

# install required modules
WORKDIR /app
RUN pip3 install -r requirements.txt

# RUN echo "MQTT_BROKER=tedge\n MQTT_PORT=1883\n MONGO_HOST=mongodb1\n MONGO_PORT=27017" > env
# RUN chmod 755 env
# RUN update-rc.d mqtt-collector.sh defaults 10
# RUN update-rc.d mqtt-collector.sh enable
# enable serivce
# RUN systemctl enable collector

# ENTRYPOINT ["python3"]
# CMD ["__main__.py"]
# CMD service mqtt-collector start && tail -f /dev/null
CMD  python3 __main__.py & tail -f /dev/null