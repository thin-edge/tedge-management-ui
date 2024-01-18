import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { CoreModule, hookNavigator } from '@c8y/ngx-components';
import { ChartingWidgetComponent } from './chart/charting-widget.component';
import { AnalyticsComponent } from './chart/analytics.component';
import { AnalyticsNavigationFactory } from './analytics-navigation.factory';
import { ChartingConfigComponent } from './chart/charting-config.component';
import { CollapseModule } from 'ngx-bootstrap/collapse';
import { NodeRedIframeComponent } from './analytic/node-red-iframe.component';
import { StorageComponent } from './storage/storage.component';

/**
 * Angular Routes.
 * Within this array at least path (url) and components are linked.
 */
const routes: Routes = [
  {
    path: 'analytics/realtime',
    component: AnalyticsComponent
  },
  {
    path: 'analytics/historic',
    component: AnalyticsComponent
  },
  {
    path: 'analytics/storage',
    component: StorageComponent
  },
  {
    path: 'analytics/flow',
    component: NodeRedIframeComponent
  }
];

@NgModule({
  declarations: [
    ChartingWidgetComponent,
    ChartingConfigComponent,
    AnalyticsComponent
  ],
  imports: [
    RouterModule.forChild(routes),
    CoreModule,
    BsDatepickerModule.forRoot(),
    TimepickerModule.forRoot(),
    CollapseModule.forRoot()
  ],
  providers: [
    hookNavigator(AnalyticsNavigationFactory)
  ],
})
export class AnalyticsModule {}
