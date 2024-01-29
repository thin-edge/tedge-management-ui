import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule as ngRouterModule } from '@angular/router';
import {
  BootstrapComponent,
  CoreModule,
  RouterModule,
  hookDrawer,
  hookNavigator,
  hookOptions
} from '@c8y/ngx-components';
import { NgChartsModule } from 'ng2-charts';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { PopoverModule } from 'ngx-bootstrap/popover';
import { SocketIoConfig, SocketIoModule } from 'ngx-socket-io';
import { AnalyticsComponent } from './analytics/chart/analytics.component';
import { AnalyticsModule } from './analytics/analytics.module';
import { CloudComponent } from './cloud/cloud.component';
import { ControlComponent } from './edge/control/control.component';
import { AppNavigationFactory } from './share/app-navigation.factory';
import { SetupComponent } from './edge/setup/setup.component';
import { StatusComponent } from './edge/status/status.component';
import { FormlyModule } from '@ngx-formly/core';
import { FormlyBootstrapModule } from '@ngx-formly/bootstrap';
import { EventsComponent } from './share/event/events.component';
import { UploadCertificateComponent } from './edge/setup/upload-certificate-modal.component';
import { GeneralConfirmModalComponent } from './edge/setup/confirm-modal.component';
import { TedgeBottomComponent } from './share/tedge-bottom-drawer.component';
import { TedgeBottomDrawerFactory } from './share/tedge-bottom-drawer.factory';
import { CollapseModule } from 'ngx-bootstrap/collapse';
import { LogViewComponent } from './edge/log/log-view.component';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { TimepickerModule } from 'ngx-bootstrap/timepicker';
import { ConfigViewComponent } from './edge/config/config-view.component';

const config: SocketIoConfig = { url: location.origin, options: {} };

@NgModule({
  imports: [
    BrowserAnimationsModule,
    BrowserModule,
    RouterModule.forRoot(),
    ngRouterModule.forRoot(
      [
        { path: '', component: SetupComponent }, // set default route
        { path: 'analytics', component: AnalyticsComponent },
        { path: 'cloud', component: CloudComponent },
        { path: 'edge/setup', component: SetupComponent },
        { path: 'edge/status', component: StatusComponent },
        { path: 'edge/configuration', component: ConfigViewComponent },
        { path: 'edge/log', component: LogViewComponent },
        { path: 'edge/control', component: ControlComponent }
      ],
      { enableTracing: false, useHash: true }
    ),
    CoreModule.forRoot(),
    ReactiveFormsModule,
    FormlyBootstrapModule,
    FormlyModule.forRoot({}),
    AnalyticsModule,
    SocketIoModule.forRoot(config),
    NgChartsModule,
    BsDropdownModule.forRoot(),
    PopoverModule,
    CollapseModule.forRoot(),
    BsDatepickerModule.forRoot(),
    TimepickerModule.forRoot(),
  ],
  providers: [
    hookNavigator(AppNavigationFactory),
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
      disableTracking: true,
    } as any),
    hookDrawer(TedgeBottomDrawerFactory),

  ],
  bootstrap: [BootstrapComponent],
  declarations: [
    EventsComponent,
    CloudComponent,
    SetupComponent,
    StatusComponent,
    GeneralConfirmModalComponent,
    ControlComponent,
    UploadCertificateComponent,
    TedgeBottomComponent,
    LogViewComponent,
    ConfigViewComponent
  ]
})
export class AppModule {}
