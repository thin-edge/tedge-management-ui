import { Component, OnInit } from '@angular/core';
import { EdgeService } from '../edge.service';
import { uuidCustom } from '../share/utils';
import { Observable, from } from 'rxjs';

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

  logFileRequest: any = {
    type: undefined,
    dateFrom: undefined,
    dateTo: undefined,
    searchText: undefined,
    lines: undefined
  };
  logFileTypes: any[] = ['Dummy1', 'mosquitto'];
  bsConfig = { containerClass: 'theme-orange', dateInputFormat: 'DD-MM-YYYY' };
  showMeridian = false;
  showSpinners = false;
  requestID: string;
  logUploadOutput$: Observable<any>;
  logFileTypes$: Observable<string[]>;

  ngOnInit() {
    this.logFileRequest.dateTo = new Date();
    this.logFileRequest.dateFrom = new Date();
    this.logFileRequest.dateFrom.setMinutes(
      this.logFileRequest.dateTo.getMinutes() - 5
    );
    this.init();
  }

  async init() {
    this.logUploadOutput$ = this.edgeService.getTedgeLogUploadOutput();
    this.logFileTypes$ = from(this.edgeService.getTedgeLogTypes());
  }

  async requestLogFile() {
    this.requestID = uuidCustom();
    this.logFileRequest.requestID = this.requestID;
    const response = await this.edgeService.requestTedgeLogfile(
      this.logFileRequest
    );
    console.log('Response:', response);
  }
}
