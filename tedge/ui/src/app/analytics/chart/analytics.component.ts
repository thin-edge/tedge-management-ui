import { Component, EventEmitter, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EdgeService } from '../../edge.service';
import {
  AnalyticsConfiguration,
  TedgeMgmConfiguration
} from '../../property.model';
import {
  UnitList as DefinedTimeUnits,
  SpanList as DefinedTimeSpans,
  UNIT_MINUTE
} from './widget-helper';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'tedge-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.less']
})
export class AnalyticsComponent implements OnInit {
  showDialog: boolean = false;
  changeConfig: EventEmitter<any> = new EventEmitter();

  DefinedTimeUnits = DefinedTimeUnits;
  DefinedTimeSpans = DefinedTimeSpans;
  // parameter for widget
  analytics: AnalyticsConfiguration;
  displaySpanIndexBuffered: number = 0;
  dateFromBuffered: Date;
  dateToBuffered: Date;
  rangeUnitCountBuffered: number = 2; // defaults to 5 minutes
  rangeUnitBuffered: number = 1;
  updateFromBuffer$: Subject<any> = new Subject<any>();

  displaySpanIndex: number;
  dateFrom: Date;
  dateTo: Date;
  rangeUnitCount: number = 2; // 2
  rangeUnit: number = UNIT_MINUTE; // 2 minutes

  bsConfig = { containerClass: 'theme-orange', dateInputFormat: 'DD-MM-YYYY' };
  showMeridian = false;
  showSpinners = false;
  type: string;
  tedgeConfiguration: TedgeMgmConfiguration;

  constructor(
    private edgeService: EdgeService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initConfiguration();
  }

  private async initConfiguration() {
    this.updateFromBuffer$.pipe(debounceTime(1000)).subscribe(() => {
      this.displaySpanIndex = this.displaySpanIndexBuffered;
      this.dateFrom = this.dateFromBuffered;
      this.dateTo = this.dateToBuffered;
      this.rangeUnitCount = this.rangeUnitCountBuffered;
      this.rangeUnit = this.rangeUnitBuffered;
    });
    this.tedgeConfiguration = await this.edgeService.getTedgeMgmConfiguration();
    const { analytics } = this.tedgeConfiguration;
    this.analytics = analytics;
    console.log('Loaded analytics configuration: ', analytics, this.analytics);

    // this.router.url == "/analytics/realtime"
    const sp = this.router.url.split('/');
    this.type = sp[sp.length - 1];
    console.log('Chart type:', this.type);
    if (this.type == 'realtime') {
      this.displaySpanIndexBuffered = 0;
    } else {
      this.displaySpanIndexBuffered = 1;
    }

    this.dateToBuffered = new Date();
    this.dateFromBuffered = this.dateToBuffered;
    this.dateFromBuffered.setMinutes(this.dateFromBuffered.getMinutes() - 5);
    this.updateFromBuffer$.next();
  }

  async configurationChanged(analyticsChanged) {
    console.log('Configuration changed:', analyticsChanged);
    this.tedgeConfiguration.analytics = analyticsChanged;
    this.tedgeConfiguration = await this.edgeService.setTedgeMgmConfiguration(
      this.tedgeConfiguration
    );
    const { analytics } = this.tedgeConfiguration;
    this.analytics = analytics;
    console.log('Configuration was saved:', this.tedgeConfiguration);
    this.showDialog = false;
  }

  updateChartConfig(v) {
    // console.log('Chart config changed :', v);
    this.updateFromBuffer$.next(v);
  }
}
