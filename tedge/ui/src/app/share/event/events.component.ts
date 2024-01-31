import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Observable } from 'rxjs';
import { EdgeService } from '../edge.service';
import { BackendStatusEvent, CommandStatus } from '../property.model';
import { map } from 'rxjs/operators';

@Component({
  selector: 'tedge-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class EventsComponent implements OnInit {
  showStatusBar: boolean = true;
  showStatusBar$: Observable<boolean>;
  progress$: Observable<number>;
  statusLogs$: Observable<BackendStatusEvent[]>;
  CommandStatus = CommandStatus;

  constructor(private edgeService: EdgeService) {}
  ngOnInit() {
    this.progress$ = this.edgeService.getJobProgress();
    this.showStatusBar$ = this.edgeService
      .getJobProgress()
      .pipe(map((progress) => progress != 0));
    // ignore retrieving serviceStatus in logs
    this.statusLogs$ = this.edgeService
      .getBackendStatusEvents()
      .pipe(
        map((logEvents) =>
          logEvents.filter(
            (logEvent) =>
              !['serviceStatus', 'tedgeConfiguration'].includes(
                logEvent.jobName
              )
          )
        )
      );
  }
}
