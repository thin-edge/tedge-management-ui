import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { AlertService } from '@c8y/ngx-components';
import { EdgeService } from '../../share/edge.service';

@Component({
  selector: 'tedge-device',
  templateUrl: './device.component.html',
  styleUrls: ['./device.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class DeviceComponent implements OnInit {
  constructor(
    private edgeService: EdgeService,
    private alertService: AlertService
  ) {}
  statistic: any = {};

  ngOnInit() {
    this.init();
  }

  async init() {
    try {
      this.statistic = await this.edgeService.getDeviceStatistic();
    } catch (err) {
      this.alertService.danger('Failed to get statistic information!');
    }
  }

  getDeviceStatistic() {
    this.statistic = this.edgeService.getDeviceStatistic();
  }
}
