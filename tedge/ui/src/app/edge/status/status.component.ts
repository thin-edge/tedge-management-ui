import { Component, OnInit, ViewEncapsulation } from '@angular/core';

import { BackendService } from '../../share/backend.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'tedge-status',
  templateUrl: './status.component.html',
  styleUrls: ['./status.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class StatusComponent implements OnInit {
  container: HTMLElement;
  services$: Observable<any[]> = new Observable<any[]>();
  servicesRefresh$: BehaviorSubject<any> = new BehaviorSubject<any>('');

  constructor(private edgeService: BackendService) {
    this.services$ = this.edgeService.responseTedgeServiceStatus().pipe(
      map((output) => {
        let services = [];
        try {
          services = JSON.parse(output.output);
        } catch (error) {
            console.error('No valid serviceStatus returned!');
        }
        return services;
      })
    );
    this.servicesRefresh$.subscribe(() =>
      this.edgeService.requestTedgeServiceStatus()
    );
  }

  ngOnInit() {
    this.servicesRefresh$.next('');
  }

  async refresh() {
    this.servicesRefresh$.next('');
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
  }
  onServiceStart(service: string): void {
    this.edgeService.serviceCommand(service, 'start');
  }
  onServiceStop(service: string): void {
    this.edgeService.serviceCommand(service, 'stop');
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
