import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '@c8y/ngx-components';
import { Observable } from 'rxjs';
import { EdgeService } from '../edge.service';
import { TedgeStatus, TedgeMgmConfiguration } from '../property.model';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { UploadCertificateComponent } from './upload-certificate-modal.component';

@Component({
  selector: 'tedge-setup',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss']
})
export class SetupComponent implements OnInit {
  configurationForm: FormGroup;
  tedgeConfiguration: any = {};
  tedgeMgmConfiguration: TedgeMgmConfiguration ;
  pendingCommand$: Observable<string>;
  tedgeStatus$: Observable<TedgeStatus>;
  readonly: boolean = false;
  TedgeStatus = TedgeStatus;

  constructor(
    public bsModalService: BsModalService,
    private edgeService: EdgeService,
    private alertService: AlertService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit() {
    this.initForm();
    this.pendingCommand$ = this.edgeService.getCommandPending();
  }

  async initForm() {
    this.configurationForm = this.formBuilder.group({
      tenantUrl: ['', Validators.required],
      deviceId: ['', Validators.required]
    });

    this.tedgeConfiguration = await this.edgeService.getTedgeConfiguration();
    this.tedgeMgmConfiguration = await this.edgeService.getTedgeMgmConfiguration();
    this.readonly =
      this.tedgeConfiguration?.deviceId  &&
      this.tedgeConfiguration?.tenantUrl ;

    this.tedgeStatus$ = this.edgeService.getTedgeStatus();
  }

  resetLog() {
    this.edgeService.resetLog();
  }

  async configureEdge() {
    this.edgeService.refreshTedgeConfiguration(this.tedgeConfiguration);
    this.edgeService.configureTedge();
  }

  async resetEdge() {
    this.initForm();
    this.edgeService.resetTedge();
  }

  async downloadCertificate() {
    try {
      const data = await this.edgeService.downloadCertificate('blob');
      const url = window.URL.createObjectURL(data);
      window.open(url);
      console.log('New download:', url);
      // window.location.assign(res.url);
    } catch (error) {
      console.log(error);
      this.alertService.danger('Download failed!');
    }
  }

  async uploadCertificate() {
    const initialState = {};
    const modalRef = this.bsModalService.show(UploadCertificateComponent, {
      initialState
    });
    modalRef.content.closeSubject.subscribe(async (credentials) => {
      console.log('Credentials for upload:', credentials);
      if (credentials) {
        try {
          await this.edgeService.initFetchClient(credentials);
          const res = await this.edgeService.uploadCertificateToTenant();
          console.log('Upload response:', res);
          if (res.status < 300) {
            this.alertService.success('Uploaded certificate to cloud tenant');
          } else {
            this.alertService.danger('Failed to upload certificate!');
          }
        } catch (err) {
          this.alertService.danger(
            `Failed to upload certificate: ${err.message}`
          );
        }
      }
    });
  }
}
