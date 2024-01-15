import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Client,
  BasicAuth,
  FetchClient,
  IFetchOptions,
  IFetchResponse
} from '@c8y/client';
import {
  BackendCommand,
  BackendCommandProgress,
  BackendStatusEvent,
  CommandStatus,
  MeasurementType,
  RawMeasurement,
  TedgeConfiguration,
  TedgeMgmConfiguration,
  TedgeStatus
} from './property.model';
import { Socket } from 'ngx-socket-io';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { map, scan, shareReplay, tap } from 'rxjs/operators';
import { AlertService } from '@c8y/ngx-components';

const C8Y_CLOUD_URL = 'c8yCloud';
const INVENTORY_URL = '/inventory/managedObjects';
const LOGIN_URL = '/tenant/currentTenant';

// needs files access to tedge
const TEDGE_CONFIGURATION_URL = '/api/configuration/tedge';
const DOWNLOAD_CERTIFICATE_URL = '/api/configuration/certificate';
const INVENTORY_BRIDGED_URL = '/api/bridgedInventory';

// doesn't needs files access to tedge, separate configuration file
const TEDGE_MGM_CONFIGURATION_URL = '/api/configuration/tedge-mgm';

// served from MONGO
const MEASUREMENT_URL = '/api/analytics/measurement';
const MEASUREMENT_TYPES_URL = '/api/analytics/types';
const SERVICE_URL = '/api/services';
const STATUS_LOG_HISTORY = 30;

// socket to do the stop / start/ configure certificate

@Injectable({
  providedIn: 'root'
})
export class EdgeService {
  private fetchClient: FetchClient;
  private edgeConfiguration: any = {};
  private jobProgress$: BehaviorSubject<number> = new BehaviorSubject<number>(
    0
  );
  private tedgeStatus$: BehaviorSubject<TedgeStatus> =
    new BehaviorSubject<TedgeStatus>(TedgeStatus.UNKNOWN);
  private tedgeStatusReplay$: Observable<TedgeStatus>;
  private statusLog$: Subject<BackendStatusEvent> =
    new Subject<BackendStatusEvent>();
  private statusLogs$: Observable<BackendStatusEvent[]>;
  private pendingCommand$: Observable<string>;
  private _tedgeMgmConfigurationPromise: Promise<TedgeMgmConfiguration>;
  private _tedgeMgmConfiguration: TedgeMgmConfiguration;

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

  getCommandPending(): Observable<string> {
    return this.pendingCommand$;
  }

  resetLog(): void {
    this.statusLog$.next({
      status: CommandStatus.RESET_JOB_LOG,
      date: new Date()
    });
    this.jobProgress$.next(0);
  }

  delayResetProgress(): void {
    setTimeout(() => {
      this.jobProgress$.next(0);
    }, 2000);
  }

  private initJobProgress() {
    this.getJobProgressEvents().subscribe((st: BackendCommandProgress) => {
      console.log('JobProgress:', st);
      this.jobProgress$.next((100 * (st.progress + 1)) / st.total);
      if (st.status == 'error') {
        this.statusLog$.next({
          date: new Date(),
          message: `Running command ${st.job} failed at step: ${st.progress}`,
          status: CommandStatus.ERROR
        });
        this.delayResetProgress();
      } else if (st.status == 'end-job') {
        // this.alertService.success(`Successfully completed command ${st.job}.`);
        this.statusLog$.next({
          date: new Date(),
          message: `Successfully completed command ${st.job}`,
          status: CommandStatus.END_JOB
        });
        if ((st.job == 'configure')) {
          this.tedgeStatus$.next(TedgeStatus.INITIALIZED);
        } else if ((st.job == 'start')) {
          this.tedgeStatus$.next(TedgeStatus.REGISTERED);
        } else if ((st.job == 'reset')) {
          this.tedgeStatus$.next(TedgeStatus.BLANK);
        }
        this.delayResetProgress();
      } else if (st.status == 'start-job') {
        this.jobProgress$.next(0);
        this.statusLog$.next({
          date: new Date(),
          message: `Starting job ${st.job}`,
          status: CommandStatus.START_JOB
        });
      } else if (st.status == 'processing') {
        this.statusLog$.next({
          date: new Date(),
          message: `${st.cmd}`,
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
    this.getJobOutput().subscribe((st: string) => {
      this.statusLog$.next({
        date: new Date(),
        message: `${st}`,
        status: CommandStatus.RESULT_JOB
      });
    });

    this.pendingCommand$ = this.getJobProgressEvents().pipe(
      map((st) =>
        // console.log("CommandProgress:", st);
        st.status == 'error' || st.status == 'end-job' ? '' : st.job
      )
    );

    this.tedgeStatusReplay$ = this.tedgeStatus$.pipe(
      tap(async (status) => {
        const tmc = await this.getTedgeMgmConfiguration();
        if (status != TedgeStatus.UNKNOWN) {
          tmc.status = status;
          this._tedgeMgmConfigurationPromise = this.setTedgeMgmConfiguration(tmc);
        }
      }),
      map( status => {
        let newStatus = status;
        if (status == TedgeStatus.UNKNOWN) {
          const tmc =  this._tedgeMgmConfiguration;
          newStatus = tmc.status;
        }
        return newStatus;
      }),
      shareReplay(1)
    );
  }

  startBackendJob(cmd: BackendCommand) {
    this.socket.emit('job-input', cmd);
  }

  getJobProgressEvents(): Observable<BackendCommandProgress> {
    return this.socket.fromEvent('job-progress');
  }

  getJobOutput(): Observable<string> {
    return this.socket.fromEvent('job-output');
  }

  startShellCommand(msg) {
    this.socket.emit('shell-input', msg);
  }

  getShellCommandExit(): Observable<string> {
    return this.socket.fromEvent('shell-exit');
  }

  getShellCommandOutput(): Observable<string> {
    return this.socket.fromEvent('shell-output');
  }

  getShellCommandConfirmation(): Observable<string> {
    return this.socket.fromEvent('shell-cmd');
  }

  getLastMeasurements(displaySpan: number): Promise<RawMeasurement[]> {
    const promise = new Promise<any[]>((resolve, reject) => {
      const params = new HttpParams({
        fromObject: {
          displaySpan: displaySpan.toString()
        }
      });
      this.http
        .get<RawMeasurement[]>(MEASUREMENT_URL, { params: params })
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
        .get<RawMeasurement[]>(MEASUREMENT_URL, { params: params })
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

  getRealtimeMeasurements(): Observable<RawMeasurement> {
    this.socket.emit('new-measurement', 'start');
    const obs = this.socket
      .fromEvent<string>('new-measurement')
      .pipe(map((m) => JSON.parse(m)));
    return obs;
  }

  stopMeasurements(): void {
    this.socket.emit('new-measurement', 'stop');
  }

  refreshTedgeConfiguration(ec: any) {
    this.edgeConfiguration = {
      ...this.edgeConfiguration,
      ...ec
    };
    console.log('Updated edgeConfiguration:', ec, this.edgeConfiguration);
  }

  getTedgeServiceStatus(): Promise<any> {
    return this.http
      .get<any>(SERVICE_URL)
      .toPromise()
      .then((res) => {
        console.log('New status', res);
        return res;
      })
      .catch(() => {
        console.log('Cannot reach backend!');
        this.alertService.warning('Cannot reach backend!');
      });
  }
  getTedgeConfiguration(): Promise<TedgeConfiguration> {
    return this.http
      .get<any>(TEDGE_CONFIGURATION_URL)
      .toPromise()
      .then((config) => {
        Object.keys(config).forEach((key) => {
          if (key == 'c8y.url') {
            this.edgeConfiguration.tenantUrl = config[key];
          } else if (key == 'device.id') {
            this.edgeConfiguration.deviceId = config[key];
          } else {
            this.edgeConfiguration[key] = config[key];
          }
        });
        return this.edgeConfiguration;
      })
      .catch(() => {
        console.log('Cannot reach backend!');
        this.alertService.warning('Cannot reach backend!');
        return {};
      });
  }

  getMeasurementTypes(): Promise<any[]> {
    return this.http
      .get<MeasurementType[]>(MEASUREMENT_TYPES_URL)
      .toPromise()
      .then((config) => {
        return config;
      });
  }

  async getTedgeMgmConfiguration(): Promise<TedgeMgmConfiguration> {
    let result = this._tedgeMgmConfigurationPromise;
    if (!result) {
      result = this.http
        .get<any>(TEDGE_MGM_CONFIGURATION_URL)
        .toPromise()
        .then((config) => {
          return config;
        })
        .catch(() => {
          console.log('Cannot reach backend!');
          this.alertService.warning('Cannot reach backend!');
        });
      this._tedgeMgmConfigurationPromise = result;
      this._tedgeMgmConfiguration = await result;
    }
    return result;
  }

  setTedgeMgmConfiguration(
    config: TedgeMgmConfiguration
  ): Promise<TedgeMgmConfiguration> {
    // console.log("Configuration to be stored:", config)
    return this.http
      .post<any>(TEDGE_MGM_CONFIGURATION_URL, config)
      .toPromise()
      .then((config) => {
        return config;
      });
  }

  getDetailsCloudDeviceFromTedge(externalId: string): Promise<any> {
    console.log('Preparing Inventory call:', INVENTORY_BRIDGED_URL);
    return this.http
      .get<any>(`${INVENTORY_BRIDGED_URL}/${externalId}`)
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

  getDetailsCloudDevice(externalId: string): Promise<any> {
    const options: IFetchOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    const externalIdType = 'c8y_Serial';
    const url_id =
      `/identity/externalIds/${externalIdType}/${externalId}` +
      `?proxy=${this.edgeConfiguration.tenantUrl}`;
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
        const url_inv = `${INVENTORY_URL}/${deviceId}`;
        return this.fetchClient
          .fetch(this.addProxy2Url(url_inv), options)
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

    const client = new Client(auth, C8Y_CLOUD_URL);
    this.fetchClient = client.core;
  }

  login(): Promise<IFetchResponse> {
    const options: IFetchOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const loginPromise: Promise<IFetchResponse> = this.fetchClient
      .fetch(this.addProxy2Url(LOGIN_URL), options)
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

  addProxy2Url(url: string): string {
    return `${url}?proxy=${this.edgeConfiguration.tenantUrl}`;
  }

  async uploadCertificateToTenant(): Promise<any> {
    const res = await this.login();
    const body = await res.json();
    const currentTenant = body.name;
    const certificate_url = this.addProxy2Url(
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
        name: this.edgeConfiguration.deviceId
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
    const ok = (await uploadPromise).ok;
    if (ok) {
      // update tedge mgm status
      this.tedgeStatus$.next(TedgeStatus.INITIALIZED);
    }
    return uploadPromise;
  }

  downloadCertificate(t: string): Promise<any> {
    const bc: BackendCommand = {
      job: 'empty',
      promptText: 'Download Certificate  ...'
    };
    this.startBackendJob(bc);
    const promise = new Promise((resolve, reject) => {
      const apiURL = DOWNLOAD_CERTIFICATE_URL;
      const params = new HttpParams({
        fromObject: {
          deviceId: this.edgeConfiguration.deviceId
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

  async startTedge() {
    const bc: BackendCommand = {
      job: 'start',
      promptText: 'Starting Tedge ...'
    };
    this.startBackendJob(bc);
  }

  async stopTedge() {
    const bc: BackendCommand = {
      job: 'stop',
      promptText: 'Stopping Tedge ...'
    };
    this.startBackendJob(bc);
  }

  async restartPlugins() {
    const bc: BackendCommand = {
      job: 'restartPlugins',
      promptText: 'Restarting Plugins  ...'
    };
    this.startBackendJob(bc);
  }

  async resetTedge() {
    const bc: BackendCommand = {
      job: 'reset',
      promptText: 'Resetting Tedge ...'
    };
    this.startBackendJob(bc);
  }

  async configureTedge() {
    const url = this.edgeConfiguration.tenantUrl
      .replace('https://', '')
      .replace('/', '') as string;
    const bc: BackendCommand = {
      job: 'configure',
      promptText: 'Configure Tedge ...',
      deviceId: this.edgeConfiguration.deviceId,
      tenantUrl: url
    };
    this.startBackendJob(bc);
  }

  // Error handling
  private error(error: any) {
    const message = error.message
      ? error.message
      : error.status
        ? `${error.status} - ${error.statusText}`
        : 'Server error';
    console.error(message);
  }
}
