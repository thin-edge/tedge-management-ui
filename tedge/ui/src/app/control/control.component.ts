import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { EdgeService } from '../edge.service';
import { BackendCommand } from '../property.model';

@Component({
  selector: 'tedge-control',
  templateUrl: './control.component.html',
  styleUrls: ['./control.component.scss']
})
export class ControlComponent implements OnInit {
  configurationForm: FormGroup;
  edgeConfiguration: any = {};
  pendingCommand$: Observable<string>;

  constructor(
    private edgeService: EdgeService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit() {
    this.getNewConfiguration();
    this.initForm();
    this.pendingCommand$ = this.edgeService.getCommandPending();
  }

  initForm() {
    this.configurationForm = this.formBuilder.group({
      tenantUrl: [
        this.edgeConfiguration['c8y.url']
          ? this.edgeConfiguration['c8y.url']
          : '',
        Validators.required
      ],
      deviceId: [
        this.edgeConfiguration['device.id']
          ? this.edgeConfiguration['device.id']
          : '',
        Validators.required
      ]
    });
  }

  resetLog() {
    this.edgeService.resetLog();
  }

  async startEdge() {
    const bc: BackendCommand = {
      job: 'start',
      promptText: 'Starting Thin Edge ...'
    };
    this.edgeService.startBackendJob(bc);
  }

  async stopEdge() {
    const bc: BackendCommand = {
      job: 'stop',
      promptText: 'Stopping Thin Edge ...'
    };
    this.edgeService.startBackendJob(bc);
  }

  async restartPlugins() {
    const bc: BackendCommand = {
      job: 'restartPlugins',
      promptText: 'Restarting Plugins  ...'
    };
    this.edgeService.startBackendJob(bc);
  }

  getNewConfiguration() {
    this.edgeService.getEdgeConfiguration().then((config) => {
      this.edgeConfiguration = config;
      this.configurationForm.setValue({
        tenantUrl: this.edgeConfiguration['c8y.url']
          ? this.edgeConfiguration['c8y.url']
          : '',
        deviceId: this.edgeConfiguration['device.id']
          ? this.edgeConfiguration['device.id']
          : ''
      });
    });
  }
}
