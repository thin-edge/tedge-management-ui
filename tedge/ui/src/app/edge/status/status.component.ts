import { Component, OnInit, ViewEncapsulation } from '@angular/core';

import { EdgeService } from '../../share/edge.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'tedge-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class StatusComponent implements OnInit {
  container: HTMLElement;
  serviceStatus: string;
  services$: Observable<any[]> = new Observable<any[]>();
  servicesRefresh$: BehaviorSubject<any> = new BehaviorSubject<any>('');

  constructor(private edgeService: EdgeService) {
    this.services$ = this.servicesRefresh$.pipe(
      switchMap(() => this.edgeService.getTedgeServiceStatus()),
      tap( () => this.edgeService.requestTedgeServiceStatus()),
      map((result) => {
        const statusRaw = result.result;
        this.serviceStatus = statusRaw;
        const pattern = /^\s*(\S+)\s+\[\s*(\w+).*\]/gm;
        const services = [];
        let match;
        while ((match = pattern.exec(statusRaw)) !== null) {
          const [ , service, status] = match;
          // console.log('Service', first, service);
          const color =
            status == 'started'
              ? 'green'
              : status == 'stopped'
                ? 'red'
                : 'orange';
          services.push({ id: service, service, status, color });
        }
        return services;
      })
    );
    this.edgeService.responseTedgeServiceStatus().subscribe (output => console.log('GGGGGGGG', output));
  }

  ngOnInit() {
    this.servicesRefresh$.next('');
  }

  async refresh() {
    this.servicesRefresh$.next('');
    // this.serviceStatus = (await this.edgeService.getTedgeServiceStatus()).result;
    // this.services$.next(this.parseServiceStatus(this.serviceStatus));
  }

  parseServiceStatus(statusRaw: string): any[] {
    const pattern = /^\s*(\S+)\s+\[\s*(\w+).*\]/gm;
    // const pattern = /^\s*(\S+)/gm;
    const services = [];
    let match;
    while ((match = pattern.exec(statusRaw)) !== null) {
      const [first, service, status] = match;
      console.log('Service', first, service);
      const color =
        status == 'started' ? 'green' : status == 'stopped' ? 'red' : 'orange';
      services.push({ id: service, service, status, color });
    }
    return services;
  }

  onServiceRestart(service: string): void {
    this.edgeService.serviceCommand(service, 'restart');
    this.servicesRefresh$.next('');
  }
  onServiceStart(service: string): void {
    this.edgeService.serviceCommand(service, 'start');
    this.servicesRefresh$.next('');
  }
  onServiceStop(service: string): void {
    this.edgeService.serviceCommand(service, 'stop');
    this.servicesRefresh$.next('');
  }

  async startEdge() {
    this.edgeService.startTedge();
  }

  async stopEdge() {
    this.edgeService.stopTedge();
  }

  resetLog() {
    this.edgeService.resetLog();
  }
}
