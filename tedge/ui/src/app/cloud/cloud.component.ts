import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import {
  AlertService,
  Column,
  ColumnDataType,
  DisplayOptions,
  Pagination,
  Row
} from '@c8y/ngx-components';
import { BehaviorSubject } from 'rxjs';
import { EdgeService } from '../share/edge.service';
import { properCase, unCamelCase } from '../share/format-helper';

@Component({
  selector: 'tedge-cloud',
  templateUrl: './cloud.component.html',
  styleUrls: ['./cloud.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class CloudComponent implements OnInit {
  constructor(
    private edgeService: EdgeService,
    private alertService: AlertService
  ) {}

  linkDeviceInDeviceManagement: string;
  columns: Column[] = [
    {
      header: 'Name',
      name: 'Name',
      path: 'name',
      filterable: true,
      cellCSSClassName: 'small-font-monospace'
    },
    {
      header: 'Value',
      name: 'value',
      sortable: true,
      filterable: true,
      path: 'value',
      dataType: ColumnDataType.TextShort,
      cellCSSClassName: 'small-font-monospace'
    }
  ];
  tedgeConfiguration: any = {};
  rows$: BehaviorSubject<Row[]> = new BehaviorSubject<Row[]>([]);
  pagination: Pagination = {
    pageSize: 30,
    currentPage: 1
  };

  displayOptions: DisplayOptions = {
    bordered: true,
    striped: true,
    filter: false,
    gridHeader: true
  };

  ngOnInit() {
    this.init();
    console.log('Initialized configuration:', this.tedgeConfiguration);
  }

  async init() {
    this.tedgeConfiguration = await this.edgeService.getTedgeConfiguration();
  }

  async getMainDeviceDetailsFromTedge() {
    try {
      const managedObject =
        await this.edgeService.getDetailsCloudDeviceFromTedge(
          this.tedgeConfiguration['device.id']
        );
      const rows: Row[] = [];
      // ignore those values that are object,because they look ugly when printed
      this.linkDeviceInDeviceManagement =
        await this.edgeService.getLinkToDeviceInDeviceManagement();
      Object.keys(managedObject)
        .filter((key) => typeof managedObject[key] != 'object')
        .forEach((key) => {
          rows.push({
            id: properCase(unCamelCase(key)),
            name: properCase(unCamelCase(key)),
            value: managedObject[key]
          });
        });
      this.rows$.next(rows);
      // console.log("Retrieved cloud data:", main)
    } catch (err) {
      this.alertService.danger(
        'Failed to retrieve details, device not yet registered!'
      );
    }
  }
}
