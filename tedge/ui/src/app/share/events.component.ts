import {
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation
} from '@angular/core';
import { AlertService } from '@c8y/ngx-components';
import { Observable, Subject, Subscription } from 'rxjs';
import { EdgeService } from '../edge.service';
import {
  BackendCommandProgress,
  BackendStatusEvent,
  CommandStatus
} from '../property.model';
import { scan } from 'rxjs/operators';

@Component({
  selector: 'tedge-events',
  templateUrl: './events.component.html',
  styleUrls: [
    './events.component.scss',
    '../../../node_modules/xterm/css/xterm.css'
  ],
  encapsulation: ViewEncapsulation.None
})
export class EventsComponent implements OnInit, OnDestroy {
  subscriptionProgress: Subscription;
  subscriptionOutput: Subscription;
  showStatusBar: boolean = true;
  progress: number = 0;
  statusLogs$: Observable<BackendStatusEvent[]>;
  statusLog$: Subject<BackendStatusEvent> = new Subject<BackendStatusEvent>();

  constructor(
    private edgeService: EdgeService,
    private alertService: AlertService
  ) {}
  ngOnInit() {
    this.subscriptionProgress = this.edgeService
      .getJobProgress()
      .subscribe((st: BackendCommandProgress) => {
        console.log('JobProgress:', st);
        this.progress = (100 * (st.progress + 1)) / st.total;
        if (st.status == 'error') {
          this.statusLog$.next({
            date: new Date(),
            message: `Running command ${st.job} failed at step: ${st.progress}`,
            status: CommandStatus.FAILURE
          });
          this.progress = 0;
        } else if (st.status == 'end-job') {
          this.alertService.success(`Successfully completed command ${st.job}`);
          this.statusLog$.next({
            date: new Date(),
            message: `Successfully completed command ${st.job}`,
            status: CommandStatus.SUCCESS
          });
          this.progress = 0;
        } else if (st.status == 'start-job') {
          this.progress = 0;
          this.statusLog$.next({
            date: new Date(),
            message: `Starting job ${st.job}`,
            status: CommandStatus.START_JOB
          });
        } else if (st.status == 'processing') {
          this.statusLog$.next({
            date: new Date(),
            message: `Processing job ${st.job}`,
            status: CommandStatus.PROCESSING
          });
        }
      });
    this.statusLogs$ = this.statusLog$.pipe(
      // tap((i) => console.log('Items', i)),
      scan((acc, val) => {
        let sortedAcc = [val].concat(acc);
        sortedAcc = sortedAcc.slice(0, 9);
        return sortedAcc;
      }, [] as BackendStatusEvent[])
    );
    this.subscriptionOutput = this.edgeService
      .getJobOutput()
      .subscribe((st: string) => {
        this.statusLog$.next({
          date: new Date(),
          message: `Processing job ${st}`,
          status: CommandStatus.PROCESSING
        });
      });
  }

  ngOnDestroy() {
    this.subscriptionOutput.unsubscribe();
    this.subscriptionProgress.unsubscribe();
  }
}
