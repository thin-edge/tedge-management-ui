#
# ui-builder
#
FROM node:18-alpine3.18 as ui-builder

WORKDIR /stage

# Install dependencies
COPY ui/ ./
RUN npm i -g @angular/cli \
    && npm i
RUN npm run release

#
# server-builder
#
FROM node:18-alpine3.18 as server-builder

WORKDIR /stage

# Install dependencies
COPY server/ ./
RUN npm ci --production
RUN npm i -g @vercel/ncc
RUN npm run release

COPY server .

#
# Image
#
FROM node:18-alpine3.18

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
RUN addgroup -S tedge-mgmt \
    && adduser -g "" -H -D tedge-mgmt -G tedge-mgmt \
    # Add tedge to sudoers
    && echo "%tedge   ALL = (ALL) NOPASSWD: ALL" >/etc/sudoers.d/tedge \
    # Add tedge-mgmt to sudoers
    && echo "%tedge-mgmt   ALL = (ALL) NOPASSWD: ALL" >/etc/sudoers.d/tedge-mgmt

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

# Install tedge-mgmt-server service
COPY --chmod=755 ./etc/init.d/* /etc/init.d/
RUN rc-update add tedge-mgmt-server default

# allow server to read env variables: MQTT_HOST, MQTT_PORT, STORAGE_ENABLED, ANALYTICS_FLOW_ENABLED, SERVER_PORT
RUN echo 'rc_env_allow="MQTT_HOST MQTT_PORT MONGO_HOST MONGO_PORT STORAGE_ENABLED ANALYTICS_FLOW_ENABLED SERVER_PORT"'>> /etc/rc.conf

# Create required tedge directories and files
RUN install -g tedge-mgmt -o tedge-mgmt -m 755 -d /etc/tedge-mgmt-server

# Comment out getty's, since they cause error messages
COPY ./etc/inittab /etc/inittab

# Copy ui and server
# COPY --from=ui-builder /stage/dist/tedge-mgmt-ui.tar.gz /opt/tedge-mgmt-server/ui/dist/
# RUN tar -xzvf /opt/tedge-mgmt-server/ui/dist/tedge-mgmt-ui.tar.gz -C /opt/tedge-mgmt-server/ui/dist 
COPY --from=ui-builder /stage/dist/ /opt/tedge-mgmt-server/ui/dist/
COPY --from=server-builder /stage/dist /opt/tedge-mgmt-server/server/dist
COPY ./etc/scripts/tedge-mgmt-server/ /usr/bin/tedge-mgmt-server

CMD ["/sbin/init"]