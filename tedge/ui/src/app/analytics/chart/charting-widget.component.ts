import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { Chart, ChartOptions, ChartConfiguration } from 'chart.js';
import 'chartjs-adapter-luxon';
import StreamingPlugin from '@robloche/chartjs-plugin-streaming';
import { Observable, Subscription } from 'rxjs';
import { EdgeService } from '../../edge.service';
import { AnalyticsConfiguration, RawMeasurement } from '../../property.model';
import {
  flatten,
  generateNextColor,
  UnitList,
  SpanList,
  SPAN
} from './widget-helper';
import { Router } from '@angular/router';
import { isSerieSelected } from '../../share/utils';

Chart.register(StreamingPlugin);

@Component({
  selector: 'tedge-charting-widget',
  templateUrl: './charting-widget.component.html',
  styleUrls: ['./charting-widget.component.css']
})
export class ChartingWidgetComponent
  implements OnDestroy, OnInit, OnChanges, AfterViewInit
{
  constructor(
    private edgeService: EdgeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // this.router.url == "/analytics/realtime"
    const sp = this.router.url.split('/');
    this.type = sp[sp.length - 1];
  }

  @ViewChild('analytic') private lineChartCanvas: ElementRef;

  @Input() analytics: AnalyticsConfiguration;
  @Input() displaySpanIndex = 0; // default of diagram is always realtime
  @Input() dateFrom: Date;
  @Input() dateTo: Date;
  @Input() rangeUnitCount: number;
  @Input() rangeUnit: number;
  type: string;

  subscriptionMongoMeasurement: Subscription;
  measurements$: Observable<RawMeasurement>;
  chartDataPointList: { [name: string]: number } = { index: 0 };
  lineChart: Chart;
  pauseTime: number;

  x_realtime: any = {
    type: 'realtime',
    realtime: {
      delay: 2000,
      duration: 300000 // 5 minutes
    }
  };

  x_fixed: any = {
    type: 'time',
    time: {
      unit: 'minute'
    }
  };

  chartHistoricOptions: ChartOptions = {
    scales: {
      x: this.x_fixed,
      y: {}
    }
  };

  chartHistoricConfiguration: ChartConfiguration = {
    type: 'line',
    data: {
      datasets: []
    },
    options: this.chartHistoricOptions
  };

  chartRealtimeOptions: ChartOptions = {
    scales: {
      x: this.x_realtime,
      y: {}
    }
  };

  chartRealtimeConfiguration: ChartConfiguration = {
    type: 'line',
    data: {
      datasets: []
    },
    options: this.chartRealtimeOptions
  };

  ngAfterViewInit(): void {
    console.log(this.router.url); //  /routename
    if (this.lineChartCanvas && this.type == 'realtime') {
      this.lineChart = new Chart(
        this.lineChartCanvas.nativeElement,
        this.chartRealtimeConfiguration
      );
      this.displaySpanIndex = 0;
      console.log('ChartRealtime initialized!');
    }
    if (this.lineChartCanvas && this.type == 'historic') {
      this.lineChart = new Chart(
        this.lineChartCanvas.nativeElement,
        this.chartHistoricConfiguration
      );
      this.displaySpanIndex = 1;
      console.log('ChartHistoric initialized!');
    }
  }

  startRealtime() {
    // console.log("Realtime started!")
    this.measurements$ = this.edgeService.getRealtimeMeasurements();
    this.subscriptionMongoMeasurement = this.measurements$.subscribe(
      (m: RawMeasurement) => {
        // console.log("New Mongo Measurement", m)
        this.pushEventToCharData(m, this.lineChart);
        this.updateChart(this.lineChart);
      }
    );
  }

  private pushEventToCharData(event: RawMeasurement, chart: Chart): void {
    // test for event with payload
    if (event && event.payload) {
      const flat = flatten(event.payload);
      // console.log("Log initial ", flat, event);
      for (const key in flat) {
        if (
          isSerieSelected(
            event.device,
            event.type,
            key.replace('.', '__'),
            this.analytics?.selectedMeasurements
          )
        ) {
          // console.log("Testing key", this.chartDataPointList[key], key);
          // test if key is already in chartDataPoint
          // add new series
          if (this.chartDataPointList[key] === undefined) {
            const nextColor = generateNextColor(this.chartDataPointList.index);
            chart.data.datasets.push({
              label: `${event.device} - ${key}`,
              // backgroundColor: 'rgba(255, 99, 132, 0.5)',
              borderColor: nextColor,
              borderDash: [8, 4],
              fill: this.analytics.fillCurve,
              data: []
            });
            this.chartDataPointList[key] = this.chartDataPointList.index;
            //   console.log(
            //     "Adding key",
            //     this.chartDataPointList[key],
            //     key,
            //     chart.data.datasets
            //   );
            ++this.chartDataPointList.index;
          }
          const p = {
            x: event.datetime,
            // x: event.timestamp,
            y: flat[key]
          } as any;
          // console.log("New DataPoint", event, p, this.chartDataPointList[key] );
          chart.data.datasets[this.chartDataPointList[key]].data.push(p);
          // } else {
          // console.log("Ignore key", this.chartDataPointList[key], key);
          // }
        }
      }
    }
  }

  private resetChart(chart: Chart, options: ChartOptions) {
    if (chart) {
      this.chartDataPointList = { index: 0 };
      chart.data.datasets = [];
      chart.data.labels = [];
      chart.options = options;
    }
  }

  private updateChart(chart: Chart) {
    if (chart) {
      console.log('UpdateChart called!');
      chart.update();
    }
  }

  private stopRealtime() {
    // console.log("Realtime stopped!")
    if (this.subscriptionMongoMeasurement)
      this.subscriptionMongoMeasurement.unsubscribe();
    this.edgeService.stopMeasurements();
  }

  ngOnChanges(changes: SimpleChanges) {
    let updateChartRequired = false;
    for (const propName in changes) {
      updateChartRequired = true;
      const changedProp = changes[propName];
      if (propName == 'analytics' && changedProp.currentValue) {
        // console.log(
        //   'Changed property',
        //   changedProp,
        //   propName,
        //   parseInt(changedProp.currentValue.rangeLow)
        // );
        if (parseInt(changedProp.currentValue.rangeLow)) {
          this.chartRealtimeOptions.scales.y.min = parseInt(
            changedProp.currentValue.rangeLow
          );
          this.chartHistoricOptions.scales.y.min = parseInt(
            changedProp.currentValue.rangeLow
          );
        }
        if (parseInt(changedProp.currentValue.rangeHigh)) {
          this.chartRealtimeOptions.scales.y.max = parseInt(
            changedProp.currentValue.rangeHigh
          );
          this.chartHistoricOptions.scales.y.max = parseInt(
            changedProp.currentValue.rangeHigh
          );
        }
        // console.log("Now can change config", changedProp.currentValue.rangeLow, changedProp.currentValue.rangeHigh)
      } else if (propName == 'rangeUnitCount') {
        this.rangeUnitCount = parseInt(changedProp.currentValue);
        // console.log('Changed rangeUnitCount', this.rangeUnitCount);
        this.x_realtime.realtime.duration =
          UnitList[this.rangeUnit].id * this.rangeUnitCount * 1000;
        this.chartRealtimeConfiguration.options.scales.x['realtime'].duration =
          UnitList[this.rangeUnit].id * this.rangeUnitCount * 1000;
      } else if (propName == 'rangeUnit') {
        this.rangeUnit = parseInt(changedProp.currentValue);
        // console.log('Changed rangeUnit', this.rangeUnit);
        this.x_realtime.realtime.duration =
          UnitList[this.rangeUnit].id * this.rangeUnitCount * 1000;
        this.chartRealtimeConfiguration.options.scales.x['realtime'].duration =
          UnitList[this.rangeUnit].id * this.rangeUnitCount * 1000;
      } else if (propName == 'displaySpanIndex') {
        this.displaySpanIndex = Number.isNaN(parseInt(changedProp.currentValue))
          ? SPAN.REALTIME
          : parseInt(changedProp.currentValue);
        // console.log(
        //   'Changed displaySpanIndex',
        //   this.displaySpanIndex,
        //   spanList[this.displaySpanIndex].displayUnit
        // );
      } else if (propName == 'dateFrom') {
        this.dateFrom = changedProp.currentValue;
        // console.log('Changed dateFrom', this.dateFrom);
        // only update if to range is set
      } else if (propName == 'dateTo') {
        this.dateTo = changedProp.currentValue;
        // console.log('Changed dateTo', this.dateTo);
      } else if (propName == 'activeRealtime') {
        // console.log('Changed activeRealtime', changedProp.currentValue);
        // this.modifyChartRealtime(changedProp.currentValue);
      }
    }
    if (updateChartRequired) this.updateDisplayMode();
  }
  public async updateDisplayMode() {
    console.log('UpdateDisplayMode called:', this.displaySpanIndex);
    this.stopRealtime();
    if (this.displaySpanIndex == SPAN.REALTIME) {
      // realtime data is displayed
      console.log(
        'UpdateDisplayMode == 0:',
        this.displaySpanIndex,
        SpanList[this.displaySpanIndex]
      );
      this.resetChart(this.lineChart, this.chartRealtimeOptions);
      this.startRealtime();
      this.updateChart(this.lineChart);
    } else {
      // if historical data to be displayed
      console.log(
        'UpdateDisplayMode <> 0:',
        this.displaySpanIndex,
        SpanList[this.displaySpanIndex]
      );
      // this.x_fixed.time.unit = spanList[this.displaySpanIndex].displayUnit
      // this.resetChart(this.lineChartHistoric);
      this.resetChart(this.lineChart, this.chartHistoricOptions);
      let ob: any[];
      if (this.displaySpanIndex == SPAN.CUSTOM) {
        // if historical data is an interval
        ob = await this.edgeService.getMeasurements(this.dateFrom, this.dateTo);
      } else {
        ob = await this.edgeService.getLastMeasurements(
          SpanList[this.displaySpanIndex].spanInSeconds
        );
      }
      ob.forEach((m) => this.pushEventToCharData(m, this.lineChart));
      // log size
      // this.lineChart.data.datasets.forEach(ds => {
      //   console.log("Dataset: (name,size):", ds.label, ds.data.length);
      // })
      this.updateChart(this.lineChart);
    }
  }

  ngOnDestroy() {
    this.stopRealtime();
    console.log('Destroy called.');
    this.lineChart.destroy();
  }
}
