import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { EdgeService } from '../edge.service';
import { TedgeMgmConfiguration, TedgeStatus } from '../property.model';

@Component({
  selector: 'tedge-control',
  templateUrl: './control.component.html',
  styleUrls: ['./control.component.scss']
})
export class ControlComponent implements OnInit {
  tedgeMgmConfiguration: TedgeMgmConfiguration;
  tedgeStatus$: Observable<TedgeStatus>;
  TedgeStatus = TedgeStatus;

  constructor(private edgeService: EdgeService) {}

  ngOnInit() {
    this.init();
  }

  async init() {
    this.tedgeMgmConfiguration =
      await this.edgeService.getTedgeMgmConfiguration();
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

  async restartPlugins() {
    this.edgeService.restartPlugins();
  }
}
