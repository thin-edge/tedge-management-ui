import { Component, OnInit, Output } from '@angular/core';
import { ModalLabels } from '@c8y/ngx-components';
import { Subject } from 'rxjs';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { FormGroup } from '@angular/forms';


@Component({
  selector: 'tedge-upload-certificate-modal',
  template: ` <c8y-modal
    title="Add credentials to cloud tenant"
    (onClose)="onUpload()"
    (onDismiss)="onDismiss()"
    [labels]="labels"
    [headerClasses]="'modal-header dialog-header'"
  >
    <div class="card-block">
      <div [formGroup]="credentialsFormly">
        <formly-form
          [form]="credentialsFormly"
          [fields]="credentialsFormlyFields"
          [model]="credentials"
        ></formly-form>
      </div>
    </div>
  </c8y-modal>`
})
export class UploadCertificateComponent implements OnInit {
  @Output() closeSubject: Subject<any> = new Subject();
  credentialsFormlyFields: FormlyFieldConfig[] = [];
  credentialsFormly: FormGroup = new FormGroup({});
  credentials: any = {};
  labels: ModalLabels = { ok: 'Upload', cancel: 'Dismiss' };

  ngOnInit(): void {
    this.credentialsFormlyFields = [
      {
        className: 'col-lg-12',
        key: 'username',
        type: 'input',
        wrappers: ['c8y-form-field'],
        templateOptions: {
          label: 'Username',
          required: true,
          autocomplete: 'on'
        }
      },
      {
        className: 'col-lg-12',
        key: 'password',
        type: 'input',
        wrappers: ['c8y-form-field'],
        templateOptions: {
          label: 'Password',
          type: 'password',
          required: true
        }
      }
    ];

  }

  onDismiss() {
    console.log('Dismiss');
    this.closeSubject.next(undefined);
  }

  onUpload() {
    console.log('Upload');
    this.closeSubject.next(this.credentials);
  }

}
