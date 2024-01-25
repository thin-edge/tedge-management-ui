import {
  Component,
  OnInit,
  ViewEncapsulation
} from '@angular/core';
import { Observable } from 'rxjs';
import { EdgeService } from '../edge.service';
import {
  BackendStatusEvent,
  CommandStatus
} from '../property.model';

@Component({
  selector: 'tedge-events',
  templateUrl: './events.component.html',
  styleUrls: [
    './events.component.scss',
  ],
  encapsulation: ViewEncapsulation.None
})
export class EventsComponent implements OnInit {

  showStatusBar: boolean = true;
  progress$: Observable<number>;
  statusLogs$: Observable<BackendStatusEvent[]>;
  CommandStatus = CommandStatus;

  constructor(
    private edgeService: EdgeService
  ) {}
  ngOnInit() {
    this.progress$ = this.edgeService.getJobProgress();
    this.statusLogs$ = this.edgeService.getBackendStatusEvents();
  }
}
