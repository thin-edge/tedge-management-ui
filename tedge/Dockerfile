FROM node:16-alpine3.15

# Otherwise mosquitto fails
VOLUME ["/sys/fs/cgroup"]

# We need curl to get root certificates
RUN apk update \
    && apk --no-cache add bash curl sudo openrc

# Install thin-edge.io and openrc services
RUN wget -O - thin-edge.io/install.sh | sh -s \
    && wget -O - thin-edge.io/install-services.sh | sh -s -- openrc \
    && apk --no-cache add --force-overwrite \
        tedge-apk-plugin \
        tedge-collectd-setup \
    && tedgectl enable tedge-mapper-collectd

# Add user and groups
RUN addgroup -S tedge-ui \
    && adduser -g "" -H -D tedge-ui -G tedge-ui \
    # Add tedge to sudoers
    && echo "%tedge   ALL = (ALL) NOPASSWD: ALL" >/etc/sudoers.d/tedge \
    # Add tedge-ui to sudoers
    && echo "%tedge-ui   ALL = (ALL) NOPASSWD: ALL" >/etc/sudoers.d/tedge-ui

# thin-edge.io configuration
COPY --chmod=644 ./etc/tedge/tedge-log-plugin.toml /etc/tedge/plugins/tedge-log-plugin.toml
COPY --chmod=644 ./etc/tedge/tedge-configuration-plugin.toml /etc/tedge/plugins/tedge-configuration-plugin.toml
COPY --chown=tedge:tedge ./etc/tedge/tedge.toml /etc/tedge/

# mosquitto settings
COPY ./etc/mosquitto/mosquitto.conf /etc/mosquitto/mosquitto.conf
RUN mkdir -p /var/log/mosquitto \
    && chown -R mosquitto:mosquitto /var/log/mosquitto

# Install tedge-ui service
COPY --chmod=755 ./etc/init.d/* /etc/init.d/
RUN rc-update add tedge-ui default

# Create required tedge directories and files
RUN install -g tedge-ui -o tedge-ui -m 755 -d /etc/tedge/tedge-ui

# Comment out getty's, since they cause error messages
COPY ./etc/inittab /etc/inittab

# Build web app
WORKDIR /app/tedge
COPY ./ /app/tedge

# Set environment MONGO_HOTS, MONGO_PORT variavle in /app/tedge/tedge-ui-env
ARG MONGO_PORT ${MONGO_PORT}
ARG MONGO_HOST ${MONGO_HOST}
RUN echo "export MONGO_HOST=$MONGO_HOST" >/app/tedge/tedge-ui-env
RUN echo "export MONGO_PORT=$MONGO_PORT" >>/app/tedge/tedge-ui-env
RUN npm install -g @angular/cli && npm install -f
RUN npm run build

CMD ["/sbin/init"]
