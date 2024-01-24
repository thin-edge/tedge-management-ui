import { Component, OnInit } from '@angular/core';
import { EdgeService } from '../edge.service';

@Component({
  selector: 'tedge-log',
  templateUrl: './log-view.component.html',
  styleUrls: ['./log-view.component.scss']
})
export class LogViewComponent implements OnInit {

  constructor(private edgeService: EdgeService) {}

  ngOnInit() {
    true;
  }
}
