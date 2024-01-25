import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import {
  ActionControl,
  Column,
  ColumnDataType,
  DisplayOptions,
  Pagination
} from '@c8y/ngx-components';
import { Observable, from } from 'rxjs';
import { EdgeService } from '../../share/edge.service';
import { mergeMap, toArray } from 'rxjs/operators';

@Component({
  selector: 'tedge-configuration',
  templateUrl: './configuration.component.html',
  styleUrls: ['./configuration.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class ConfigurationComponent implements OnInit {
  columns: Column[];
  configuration: string;
  configurationRow$: Observable<any[]>;
  pagination: Pagination = {
    pageSize: 30,
    currentPage: 1
  };

  actionControls: ActionControl[];
  displayOptions: DisplayOptions = {
    bordered: true,
    striped: true,
    filter: false,
    gridHeader: true
  };
  constructor(private edgeService: EdgeService) {
    this.columns = this.getDefaultColumns();
  }
  ngOnInit() {
    this.configurationRow$ = from(
      this.edgeService.getTedgeConfiguration()
    ).pipe(
      mergeMap((resultObject) =>
        Object.entries(resultObject).map(([key, value]) => ({
          name: key,
          value
        }))
      ),
      toArray()
    );
  }

  getDefaultColumns(): Column[] {
    return [
      {
        name: 'name',
        header: 'Name',
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
