import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { EdgeService } from '../../share/edge.service';
import { BackendConfiguration, TedgeStatus } from '../../share/property.model';

@Component({
  selector: 'tedge-control',
  templateUrl: './control.component.html',
  styleUrls: ['./control.component.scss']
})
export class ControlComponent implements OnInit {
  BackendConfiguration: BackendConfiguration;
  tedgeStatus$: Observable<TedgeStatus>;
  TedgeStatus = TedgeStatus;

  constructor(private edgeService: EdgeService) {}

  ngOnInit() {
    this.init();
  }

  async init() {
    this.BackendConfiguration =
      await this.edgeService.getBackendConfiguration();
    this.tedgeStatus$ = this.edgeService.getTedgeStatus();
  }

  resetLog() {
    this.edgeService.resetLog();
  }

  async startEdge() {
    this.edgeService.startTedge();
  }

  async stopEdge() {
    this.edgeService.stopTedge();
  }

}
