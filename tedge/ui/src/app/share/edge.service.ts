import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  BasicAuth,
  Client,
  FetchClient,
  IFetchOptions,
  IFetchResponse
} from '@c8y/client';
import { AlertService } from '@c8y/ngx-components';
import { Socket } from 'ngx-socket-io';
import { BehaviorSubject, Observable, Subject, from } from 'rxjs';
import { filter, map, scan, shareReplay, switchMap, tap } from 'rxjs/operators';
import {
  BackendJob,
  BackendJobProgress,
  BackendConfiguration,
  BackendStatusEvent,
  CommandStatus,
  MeasurementType,
  RawMeasurement,
  TedgeConfiguration,
  TedgeStatus,
  BackendTaskOutput
} from './property.model';
import {
  BACKEND_CONFIGURATION_ENDPOINT,
  BACKEND_DOWNLOAD_CERTIFICATE_ENDPOINT,
  BACKEND_MEASUREMENT_TYPES_ENDPOINT,
  BACKEND_MEASUREMENT_ENDPOINT,
  BACKEND_STORAGE_STATISTIC_ENDPOINT,
  BACKEND_STORAGE_TTL_ENDPOINT,
  C8Y_CLOUD_ENDPOINT,
  INVENTORY_BRIDGED_ENDPOINT,
  INVENTORY_ENDPOINT,
  LOGIN_ENDPOINT,
  STATUS_LOG_HISTORY,
  TEDGE_GENERIC_REQUEST_ENDPOINT,
  TEDGE_GENERIC_TYPES_ENDPOINT,
  TedgeConfigType,
  TedgeGenericCmdRequest,
  propertiesToJson
} from './utils';

// socket to do the stop / start/ configure certificate

@Injectable({
  providedIn: 'root'
})
export class EdgeService {
  private fetchClient: FetchClient;
  private jobProgress$: BehaviorSubject<number> = new BehaviorSubject<number>(
    0
  );
  private refreshConfigurations$: BehaviorSubject<void> =
    new BehaviorSubject<void>(undefined);
  private tedgeStatusReplay$: Observable<TedgeStatus>;
  private statusLog$: Subject<BackendStatusEvent> =
    new Subject<BackendStatusEvent>();
  private statusLogs$: Observable<BackendStatusEvent[]>;
  private _backendConfigurationPromise: Promise<BackendConfiguration>;
  private tedgeConfiguration$: BehaviorSubject<TedgeConfiguration> =
    new BehaviorSubject<TedgeConfiguration>({});
  private _tedgeConfiguration: TedgeConfiguration;

  private obs: Observable<RawMeasurement>;

  constructor(
    private http: HttpClient,
    private socket: Socket,
    private alertService: AlertService
  ) {
    this.initJobProgress();
  }

  getJobProgress(): Observable<number> {
    return this.jobProgress$;
  }

  getTedgeStatus(): Observable<TedgeStatus> {
    return this.tedgeStatusReplay$;
  }

  getBackendStatusEvents(): Observable<BackendStatusEvent[]> {
    return this.statusLogs$;
  }

  resetLog(): void {
    this.statusLog$.next({
      jobName: CommandStatus.RESET_JOB_LOG,
      status: CommandStatus.RESET_JOB_LOG,
      date: new Date()
    });
    this.jobProgress$.next(0);
  }

  delayResetProgress(): void {
    setTimeout(() => {
      this.jobProgress$.next(0);
    }, 1500);
  }

  private initJobProgress() {
    const myObservable = from([1, 2, 3, 4, 5]);
    const myPromise = myObservable.toPromise();
    myPromise.then((result) => console.log(result));

    this.responseTedgeConfiguration().subscribe((output) => {
      this._tedgeConfiguration = propertiesToJson(output.output);
      console.log('New tedgeConfiguration', this._tedgeConfiguration);
      this.tedgeConfiguration$.next(this._tedgeConfiguration);
    });
    this.getJobProgressEvents().subscribe((job: BackendJobProgress) => {
      console.log('JobProgress:', job);
      this.jobProgress$.next((100 * (job.progress + 1)) / job.total);
      if (job.status == 'error') {
        this.statusLog$.next({
          jobName: job.jobName,
          date: new Date(),
          message: `Running command ${job.jobName} failed at step: ${job.progress}`,
          status: CommandStatus.ERROR
        });
        this.delayResetProgress();
      } else if (job.status == 'end-job') {
        // this.alertService.success(`Successfully completed command ${st.job}.`);
        this.statusLog$.next({
          jobName: job.jobName,
          date: new Date(),
          message: `Successfully completed command ${job.jobName}`,
          status: CommandStatus.END_JOB
        });
        if (job.jobName != 'tedgeConfiguration')
          this.refreshConfigurations$.next();
        this.delayResetProgress();
      } else if (job.status == 'start-job') {
        this.jobProgress$.next(0);
        this.statusLog$.next({
          jobName: job.jobName,
          date: new Date(),
          message: `Starting job ${job.jobName}`,
          status: CommandStatus.START_JOB
        });
      } else if (job.status == 'processing') {
        this.statusLog$.next({
          jobName: job.jobName,
          date: new Date(),
          message: `${job.cmd}`,
          status: CommandStatus.CMD_JOB
        });
      }
    });

    this.statusLogs$ = this.statusLog$.pipe(
      // tap((i) => console.log('Items', i)),
      scan((acc, val) => {
        let sortedAcc;
        if (val.status == CommandStatus.RESET_JOB_LOG) {
          sortedAcc = [];
        } else {
          sortedAcc = [val].concat(acc);
          sortedAcc = sortedAcc.slice(0, STATUS_LOG_HISTORY - 1);
        }
        return sortedAcc;
      }, [] as BackendStatusEvent[]),
      shareReplay(STATUS_LOG_HISTORY)
    );
    this.getJobOutput().subscribe((output) => {
      this.statusLog$.next({
        jobName: output.jobName,
        date: new Date(),
        message: `${output.output}`,
        status: CommandStatus.RESULT_JOB
      });
    });

    this.tedgeStatusReplay$ = this.refreshConfigurations$.pipe(
      tap(() => {
        this._backendConfigurationPromise = undefined;
        // this.requestTedgeConfiguration();
      }),
      switchMap(() => this.getBackendConfiguration()),
      map((conf) => conf.status),
      shareReplay(1)
    );

    this.requestTedgeConfiguration();
  }

  startBackendJob(cmd: BackendJob) {
    this.socket.emit('channel-job-submit', cmd);
  }

  getJobProgressEvents(): Observable<BackendJobProgress> {
    return this.socket.fromEvent('channel-job-progress');
  }

  getJobOutput(): Observable<BackendTaskOutput> {
    return this.socket.fromEvent('channel-job-output');
  }

  responseTedgeServiceStatus(): Observable<BackendTaskOutput> {
    return this.getJobOutput().pipe(
      filter((job) => job.jobName == 'serviceStatus')
    );
  }

  responseTedgeConfiguration(): Observable<BackendTaskOutput> {
    return this.getJobOutput().pipe(
      filter((job) => job.jobName == 'tedgeConfiguration')
    );
  }

  getTedgeCmdOutput(): Observable<any> {
    return this.socket.fromEvent('channel-tedge-cmd');
  }

  getTedgeLogUploadResponse(): Observable<any> {
    return this.getTedgeCmdOutput().pipe(
      filter((document) => document.cmdType === 'log_upload'),
      map((document) => document.payload)
    );
  }

  getTedgeConfigSnapshotResponse(): Observable<any> {
    return this.getTedgeCmdOutput().pipe(
      filter((document) => document.cmdType === 'config_snapshot'),
      map((document) => document.payload)
    );
  }

  getTedgeConfigUpdateResponse(): Observable<any> {
    return this.getTedgeCmdOutput().pipe(
      filter((document) => document.cmdType === 'config_update'),
      map((document) => document.payload)
    );
  }

  getLastMeasurements(displaySpan: number): Promise<RawMeasurement[]> {
    const promise = new Promise<any[]>((resolve, reject) => {
      const params = new HttpParams({
        fromObject: {
          displaySpan: displaySpan.toString()
        }
      });
      this.http
        .get<RawMeasurement[]>(BACKEND_MEASUREMENT_ENDPOINT, { params: params })
        .toPromise()
        .then(
          (res: any[]) => {
            // Success
            resolve(res);
          },
          (err) => {
            // Error
            reject(err);
          }
        );
    });
    return promise;
  }

  getMeasurements(dateFrom: Date, dateTo: Date): Promise<RawMeasurement[]> {
    const promise = new Promise<any[]>((resolve, reject) => {
      const params = new HttpParams({
        fromObject: {
          dateFrom: dateFrom.toISOString(),
          dateTo: dateTo.toISOString()
        }
      });
      this.http
        .get<RawMeasurement[]>(BACKEND_MEASUREMENT_ENDPOINT, { params: params })
        .toPromise()
        .then(
          (res: any[]) => {
            // Success
            resolve(res);
          },
          (err) => {
            // Error
            reject(err);
          }
        );
    });
    return promise;
  }

  getTedgeGenericConfigType(configType: TedgeConfigType): Promise<string[]> {
    const promise = new Promise<any[]>((resolve, reject) => {
      this.http
        .get<RawMeasurement[]>(`${TEDGE_GENERIC_TYPES_ENDPOINT}/${configType}`)
        .toPromise()
        .then(
          (res: any[]) => {
            // Success
            resolve(res);
          },
          (err) => {
            // Error
            reject(err);
          }
        );
    });
    return promise;
  }

  sendTedgeGenericCmdRequest(
    genericCmdRequest: TedgeGenericCmdRequest
  ): Promise<any> {
    return this.http
      .post<any>(`${TEDGE_GENERIC_REQUEST_ENDPOINT}`, genericCmdRequest)
      .toPromise()
      .then((response) => {
        return response;
      });
  }

  getTedgeGenericCmdResponse(tedgeUrl: string): Promise<any> {
    const params = new HttpParams({
      fromObject: {
        tedgeUrl: tedgeUrl
      }
    });
    return this.http
      .get(TEDGE_GENERIC_REQUEST_ENDPOINT, { params, responseType: 'text' })
      .toPromise()
      .then((response) => {
        return response;
      })
      .catch((error) => {
        console.log('Cannot reach backend!', error);
      });
  }

  getRealtimeMeasurements(): Observable<RawMeasurement> {
    this.socket.emit('channel-measurement', 'start');
    this.obs = this.socket
      .fromEvent<string>('channel-measurement')
      .pipe(map((m) => JSON.parse(m)));
    return this.obs;
  }

  stopMeasurements(): void {
    this.socket.emit('channel-measurement', 'stop');
  }

  getTedgeConfiguration(): Observable<TedgeConfiguration> {
    return this.tedgeConfiguration$.pipe(shareReplay(1));
  }

  getMeasurementTypes(): Promise<any[]> {
    let result = Promise.resolve([]);
    result = this.http
      .get<MeasurementType[]>(BACKEND_MEASUREMENT_TYPES_ENDPOINT)
      .toPromise()
      .then((config) => {
        return config;
      });
    return result;
  }

  async getBackendConfiguration(): Promise<BackendConfiguration> {
    let result = this._backendConfigurationPromise;
    if (!result) {
      result = this.http
        .get<any>(BACKEND_CONFIGURATION_ENDPOINT)
        .toPromise()
        .then((config) => {
          return config;
        })
        .catch(() => {
          console.log('Cannot reach backend!');
          this.alertService.warning('Cannot reach backend!');
        });
      this._backendConfigurationPromise = result;
    }
    return result;
  }

  setBackendConfiguration(
    config: BackendConfiguration
  ): Promise<BackendConfiguration> {
    // console.log("Configuration to be stored:", config)
    return this.http
      .post<any>(BACKEND_CONFIGURATION_ENDPOINT, config)
      .toPromise()
      .then((config) => {
        return config;
      });
  }

  getDetailsCloudDeviceFromTedge(externalId: string): Promise<any> {
    console.log('Preparing Inventory call:', INVENTORY_BRIDGED_ENDPOINT);
    return this.http
      .get<any>(`${INVENTORY_BRIDGED_ENDPOINT}/${externalId}`)
      .toPromise()
      .then((response) => {
        console.log('Inventory response:', response);
        return response;
      })
      .catch(() => {
        console.log('Cannot reach backend!');
        this.alertService.warning('Cannot reach backend!');
      });
  }

  async getDetailsCloudDevice(externalId: string): Promise<any> {
    const options: IFetchOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const externalIdType = 'c8y_Serial';
    const url_id =
      `/identity/externalIds/${externalIdType}/${externalId}` +
      `?proxy=${this._tedgeConfiguration.c8y.url}`;

    const inventoryPromise: Promise<IFetchResponse> = this.fetchClient
      .fetch(url_id, options)
      .then((response) => {
        console.log('Inventory response:', response);
        return response;
      })
      .then((response) => response.json())
      .then((json) => {
        console.log('Device id response:', json.managedObject.id);
        const deviceId = json.managedObject.id;
        const proxiedInventoryUrl = `${INVENTORY_ENDPOINT}/${deviceId}?proxy=${this._tedgeConfiguration.c8y.url}`;
        return this.fetchClient
          .fetch(proxiedInventoryUrl, options)
          .then((response) => {
            console.log('Inventory response:', response);
            return response;
          });
      })
      .then((response) => response.json())
      .catch((err) => {
        console.log(`Could not login:${err.message}`);
        return err;
      });
    return inventoryPromise;
  }

  initFetchClient(credentials: any) {
    const auth = new BasicAuth({
      user: credentials.username,
      password: credentials.password
    });

    const client = new Client(auth, C8Y_CLOUD_ENDPOINT);
    this.fetchClient = client.core;
  }

  async login(): Promise<IFetchResponse> {
    const options: IFetchOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const proxyUrl = await this.addProxy2Url(LOGIN_ENDPOINT);
    const loginPromise: Promise<IFetchResponse> = this.fetchClient
      .fetch(proxyUrl, options)
      .then((response) => {
        // console.log ("Resulting cmd:", response);
        return response;
      })
      .catch((err) => {
        console.log(`Could not login:${err.message}`);
        return err;
      });
    return loginPromise;
  }

  async addProxy2Url(url: string): Promise<string> {
    return `${url}?proxy=${this._tedgeConfiguration.c8y.url}`;
  }

  async uploadCertificateToTenant(): Promise<any> {
    const res = await this.login();
    const body = await res.json();
    const currentTenant = body.name;
    const certificate_url = await this.addProxy2Url(
      `/tenant/tenants/${currentTenant}/trusted-certificates`
    );
    console.log('Response body from login:', body);

    const cert = await this.downloadCertificate('text');
    console.log('Response body from certificate:', cert);
    const options: IFetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        certInPemFormat: cert,
        autoRegistrationEnabled: true,
        status: 'ENABLED',
        name: this._tedgeConfiguration.device.id
      })
    };

    // console.log("Upload certificate:", certificate_url, cert)
    const uploadPromise: Promise<IFetchResponse> = this.fetchClient
      .fetch(certificate_url, options)
      .then(async (response) => {
        // console.log ("Resulting cmd:", response);
        return response;
      })
      .catch((err) => {
        console.log(`Could not upload certificate:${err.message}`);
        return err;
      });
    const { ok } = await uploadPromise;
    if (ok) {
      this.informTedgeUploadCertificate();
    }
    return uploadPromise;
  }

  async downloadCertificate(t: string): Promise<any> {
    const bc: BackendJob = {
      jobName: 'empty',
      promptText: 'Download Certificate  ...'
    };
    this.startBackendJob(bc);
    const promise = new Promise((resolve, reject) => {
      const apiURL = BACKEND_DOWNLOAD_CERTIFICATE_ENDPOINT;
      const params = new HttpParams({
        fromObject: {
          deviceId: this._tedgeConfiguration.device.id
        }
      });
      let options: any;
      if (t == 'text') {
        options = { params: params, responseType: 'text' };
      } else {
        options = { params: params, responseType: 'blob' as 'json' };
      }
      this.http
        .get(apiURL, options)
        .toPromise()
        .then(
          (res: any) => {
            // Success
            resolve(res);
          },
          (err) => {
            // Error
            reject(err);
          }
        );
    });
    return promise;
  }

  getStorageStatistic(): Promise<any> {
    return this.http
      .get<any>(BACKEND_STORAGE_STATISTIC_ENDPOINT)
      .toPromise()
      .then((res) => {
        return res;
      })
      .catch(() => {
        console.log('Cannot reach backend!');
        this.alertService.warning('Cannot reach backend!');
      });
  }

  getStorageTTL(): Promise<number> {
    return this.http
      .get<any>(BACKEND_STORAGE_TTL_ENDPOINT)
      .toPromise()
      .then((res) => {
        return res;
      });
    //   .catch(() => {
    //     console.log('Cannot reach backend!');
    //     this.alertService.warning('Cannot reach backend!');
    //   });
  }

  updateStorageTTL(ttl: number): Promise<number | void> {
    return this.http
      .post<number>(BACKEND_STORAGE_TTL_ENDPOINT, { ttl })
      .toPromise()
      .then((res) => {
        this.alertService.success(`Updated TTL ${ttl}!`);
        return res;
      })
      .catch(() => {
        console.log('Cannot reach backend!');
        this.alertService.warning('Cannot reach backend!');
      });
  }

  async startTedge() {
    const bc: BackendJob = {
      jobName: 'startTedge',
      promptText: 'Starting Tedge ...'
    };
    this.startBackendJob(bc);
  }

  async stopTedge() {
    const bc: BackendJob = {
      jobName: 'stopTedge',
      promptText: 'Stopping Tedge ...'
    };
    this.startBackendJob(bc);
  }

  async resetTedge() {
    const bc: BackendJob = {
      jobName: 'resetTedge',
      promptText: 'Resetting Tedge ...'
    };
    this.startBackendJob(bc);
  }

  async requestTedgeServiceStatus() {
    const bc: BackendJob = {
      jobName: 'serviceStatus',
      promptText: 'Get service status ...'
    };
    this.startBackendJob(bc);
  }

  async requestTedgeConfiguration() {
    const bc: BackendJob = {
      jobName: 'tedgeConfiguration',
      promptText: 'Get tedge configuration  ...'
    };
    this.startBackendJob(bc);
  }

  async informTedgeUploadCertificate() {
    const bc: BackendJob = {
      jobName: 'uploadCertificate',
      promptText: 'Uploaded Certificate to Tenant ...'
    };
    this.startBackendJob(bc);
  }

  async serviceCommand(service: string, command: string) {
    const bc: BackendJob = {
      jobName: 'custom',
      args: ['rc-service', service, command],
      promptText: `service ${service} command ${command}`
    };
    this.startBackendJob(bc);
  }

  async configureTedge(c8yUrl, deviceId) {
    const url = c8yUrl.replace('https://', '').replace('/', '') as string;
    const bc: BackendJob = {
      jobName: 'configureTedge',
      promptText: 'Configure Tedge ...',
      deviceId,
      tenantUrl: url
    };
    this.startBackendJob(bc);
  }

  async getLinkToDeviceInDeviceManagement() {
    const managedObject = await this.getDetailsCloudDeviceFromTedge(
      this._tedgeConfiguration.device.id
    );
    let link = 'NOT_COMPLETE';
    if (managedObject && managedObject.id) {
      link = `https://${this._tedgeConfiguration?.c8y?.http}/apps/devicemanagement/index.html#/device/${managedObject.id}`;
    }
    return link;
  }
}
