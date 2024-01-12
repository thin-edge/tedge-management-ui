import { Component, EventEmitter, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EdgeService } from '../../edge.service';
import { RawListItem, SpanListItem } from '../../property.model';
import { unitList, spanList } from './widget-helper';

@Component({
  selector: 'tedge-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.less']
})
export class AnalyticsComponent implements OnInit {
  public showDialog: boolean = false;
  public onChangeConfig: EventEmitter<any> = new EventEmitter();

  unitList: RawListItem[] = unitList;
  spanList: SpanListItem[] = spanList;
  config: any = {
    diagramName: 'Analytics',
    selectedMeasurements: []
  };
  rangeUnit: number = 1;
  rangeUnitCount: number = 2; // defaults to 5 minutes
  displaySpanIndex: number = 0;
  dateFrom: Date;
  dateTo: Date;
  bsConfig = { containerClass: 'theme-orange', dateInputFormat: 'DD-MM-YYYY' };
  showMeridian = false;
  showSpinners = false;
  type: string;

  constructor(
    private edgeService: EdgeService,
    private router: Router
  ) {}

  async ngOnInit() {
    const configuration = await this.edgeService.getAnalyticsConfiguration();
    console.log('Loaded configuration :', configuration);
    this.config = {
      ...this.config,
      ...configuration
    };

    // this.router.url == "/analytics/realtime"
    const sp = this.router.url.split('/');
    this.type = sp[sp.length - 1];
    console.log('Chart type:', this.type);
    if (this.type == 'realtime') {
      this.displaySpanIndex = 0;
    } else {
      this.displaySpanIndex = 1;
    }

    this.dateTo = new Date();
    this.dateFrom = new Date();
    this.dateFrom.setMinutes(this.dateFrom.getMinutes() - 5);
  }

  configurationChanged(event) {
    console.log('Configuration changed:', event);
    this.edgeService.setAnalyticsConfiguration(event).then((c) => {
      this.config = c;
      console.log('Configuration was saved:', c);
    });
    this.showDialog = false;
  }

  updateFrom() {
    console.log('Date from:', this.dateFrom);
  }
  updateTo() {
    console.log('Date to:', this.dateTo);
  }

  updateRangeUnitCount(event) {
    console.log('RangeUnitCount:', event.target.value);
    this.rangeUnitCount = event.target.value;
  }
}
