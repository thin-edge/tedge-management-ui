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
  RawMeasurement
} from './property.model';
import { Socket } from 'ngx-socket-io';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import {
  distinctUntilChanged,
  filter,
  map,
  scan,
  shareReplay,
  startWith,
  switchMap,
  tap
} from 'rxjs/operators';
import {
  AlertService,
  AppStateService,
  TranslateService,
  UserPreferencesService
} from '@c8y/ngx-components';

const C8Y_CLOUD_URL = 'c8yCloud';
const INVENTORY_URL = '/inventory/managedObjects';
const LOGIN_URL = '/tenant/currentTenant';

// needs files access to tedge
const EDGE_CONFIGURATION_URL = '/api/configuration/edge';
const DOWNLOAD_CERTIFICATE_URL = '/api/configuration/certificate';
const INVENTORY_BRIDGED_URL = '/api/inventory/managedObjects';

// doesn't needs files access to tedge, separate configuration file
const ANALYTICS_CONFIGURATION_URL = '/api/configuration/analytics';

// served from MONGO
const MEASUREMENT_URL = '/api/analytics/measurement';
const MEASUREMENT_TYPES_URL = '/api/analytics/types';
const SERVICE_URL = '/api/services';

// socket to do the stop / start/ configure certificate

@Injectable({
  providedIn: 'root'
})
export class EdgeService {
  private fetchClient: FetchClient;
  private edgeConfiguration: any = {};
  private progress$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  private statusLog$: Subject<BackendStatusEvent> =
    new Subject<BackendStatusEvent>();
  private statusLogs$: Observable<BackendStatusEvent[]>;
  private pendingCommand$: Observable<string>;
  private subscriptionProgress: Subscription;
  private subscriptionOutput: Subscription;

  constructor(
    private http: HttpClient,
    private socket: Socket,
    private alertService: AlertService
  ) {
    this.initJobProgress();
    // const firstLanguage = this.translateService.firstSupportedLanguage();
    // console.log('AppStateService:', this.appStateService, firstLanguage);
    // this.appStateService.currentUser
    //   .pipe(
    //     map((user) => user && user.userName),
    //     tap((user) => console.log('*** User', user)),
    //     switchMap(() => this.userPreferences.get('language')),
    //     tap((user) => console.log('*** Language', user)),
    //     startWith(firstLanguage),
    //     filter((lang) => !!lang),
    //     distinctUntilChanged()
    //   )
    //   .subscribe((lang) => {
    //     console.log('Language', lang);
    //   });
  }

  getJobProgress(): Observable<number> {
    return this.progress$;
  }

  getBackendStatusEvents(): Observable<BackendStatusEvent[]> {
    return this.statusLogs$;
  }

  getCommandPending(): Observable<string> {
    return this.pendingCommand$;
  }

  resetLog(): void {
    this.statusLog$.next({ status: CommandStatus.RESET_JOB_LOG, date: new Date() });
  }

  private initJobProgress() {
    this.subscriptionProgress = this.getJobProgressEvents().subscribe(
      (st: BackendCommandProgress) => {
        console.log('JobProgress:', st);
        this.progress$.next((100 * (st.progress + 1)) / st.total);
        if (st.status == 'error') {
          this.statusLog$.next({
            date: new Date(),
            message: `Running command ${st.job} failed at step: ${st.progress}`,
            status: CommandStatus.FAILURE
          });
          this.progress$.next(0);
        } else if (st.status == 'end-job') {
          this.alertService.success(`Successfully completed command ${st.job}`);
          this.statusLog$.next({
            date: new Date(),
            message: `Successfully completed command ${st.job}`,
            status: CommandStatus.SUCCESS
          });
          this.progress$.next(0);
        } else if (st.status == 'start-job') {
          this.progress$.next(0);
          this.statusLog$.next({
            date: new Date(),
            message: `Starting job ${st.job}`,
            status: CommandStatus.START_JOB
          });
        } else if (st.status == 'processing') {
          this.statusLog$.next({
            date: new Date(),
            message: `Processing job ${st.job}`,
            status: CommandStatus.PROCESSING
          });
        }
      }
    );
    this.statusLogs$ = this.statusLog$.pipe(
      // tap((i) => console.log('Items', i)),
      scan((acc, val) => {
        if (val.status == CommandStatus.RESET_JOB_LOG) {
          acc = [];
        }
        let sortedAcc = [val].concat(acc);
        sortedAcc = sortedAcc.slice(0, 14);
        return sortedAcc;
      }, [] as BackendStatusEvent[]),
      shareReplay(15)
    );
    this.subscriptionOutput = this.getJobOutput().subscribe((st: string) => {
      this.statusLog$.next({
        date: new Date(),
        message: `Processing job ${st}`,
        status: CommandStatus.PROCESSING
      });
    });

    this.pendingCommand$ = this.getJobProgressEvents().pipe(
      map((st) =>
        // console.log("CommandProgress:", st);
        st.status == 'error' || st.status == 'end-job' ? '' : st.job
      )
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

  updateEdgeConfiguration(ec: any) {
    this.edgeConfiguration = {
      ...this.edgeConfiguration,
      ...ec
    };
    console.log('Updated edgeConfiguration:', ec, this.edgeConfiguration);
  }

  getEdgeServiceStatus(): Promise<any> {
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
  getEdgeConfiguration(): Promise<any> {
    return this.http
      .get<any>(EDGE_CONFIGURATION_URL)
      .toPromise()
      .then((config) => {
        Object.keys(config).forEach((key) => {
          this.edgeConfiguration[key] = config[key];
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

  getAnalyticsConfiguration(): Promise<any> {
    return this.http
      .get<any>(ANALYTICS_CONFIGURATION_URL)
      .toPromise()
      .then((config) => {
        return config;
      })
      .catch(() => {
        console.log('Cannot reach backend!');
        this.alertService.warning('Cannot reach backend!');
      });
  }

  setAnalyticsConfiguration(config): Promise<any> {
    // console.log("Configuration to be stored:", config)
    return this.http
      .post<any>(ANALYTICS_CONFIGURATION_URL, config)
      .toPromise()
      .then((config) => {
        return config;
      });
  }

  downloadCertificate(t: string): Promise<any> {
    const promise = new Promise((resolve, reject) => {
      const apiURL = DOWNLOAD_CERTIFICATE_URL;
      const params = new HttpParams({
        fromObject: {
          deviceId: this.edgeConfiguration['device.id']
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

  getDetailsCloudDeviceFromTedge(sourceId: string): Promise<any> {
    console.log('Preparing Inventory call:', INVENTORY_BRIDGED_URL);
    return this.http
      .get<any>(INVENTORY_BRIDGED_URL)
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
      `?proxy=${this.edgeConfiguration['c8y.url']}`;
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

  initFetchClient() {
    const auth = new BasicAuth({
      user: this.edgeConfiguration.username,
      password: this.edgeConfiguration.password
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
    return `${url}?proxy=${this.edgeConfiguration['c8y.url']}`;
  }

  async uploadCertificate(): Promise<any> {
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
        name: this.edgeConfiguration['device.id']
      })
    };

    // console.log("Upload certificate:", certificate_url, cert)

    const uploadPromise: Promise<IFetchResponse> = this.fetchClient
      .fetch(certificate_url, options)
      .then((response) => {
        // console.log ("Resulting cmd:", response);
        return response;
      })
      .catch((err) => {
        console.log(`Could not upload certificate:${err.message}`);
        return err;
      });
    return uploadPromise;
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
