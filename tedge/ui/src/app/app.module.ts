import { NgModule } from '@angular/core';
import {
  BootstrapComponent,
  CoreModule,
  RouterModule,
  hookDrawer,
  hookOptions
} from '@c8y/ngx-components';
import { RouterModule as ngRouterModule } from '@angular/router';
import { AnalyticsModule } from './analytics/analytics.module';
import { NavigationBottomDrawerFactory } from './share';
import { SharedModule } from './share';
import { CloudModule } from './cloud/cloud.module';
import { EdgeModule } from './edge/edge.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  imports: [
    BrowserAnimationsModule,
    ngRouterModule.forRoot([], { enableTracing: false, useHash: true }),
    RouterModule.forRoot(),
    CoreModule.forRoot(),
    SharedModule,
    EdgeModule,
    CloudModule,
    AnalyticsModule
  ],
  providers: [
    hookOptions({
      noLogin: true,
      hideNavigator: false,
      hidePowered: false,
      noAppSwitcher: true,
      cookiePreferences: {
        functional: false,
        marketing: false,
        required: true
      },
      disableTracking: true
    } as any),
    hookDrawer(NavigationBottomDrawerFactory)
  ],
  bootstrap: [BootstrapComponent]
})
export class AppModule {}
