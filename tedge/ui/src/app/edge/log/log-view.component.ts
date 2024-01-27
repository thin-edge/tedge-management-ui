import { Component, OnInit } from '@angular/core';
import { EdgeService } from '../../share/edge.service';
import { uuidCustom } from '../../share/utils';
import { Observable, from } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Component({
  selector: 'tedge-log',
  templateUrl: './log-view.component.html',
  styleUrls: ['./log-view.component.scss']
})
export class LogViewComponent implements OnInit {
  constructor(private edgeService: EdgeService) {}
  //   tedge mqtt pub -r
  // 'te/device/main///cmd/log_upload/1234'
  // '{
  //   "status": "init",
  //   "tedgeUrl": "
  // http://127.0.0.1:8000/tedge/file-transfer/example/log_upload/mosquitto-1234"
  // ,
  //   "type": "mosquitto",
  //   "dateFrom": "2013-06-22T17:03:14.000+02:00",
  //   "dateTo": "2013-06-23T18:03:14.000+02:00",
  //   "searchText": "ERROR",
  //   "lines": 1000
  // }'

  bsConfig = { containerClass: 'theme-orange', dateInputFormat: 'DD-MM-YYYY' };
  showMeridian = false;
  showSpinners = false;
  requestID: string;
  logUploadRequest: any;
  logUploadResponse$: Observable<any>;
  logUploadResponse: any = {};
  logUploadResponseSuccess$: Observable<boolean>;
  logTypes$: Observable<string[]>;
  logTypes: any[] = ['Dummy1', 'mosquitto'];
  logContent: any;

  ngOnInit() {
    this.logUploadRequest = {
      status: 'init',
      type: undefined,
      dateFrom: new Date(),
      dateTo: new Date(),
      searchText: undefined,
      lines: 50
    };
    this.logUploadRequest.dateFrom.setMinutes(
      this.logUploadRequest.dateTo.getMinutes() - 5
    );
    this.init();
  }

  async init() {
    // "{\"status\":\"successful\",\"tedgeUrl\":\"http://127.0.0.1:8000/tedge/file-transfer/wednesday-I/log_upload/management-ui-uw2vvq\",\"type\":\"management-ui\",\"dateFrom\":\"2024-01-25T12:52:20.003Z\",\"dateTo\":\"2024-01-25T12:57:20.003Z\",\"lines\":1000,\"requestID\":\"uw2vvq\"}"
    this.logUploadResponse$ = this.edgeService.getTedgeLogUpload();
    this.logUploadResponseSuccess$ = this.logUploadResponse$.pipe(
      tap((response) => (this.logUploadResponse = response)),
      map((response) => response.status == 'successful')
    );
    // this.logFileResponse$.subscribe((response) => {
    //   this.logFileResponseSuccess$.next(response.status == 'successful');
    //   this.logFileResponse = response;
    // });
    this.logTypes$ = from(
      this.edgeService.getTedgeGenericConfigType('logTypes')
    );
    this.logTypes$.subscribe(
      (types) => (this.logUploadRequest.type = types[0] ?? undefined)
    );
  }

  async sendTedgeLogUploadRequest() {
    this.requestID = uuidCustom();
    this.logUploadRequest.requestID = this.requestID;
    const response = await this.edgeService.sendTedgeGenericCmdRequest({
      cmdType: 'log_upload',
      requestID: this.requestID,
      payload: this.logUploadRequest
    });
    console.log('Response:', response);
  }

  async getTedgeLogUploadResponse() {
    this.logContent = await this.edgeService.getTedgeGenericCmdResponse(
      this.logUploadResponse.tedgeUrl
    );
  }
}
