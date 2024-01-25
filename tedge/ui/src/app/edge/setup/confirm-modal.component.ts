import { Component, Input, Output } from '@angular/core';
import { ModalLabels } from '@c8y/ngx-components';
import { Subject } from 'rxjs';

@Component({
  selector: 'tedge-confirm-modal',
  template: ` <c8y-modal
    title="Add credentials to cloud tenant"
    (onClose)="onConfirm()"
    (onDismiss)="onDismiss()"
    [labels]="labels"
    [headerClasses]="'modal-header dialog-header'"
  >
    <div class="card-block">
      <div [innerHTML]="message"></div>
    </div>
  </c8y-modal>`
})
export class GeneralConfirmModalComponent {
  @Input() message: string;
  @Output() closeSubject: Subject<any> = new Subject();
  credentials: any = {};
  labels: ModalLabels = { ok: 'Confirm', cancel: 'Dismiss' };

  onDismiss() {
    this.closeSubject.next(false);
  }

  onConfirm() {
    this.closeSubject.next(true);
  }
}
