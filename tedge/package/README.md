# Package tedge-mgmt-server

This folder contains a `npfm.yaml` file to create packages (deb, apk, rpm). these can be installed on a running thin edge, e.g. [tedge-demo-container](https://github.com/thin-edge/tedge-demo-container).

## Pre-requisites

The following pre-requisites are required before you can get started:

* docker
* npm
* nodejs

## Getting started

1. Download the repository from https://github.com/thin-edge/tedge-management-ui.git
2. Build the ui part:
    ```cd tedge/ui
       npm i
       npm run release       # this create the [tedge-mgmt-ui](../ui/dist/tedge-mgmt-ui.tar.gz), to be included in the package later
    ```
3. Build the servicer part:
    ```
       cd tedge/server
       npm i  
       npm run release       # this create the [tedge-mgmt-server](../server/dist/tedge-mgmt-server.tar.gz), to be included in the package later
    ```
4. Build the linux package:
    ```cd tedge/package
       ./build.sh 0.0.1      # run script to build packages (deb, apk, rpm)
    ```
5. Start [tedge-demo-container](https://github.com/thin-edge/tedge-demo-container) and copy the package [tedge-mgmt-server_0.0.1_all.deb](dist/tedge-mgmt-server_0.0.1_all.deb) to the container. Make sure you expose port `9080`, as this is the port where the UI is accessible.
6. Run the following cmds in the docker container, installing nodejs, system manager scripts `tedgectl`:
    ```sudo apt update
       sudo apt install nodejs npm -y  # install nodejs
       curl -1sLf 'https://dl.cloudsmith.io/public/thinedge/community/setup.deb.sh' | sudo bash
       sudo apt-get  -o Dpkg::Options::="--force-overwrite" install tedge-systemd
       dpkg -i ./tedge-mgmt-server_0.0.1_all.deb  # installs the package
    ```
6. Now you can access the [tedge management web ui](http://localhost:9080/#/edge/setup) in a browser.