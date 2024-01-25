import { Component, OnInit } from '@angular/core';
import { EdgeService } from '../../share/edge.service';
import { uuidCustom } from '../../share/utils';
import { BehaviorSubject, Observable, Subject, from } from 'rxjs';

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

  logFileRequest: any;
  logFileRsponse: any = {};
  logFileTypes: any[] = ['Dummy1', 'mosquitto'];
  bsConfig = { containerClass: 'theme-orange', dateInputFormat: 'DD-MM-YYYY' };
  showMeridian = false;
  showSpinners = false;
  requestID: string;
  logFileResponse$: Observable<any>;
  logFileResponse: any;
  logFileResponseSuccess$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  logFileTypes$: Observable<string[]>;
  logContent: any;

  ngOnInit() {
    this.logFileRequest = {
      status: 'init',
      type: undefined,
      dateFrom: new Date(),
      dateTo: new Date(),
      searchText: undefined,
      lines: 50
    };
    this.logFileRequest.dateFrom.setMinutes(
      this.logFileRequest.dateTo.getMinutes() - 5
    );
    this.init();
  }

  async init() {
    // "{\"status\":\"successful\",\"tedgeUrl\":\"http://127.0.0.1:8000/tedge/file-transfer/wednesday-I/log_upload/management-ui-uw2vvq\",\"type\":\"management-ui\",\"dateFrom\":\"2024-01-25T12:52:20.003Z\",\"dateTo\":\"2024-01-25T12:57:20.003Z\",\"lines\":1000,\"requestID\":\"uw2vvq\"}"
    this.logFileResponse$ = this.edgeService.getTedgeLogUploadOutput();
    this.logFileResponse$.subscribe((response) => {
      this.logFileResponseSuccess$.next(response.status == 'successful');
      this.logFileResponse = response;
    });
    this.logFileTypes$ = from(this.edgeService.getTedgeLogTypes());
    this.logFileTypes$.subscribe(
      (types) => (this.logFileRequest.type = types[0] ?? undefined)
    );
  }

  async requestTedgeLogfile() {
    this.requestID = uuidCustom();
    this.logFileRequest.requestID = this.requestID;
    const response = await this.edgeService.requestTedgeLogfile(
      this.logFileRequest
    );
    console.log('Response:', response);
  }

  async getTedgeLogfile() {
    this.logContent = await this.edgeService.getTedgeLogfile(
      this.logFileResponse.tedgeUrl
    );
  }
}
