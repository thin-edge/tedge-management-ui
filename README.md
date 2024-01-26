# Cumulocity thin-edge.io Management UI


This project adds an configuration ui to thin-edge.io. It enables you to use thin-edge.io with an easy-to-use docker based deployment and no code commissioning process. This helps to setup and monitor the edge using a web-ui:
* web-ui, for easy setup of the Thin Edge 
* simple line chart to view streamed data and to view historical data
* component to store measurements locally in a mongo db

# Content
- [Cumulocity thin-edge.io Management UI](#cumulocity-thin-edgeio-management-ui)
- [Content](#content)
- [Solution components](#solution-components)
- [Build Thin Edge binaries and run solution](#build-thin-edge-binaries-and-run-solution)
- [Configure Thin Edge in the web-ui](#configure-thin-edge-in-the-web-ui)
- [Contributing](#contributing)
- [License](#license)


# Solution components

This solution consists of 3 services:
* `tedge`: contain the Thin Edge core services: `tedge-agent`, `tedge-mapper`, ... and `tedge-mgm` app
* `mqtt-collector`: listens to measurements on all topics of the mosquitto broker and sends them to the mongo db
* `mongodb`: stores the measurements in a collection, to be retrieved by the web-ui. All measurements have time-to-live (TTL) of 300. This can be changed

When memory and storage usage should be minimized the solution can be confiured to run without storage. In this case the two container `mqtt-collector` and `mongodb` are not used.
In this case no historic measurements can be viewed, only realtime measurements can be viewed.

![Docker Container](resource/02-Architecture.svg)

The following diagram show how the components (`tedge-mgm`, `node` backend, `tedge` processes) in the tedge service communicate:

![Components of Docker Container tedge-mgm](resource/01-Architecture.svg)


# Build Thin Edge binaries and run solution

To build the docker image the docker memory config must be set greater than 2GB, e.g. 4GB.
To build the docker solution run:
```
docker-compose up
```

# Configure Thin Edge in the web-ui

To access the web-ui open a web browser at: http://localhost:9080/#/setup.\
Here you start the setup of the edge and enter external device id and your cumulocity tenant url.\
![Setup](resource/01-Setup.png)
Then press configure to create a device certificate. This Will late be uploaded to you cloud tenant. The Thin Edge uses the certificate for authentication:
![Setup](resource/02-Setup.png)
This will generate a certificate. This has to be uploaded through the web-ui. As mentioned before, the certificate is uploaded to the cloud tenant.
![Setup](resource/03-Setup.png)
Alternatively, you can download the certificate locally and upload it manually to your cloud tenant.
![Setup](resource/05-Setup.png)
A detailed description how to import your certificate can de found is [Cumulocity Administration Documentation](https://cumulocity.com/guides/users-guide/device-management/#managing-trusted-certificates) to your cumulocity cloud tenant.\
Download the certificate.\
When the certificate is uploaded you can start the edge. If everything went well the completion of the startup is acknowledged
![Setup](resource/01-Control.png)

The edge processes are started and the Thin Edge is registered in the cloud tenant
![Setup](resource/01-Cloud.png)

The registration to the cloud can be verified here as well:
![Setup](resource/04-Setup.png)

Then you can access the analytics dashboard : http://localhost:9080/#/analytics

![Setup](resource/01-Analytics.png)

and change the settings of the chart:
![Analytics Measurement Series](resource/02-Analytics.png)

In case the solution is used without the storage component you can only view measurement in realtime mode. The historic view is not available.

![Analytics without Storage](resource/03-Analytics.png)

# Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. How you can contribute to thin-edge.io you can find in the Contribution Guideline

Any contributions you make are greatly appreciated. 


# License

Distributed under the Apache 2.0 License. See LICENSE for more information. 