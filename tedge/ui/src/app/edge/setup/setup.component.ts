import { Component, OnInit } from '@angular/core';
import { AlertService } from '@c8y/ngx-components';
import { Observable } from 'rxjs';
import { BackendService } from '../../share/backend.service';
import { TedgeStatus } from '../../share/property.model';
import { BsModalService } from 'ngx-bootstrap/modal';
import { UploadCertificateComponent } from './upload-certificate-modal.component';
import { GeneralConfirmModalComponent } from './confirm-modal.component';

@Component({
  selector: 'tedge-setup',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss']
})
export class SetupComponent implements OnInit {
  tedgeConfiguration: any = {};
  configuration: any = {};
  tedgeStatus$: Observable<TedgeStatus>;
  readonly: boolean = false;
  TedgeStatus = TedgeStatus;

  constructor(
    public bsModalService: BsModalService,
    private edgeService: BackendService,
    private alertService: AlertService
  ) {}

  ngOnInit() {
    this.init();
  }

  async init() {
    this.edgeService.getTedgeConfiguration().subscribe((c) => {
      this.tedgeConfiguration = c;
      this.configuration.c8yUrl = this.tedgeConfiguration?.c8y?.url;
      this.configuration.deviceId = this.tedgeConfiguration?.device?.id;
      this.readonly = this.configuration.c8yUrl && this.configuration.deviceId;
      console.log('Initialized configuration:', this.tedgeConfiguration);
    });
    this.tedgeStatus$ = this.edgeService.getTedgeStatus();
  }

  resetLog() {
    this.edgeService.resetLog();
  }

  async configureEdge() {
    this.edgeService.configureTedge(
      this.configuration.c8yUrl,
      this.configuration.deviceId
    );
  }

  async resetEdge() {
    this.init();
    const linkDeviceInDeviceManagement =
      await this.edgeService.getLinkToDeviceInDeviceManagement();
    const initialState = {
      message: `Resetting ThinEdge only deletes the certificate and the registration data locally. To delete resources from the Cloud Tenant open the <a
        href="${linkDeviceInDeviceManagement}"
        target="_blank"
      >
        <strong>Device Management</strong>
      </a>of your cloud tenant and delete the device!`
    };
    const modalRef = this.bsModalService.show(GeneralConfirmModalComponent, {
      initialState
    });
    modalRef.content.closeSubject.subscribe((result) => {
      if (result) {
        this.edgeService.resetTedge();
      }
    });
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
            this.alertService.success('Uploaded certificate to cloud tenant.');
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
