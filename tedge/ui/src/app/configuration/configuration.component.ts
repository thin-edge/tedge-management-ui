import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import {
  ActionControl,
  Column,
  ColumnDataType,
  DisplayOptions,
  Pagination
} from '@c8y/ngx-components';
import { Observable, from } from 'rxjs';
import { EdgeService } from '../edge.service';
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
    this.configurationRow$ = from(this.edgeService.getTedgeConfiguration()).pipe(
      mergeMap((resultObject) =>
        Object.entries(resultObject).map(([key, value]) => ({
          key,
          name: value,
          value
        }))
      ),
      toArray()
    );
    // this.edgeService.getEdgeConfiguration().then((data) => {
    //   console.log("Result configuration", data);
    //   let confRow: Row[] = [];
    //   Object.keys(data).forEach((key) => {
    //     //console.log ("Row configuration", key, unCamelCase(key), unCamelCase(key), data[key] )
    //     confRow.push({
    //       id: key,
    //       name: key,
    //       value: data[key],
    //     });
    //   });
    //   //console.log ("Result configuration", rows )
    //   this.configurationRow$ = new Observable<Row[]>((observer) => {
    //     observer.next(confRow);
    //     observer.complete();
    //   });
    // });
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
