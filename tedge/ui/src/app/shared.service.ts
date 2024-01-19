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
import { TEDGE_MGM_CONFIGURATION_URL, TedgeMgmConfiguration } from './property.model';
import { AlertService } from '@c8y/ngx-components';

@Injectable({ providedIn: 'root' })
export class SharedService {
  constructor(
    private http: HttpClient,
    private alertService: AlertService
  ) {
    this.getTedgeMgmConfiguration()
      .then((tmc) => {
          this._storageEnabled = tmc.storageEnabled;
          console.log('Loading storageEnabled:', tmc.storageEnabled);
      })
      .catch((e) => console.error('MappingService with id not subscribed!', e));
  }
  private _storageEnabled: boolean;
  private _tedgeMgmConfigurationPromise: Promise<TedgeMgmConfiguration>;

  async getTedgeMgmConfiguration(): Promise<TedgeMgmConfiguration> {
    let result = this._tedgeMgmConfigurationPromise;
    if (!result) {
      result = this.http
        .get<any>(TEDGE_MGM_CONFIGURATION_URL)
        .toPromise()
        .then((config) => {
          return config;
        })
        .catch(() => {
          console.log('Cannot reach backend!');
          this.alertService.warning('Cannot reach backend!');
        });
      this._tedgeMgmConfigurationPromise = result;
    }
    return result;
  }

  isStorageEnabled(): boolean {
    if (!this._storageEnabled) {
      console.log('Congiuration not iniitialized!');
    }
    return this._storageEnabled;
  }

}
