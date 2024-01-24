import { Component, OnInit } from '@angular/core';
import { EdgeService } from '../edge.service';

@Component({
  selector: 'tedge-log',
  templateUrl: './log-view.component.html',
  styleUrls: ['./log-view.component.scss']
})
export class LogViewComponent implements OnInit {
requestLogFile() {
throw new Error('Method not implemented.');
}
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

  logFileRequest: any = {};
  logFileTypes: any[] = ['Dummy1', 'Dummy2'];
  bsConfig = { containerClass: 'theme-orange', dateInputFormat: 'DD-MM-YYYY' };
  showMeridian = false;
  showSpinners = false;

  ngOnInit() {
      this.logFileRequest.dateTo = new Date();
      this.logFileRequest.dateFrom = new Date();
      this.logFileRequest.dateFrom.setMinutes(this.logFileRequest.dateTo.getMinutes() - 5);
    true;
  }

}
