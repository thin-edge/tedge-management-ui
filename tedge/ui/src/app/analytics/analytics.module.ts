import { NgModule } from '@angular/core';
import { CoreModule, hookNavigator, hookRoute } from '@c8y/ngx-components';
import { NgChartsModule } from 'ng2-charts';
import { CollapseModule } from 'ngx-bootstrap/collapse';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { SharedModule, SharedService } from '../share';
import { NodeRedIframeComponent } from './analytic/node-red-iframe.component';
import { AnalyticsNavigationFactory } from './analytics-navigation.factory';
import { AnalyticsComponent } from './chart/analytics.component';
import { ChartingConfigComponent } from './chart/charting-config.component';
import { ChartingWidgetComponent } from './chart/charting-widget.component';
import { StorageComponent } from './storage/storage.component';

export function initializeApp(sharedService: SharedService) {
  return () => sharedService.isStorageEnabled();
}
@NgModule({
  declarations: [
    ChartingWidgetComponent,
    ChartingConfigComponent,
    AnalyticsComponent,
    StorageComponent
  ],

  imports: [
    CoreModule,
    NgChartsModule,
    SharedModule,
    CollapseModule.forRoot(),
    BsDatepickerModule.forRoot(),
    TimepickerModule.forRoot()
  ],
  providers: [
    hookRoute({
      path: 'analytics/realtime',
      component: AnalyticsComponent
    }),
    hookRoute({
      path: 'analytics/historic',
      component: AnalyticsComponent
    }),
    hookRoute({
      path: 'analytics/storage',
      component: StorageComponent
    }),
    hookRoute({
      path: 'analytics/flow',
      component: NodeRedIframeComponent
    }),
    hookNavigator(AnalyticsNavigationFactory),
    SharedService
  ]
})
export class AnalyticsModule {}
