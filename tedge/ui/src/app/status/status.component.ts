import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import {
  Column,
  ColumnDataType,
  DisplayOptions,
  Pagination,
} from '@c8y/ngx-components';
import { EdgeService } from '../edge.service';

@Component({
  selector: 'tedge-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class StatusComponent implements OnInit {
  container: HTMLElement;
  serviceStatus: string;
  services: any[];
  //   actionControls: ActionControl[] = [
  //     {
  //       type: 'Stop',
  //       icon: 'stop',
  //       callback: (item) => this.onItemStop(item),
  //       showIf: (item) => {
  //         console.log ('DDDDDD', item);
  //         return item.status == 'started';
  //     }
  //     },
  //     {
  //       type: 'Start',
  //       icon: 'play-arrow',
  //       callback: (item) => this.onItemStart(item),
  //       showIf: (item) => item.status != 'started'
  //     },
  //     {
  //       type: 'Restart',
  //       icon: 'refresh',
  //       callback: (item) => this.onItemRestart(item),
  //       showIf: (item) => item.status != 'started'
  //     }
  //   ];
  displayOptions: DisplayOptions = {
    bordered: true,
    striped: true,
    filter: false,
    gridHeader: true
  };
  pagination: Pagination = {
    pageSize: 30,
    currentPage: 1
  };
  columns: Column[] = [
    {
      name: 'service',
      header: 'Service',
      path: 'service',
      filterable: true,
      cellCSSClassName: 'small-font-monospace'
    },
    {
      header: 'Status',
      name: 'status',
      sortable: true,
      filterable: true,
      path: 'status',
      dataType: ColumnDataType.TextShort,
      cellCSSClassName: 'small-font-monospace'
    }
  ];

  constructor(private edgeService: EdgeService) {}
  ngOnInit() {
    this.edgeService.getTedgeServiceStatus().then((data) => {
      this.serviceStatus = data.result;
      this.parseServices(data.result);
    });
  }
  parseServices(result: string) {
    const pattern = /^\s*(\S+)\s+\[\s*([^\]\s]+)\s*\]/gm;
    this.services = [];
    let match;

    while ((match = pattern.exec(result)) !== null) {
      const [, service, status] = match;
      const color =
        status == 'started' ? 'green' : status == 'stopped' ? 'red' : 'orange';
      this.services.push({ id: service, service, status, color });
    }
    console.log(this.services);
  }
  onItemRestart(index: number): void {
    this.edgeService.serviceCommand(this.services[index].service, 'restart');
  }
  onItemStart(index: number): void {
    this.edgeService.serviceCommand(this.services[index].service, 'start');
  }
  onItemStop(index: number): void {
    this.edgeService.serviceCommand(this.services[index].service, 'stop');
  }
}
