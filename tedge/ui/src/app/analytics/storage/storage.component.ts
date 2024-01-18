import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import {
  AlertService,
  Column,
  ColumnDataType,
  DisplayOptions,
  Pagination,
  Row
} from '@c8y/ngx-components';
import { EdgeService } from '../../edge.service';
import { Observable, Subject } from 'rxjs';
import { properCase, unCamelCase } from '../../share/format-helper';

@Component({
  selector: 'tedge-storage',
  templateUrl: './storage.component.html',
  styleUrls: ['./storage.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class StorageComponent implements OnInit {
  constructor(
    private edgeService: EdgeService,
    private alertService: AlertService
  ) {
    this.columns = this.getDefaultColumns();
  }
  columns: Column[];
  indexes: any = {};
  rows$: Subject<Row[]> = new Subject<Row[]>();
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
  }

  async init() {
    try {
      const statistic = await this.edgeService.getStorageStatistic();
      const rows: Row[] = [];
      Object.keys(statistic)
        .filter((key) => typeof statistic[key] != 'object')
        .forEach((key) => {
          rows.push({
            id: properCase(unCamelCase(key)),
            name: properCase(unCamelCase(key)),
            value: statistic[key]
          });
        });
      this.rows$.next(rows);
    } catch (err) {
      this.alertService.danger('Failed to connect to storage!');
    }
    try {
      this.indexes = await this.edgeService.getStorageTTL();
    } catch (err) {
      this.alertService.danger('Failed to connect to storage!');
    }
  }

  getDefaultColumns(): Column[] {
    return [
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
  }
}
