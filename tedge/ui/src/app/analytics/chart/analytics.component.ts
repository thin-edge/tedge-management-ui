import { Component, EventEmitter, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import {
    AnalyticsConfiguration,
    BackendConfiguration, BackendService
} from '../../share';
import {
    SpanList as DefinedTimeSpans,
    UnitList as DefinedTimeUnits,
    SPAN,
    UNIT
} from './widget-helper';

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
  UNIT = UNIT;
  SPAN = SPAN;
  // parameter for widget
  analytics: AnalyticsConfiguration;
  displaySpanIndexBuffered: SPAN = SPAN.REALTIME;
  dateFromBuffered: Date;
  dateToBuffered: Date;
  rangeUnitCountBuffered: number = 2; // defaults to 5 minutes
  rangeUnitBuffered: number = 1;
  updateFromBuffer$: Subject<any> = new Subject<any>();

  displaySpanIndex: SPAN;
  dateFrom: Date;
  dateTo: Date;
  rangeUnitCount: number = 2; // 2
  rangeUnit: number = UNIT.MINUTE; // 2 minutes

  bsConfig = { containerClass: 'theme-orange', dateInputFormat: 'DD-MM-YYYY' };
  showMeridian = false;
  showSpinners = false;
  type: string;
  tedgeConfiguration: BackendConfiguration;
  title = 'Chart - Realtime';

  constructor(
    private edgeService: BackendService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initConfiguration();
  }

  private async initConfiguration() {
    this.updateFromBuffer$.pipe(debounceTime(500)).subscribe(() => {
      this.displaySpanIndex = this.displaySpanIndexBuffered;
      this.dateFrom = this.dateFromBuffered;
      this.dateTo = this.dateToBuffered;
      this.rangeUnitCount = this.rangeUnitCountBuffered;
      this.rangeUnit = this.rangeUnitBuffered;
    });
    this.tedgeConfiguration = await this.edgeService.getBackendConfiguration();
    const { analytics } = this.tedgeConfiguration;
    this.analytics = analytics;
    console.log('Loaded analytics configuration: ', analytics, this.analytics);

    // this.router.url == "/analytics/realtime"
    const sp = this.router.url.split('/');
    this.type = sp[sp.length - 1];
    console.log('Chart type:', this.type);
    if (this.type == 'realtime') {
      this.displaySpanIndexBuffered = SPAN.REALTIME;
      this.title = 'Chart - Realtime';
    } else {
      this.displaySpanIndexBuffered = SPAN.LAST_5_MINUTES;
      this.title = 'Chart - Historic';
    }
    this.dateToBuffered = new Date();
    this.dateFromBuffered = new Date();
    this.dateFromBuffered.setMinutes(this.dateToBuffered.getMinutes() - 5);
    this.updateFromBuffer$.next('');
  }

  async configurationChanged(analyticsChanged) {
    console.log('Configuration changed:', analyticsChanged);
    this.tedgeConfiguration.analytics = analyticsChanged;
    this.tedgeConfiguration = await this.edgeService.setBackendConfiguration(
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
