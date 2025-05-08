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
import { BackendService, TTL_INDEX_NAME, properCase, unCamelCase } from '../../share';

@Component({
  selector: 'tedge-storage',
  templateUrl: './storage.component.html',
  styleUrls: ['./storage.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class StorageComponent implements OnInit {
  constructor(
    private edgeService: BackendService,
    private alertService: AlertService
  ) {}
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
  indexes: any = {};
  ttl: number;
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
  }

  async init() {
    try {
      this.indexes = await this.edgeService.getStorageIndexes();
      const ttlIndexes = this.indexes.filter(
        (index) => index.name == TTL_INDEX_NAME
      );
      console.log('Found TTL:', ttlIndexes[0]['expireAfterSeconds']);
      this.ttl = ttlIndexes[0]['expireAfterSeconds'];
    } catch (err) {
      this.alertService.danger(
        `Failed to get information on index ${TTL_INDEX_NAME} !`
      );
    }
  }

  async getStorageStatistic() {
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
  }

  updateStorageTTL() {
    this.edgeService.updateStorageTTL(this.ttl);
  }
}
