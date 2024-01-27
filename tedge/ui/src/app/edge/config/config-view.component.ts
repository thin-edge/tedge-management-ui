import { Component, OnInit } from '@angular/core';
import { EdgeService } from '../../share/edge.service';
import { uuidCustom } from '../../share/utils';
import { BehaviorSubject, Observable, from, merge } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Component({
  selector: 'tedge-config',
  templateUrl: './config-view.component.html',
  styleUrls: ['./config-view.component.scss']
})
export class ConfigViewComponent implements OnInit {
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

  requestID: string;
  configSnapshotRequest: any;
  configSnapshotResponse: any = {};
  configUpdateRequest: any;
  configReviewArtion$: BehaviorSubject<any> = new BehaviorSubject<any>({
    status: 'init',
    type: undefined
  });
  configReviewCycle$: Observable<any>;
  configTypes$: Observable<string[]>;
  configTypes: any[] = ['Dummy1', 'mosquitto'];
  configContent: any;

  ngOnInit() {
    this.configSnapshotRequest = {
      status: 'init',
      type: undefined
    };
    this.configUpdateRequest = {
      status: 'init',
      type: undefined
    };
    this.init();
  }

  async init() {
    // "{\"status\":\"successful\",\"tedgeUrl\":\"http://127.0.0.1:8000/tedge/file-transfer/wednesday-I/log_upload/management-ui-uw2vvq\",\"type\":\"management-ui\",\"dateFrom\":\"2024-01-25T12:52:20.003Z\",\"dateTo\":\"2024-01-25T12:57:20.003Z\",\"lines\":1000,\"requestID\":\"uw2vvq\"}"
    this.configTypes$ = from(
      this.edgeService.getTedgeGenericConfigType('configTypes')
    );
    this.configTypes$.subscribe(
      (types) => (this.configSnapshotRequest.type = types[0] ?? undefined)
    );

    this.configReviewCycle$ = merge(
      this.edgeService.getTedgeConfigSnapshotResponse(),
      this.edgeService.getTedgeConfigUpdateResponse(),
      this.configReviewArtion$
    ).pipe(
      tap((response) => (this.configSnapshotResponse = response)),
      map((response) => response.status)
    );
  }

  async sendTedgeConfigSnapshotRequest() {
    this.requestID = uuidCustom();
    this.configContent = '';
    const response = await this.edgeService.sendTedgeGenericCmdRequest({
      cmdType: 'config_snapshot',
      requestID: this.requestID,
      payload: this.configSnapshotRequest
    });
    console.log('Response:', response);
  }

  async sendTedgeConfigUpdateRequest() {
    this.requestID = uuidCustom();
    this.configUpdateRequest.configContent = this.configContent;
    this.configUpdateRequest.type = this.configSnapshotRequest.type;
    const response = await this.edgeService.sendTedgeGenericCmdRequest({
      cmdType: 'config_update',
      requestID: this.requestID,
      payload: this.configUpdateRequest
    });
    console.log('Response:', response);
  }

  async getTedgeLogUploadResponse() {
    this.configContent = await this.edgeService.getTedgeGenericCmdResponse(
      this.configSnapshotResponse.tedgeUrl
    );
    this.configReviewArtion$.next({
      status: 'change'
    });
  }
}
