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
  pendingCommand$: Observable<string>;
  TedgeStatus = TedgeStatus;

  constructor(
    private edgeService: EdgeService,
  ) {}

  ngOnInit() {
    this.init();
    this.pendingCommand$ = this.edgeService.getCommandPending();
  }

  async init() {
    this.tedgeMgmConfiguration =
      await this.edgeService.getTedgeMgmConfiguration();
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
