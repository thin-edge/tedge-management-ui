/*
 * Copyright (c) 2022 Software AG, Darmstadt, Germany and/or Software AG USA Inc., Reston, VA, USA,
 * and/or its subsidiaries and/or its affiliates and/or their licensors.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @authors Christof Strack
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  BackendConfiguration
} from '../share/property.model';
import { AlertService } from '@c8y/ngx-components';
import { BACKEND_CONFIGURATION_ENDPOINT } from '../share/utils';

@Injectable({ providedIn: 'root' })
export class SharedService {
  constructor(
    private http: HttpClient,
    private alertService: AlertService
  ) {}
  private _storageEnabled: boolean;
  private _analyticsFlowEnabled: boolean;

  private async getTedgeMgmConfiguration(): Promise<BackendConfiguration> {
    const result = this.http
      .get<any>(BACKEND_CONFIGURATION_ENDPOINT)
      .toPromise()
      .then((config) => {
        return config;
      })
      .catch(() => {
        console.log('Cannot reach backend!');
        this.alertService.warning('Cannot reach backend!');
      });

    return result;
  }

  async isStorageEnabled(): Promise<boolean> {
    if (!this._storageEnabled) {
      this._storageEnabled = (
        await this.getTedgeMgmConfiguration()
      ).storageEnabled;
      console.log(`Configuration storageEnabled: ${this._storageEnabled}`);
    }
    return this._storageEnabled;
  }
  async isAnalyticsFlowEnabled(): Promise<boolean> {
    if (!this._analyticsFlowEnabled) {
      this._analyticsFlowEnabled = (
        await this.getTedgeMgmConfiguration()
      ).analyticsFlowEnabled;
      console.log(`Configuration analyticsFlowEnabled: ${this._analyticsFlowEnabled}`);
    }
    return this._analyticsFlowEnabled;
  }
}
