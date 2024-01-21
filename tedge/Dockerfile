#
# mgm-builder
#
FROM node:16-alpine3.15 as mgm-builder

WORKDIR /app

# Install dependencies
COPY ui/package.json ui/package-lock.json ./
RUN npm i -g @angular/cli \
    && npm ci -f

# Build
COPY ui .
# comment out the following line to not build the app, but rather use a locally built version during the development
# this is step 2. (see as well docker-compose.yml)
RUN npm run build

#
# server-builder
#
FROM node:16-alpine3.15 as server-builder

WORKDIR /app

# Install dependencies
COPY server/package.json server/package-lock.json ./
RUN npm ci --production

COPY server .

#
# Image
#
FROM node:16-alpine3.15

# Otherwise mosquitto fails
VOLUME ["/sys/fs/cgroup"]

# We need curl to get root certificates
RUN apk update \
    && apk --no-cache add bash curl sudo openrc vim

# Install thin-edge.io and openrc services
RUN wget -O - thin-edge.io/install.sh | sh -s \
    && wget -O - thin-edge.io/install-services.sh | sh -s -- openrc \
    && apk --no-cache add --force-overwrite \
    tedge-apk-plugin \
    tedge-collectd-setup \
    && tedgectl enable tedge-mapper-collectd \
    && tedgectl enable collectd

# Add user and groups
RUN addgroup -S tedge-mgm \
    && adduser -g "" -H -D tedge-mgm -G tedge-mgm \
    # Add tedge to sudoers
    && echo "%tedge   ALL = (ALL) NOPASSWD: ALL" >/etc/sudoers.d/tedge \
    # Add tedge-mgm to sudoers
    && echo "%tedge-mgm   ALL = (ALL) NOPASSWD: ALL" >/etc/sudoers.d/tedge-mgm

# thin-edge.io configuration
COPY --chmod=644 ./etc/tedge/tedge-log-plugin.toml /etc/tedge/plugins/tedge-log-plugin.toml
COPY --chmod=644 ./etc/tedge/tedge-configuration-plugin.toml /etc/tedge/plugins/tedge-configuration-plugin.toml
COPY --chown=tedge:tedge ./etc/tedge/tedge.toml /etc/tedge/

# overwrite collectd settings for demo purposes, in order to see some more mesaurements
COPY ./etc/collectd/collectd.conf /etc/collectd/collectd.conf

# mosquitto settings
COPY ./etc/mosquitto/mosquitto.conf /etc/mosquitto/mosquitto.conf
RUN mkdir -p /var/log/mosquitto \
    && chown -R mosquitto:mosquitto /var/log/mosquitto

# Install tedge-mgm service
COPY --chmod=755 ./etc/init.d/* /etc/init.d/
RUN rc-update add tedge-mgm default

# allow server to read env variables: MQTT_BROKER, MQTT_PORT, STORAGE_ENABLED
RUN echo 'rc_env_allow="MQTT_BROKER MQTT_PORT STORAGE_ENABLED"'>> /etc/rc.conf

# Create required tedge directories and files
RUN install -g tedge-mgm -o tedge-mgm -m 755 -d /etc/tedge/tedge-mgm

# Comment out getty's, since they cause error messages
COPY ./etc/inittab /etc/inittab

# Copy ui and server
COPY --from=mgm-builder /app/dist /app/tedge/server/dist
COPY --from=server-builder /app /app/tedge/server

# Set environment MONGO_HOTS, MONGO_PORT variable in /app/tedge/tedge-mgm-env
ARG MONGO_PORT ${MONGO_PORT}
ARG MONGO_HOST ${MONGO_HOST}
RUN echo "export MONGO_HOST=$MONGO_HOST" >/app/tedge/tedge-mgm-env
RUN echo "export MONGO_PORT=$MONGO_PORT" >>/app/tedge/tedge-mgm-env

RUN echo "{}" >/etc/tedge/tedge-mgm/tedgeSeriesStore.json
RUN chmod 755 /etc/tedge/tedge-mgm/tedgeSeriesStore.json
RUN chown tedge-mgm:tedge-mgm /etc/tedge/tedge-mgm/tedgeSeriesStore.json

CMD ["/sbin/init"]
