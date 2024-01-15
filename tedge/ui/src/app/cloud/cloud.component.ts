import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  ActionControl,
  AlertService,
  Column,
  ColumnDataType,
  DisplayOptions,
  Pagination,
  Row
} from '@c8y/ngx-components';
import { Observable } from 'rxjs';
import { EdgeService } from '../edge.service';
import { properCase, unCamelCase } from './cloud-helper';

@Component({
  selector: 'tedge-cloud',
  templateUrl: './cloud.component.html',
  styleUrls: ['./cloud.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class CloudComponent implements OnInit {
  constructor(
    private formBuilder: FormBuilder,
    private edgeService: EdgeService,
    private alertService: AlertService
  ) {
    this.columns = this.getDefaultColumns();
  }

  linkDeviceInDeviceManagment: string;
  columns: Column[];
  loginForm: FormGroup;
  tedgeConfiguration: any = {};
  rows$: Observable<Row[]>;
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

  actionControls: ActionControl[] = [];

  ngOnInit() {
    this.init();
    console.log('Initialized configuration:', this.tedgeConfiguration);
  }

  async init() {
    this.tedgeConfiguration = await this.edgeService.getTedgeConfiguration();
  }

  async getMainDeviceDetailsFromTedge() {
    try {
      const managedObject = await this.edgeService.getDetailsCloudDeviceFromTedge(
        this.tedgeConfiguration.deviceId
      );
      const rows: Row[] = [];
      // ignore those values that are object,because they look ugly when printed
      this.linkDeviceInDeviceManagment = `https://${this.tedgeConfiguration['c8y.http']}/apps/devicemanagement/index.html#/device/${managedObject.id}`;
      Object.keys(managedObject)
        .filter((key) => typeof managedObject[key] != 'object')
        .forEach((key) => {
          rows.push({
            id: properCase(unCamelCase(key)),
            name: properCase(unCamelCase(key)),
            value: managedObject[key]
          });
        });
      this.rows$ = new Observable<Row[]>((observer) => {
        observer.next(rows);
        observer.complete();
      });
      // console.log("Retrieved cloud data:", main)
    } catch (err) {
      this.alertService.danger(
        'Failed to retrieve details, device not yet registered!'
      );
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
