import { Component, OnInit, ViewEncapsulation } from '@angular/core';

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
  constructor(private edgeService: EdgeService) {}
  ngOnInit() {
    this.edgeService.getTedgeServiceStatus().then((data) => {
      this.serviceStatus = data.result;
    });
  }
}
