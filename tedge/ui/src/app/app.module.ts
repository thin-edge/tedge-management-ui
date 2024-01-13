import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule as ngRouterModule } from '@angular/router';
import {
  AlertModule,
  BootstrapComponent,
  CoreModule,
  RouterModule,
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
import { ControlComponent } from './control/control.component';
import { EdgeNavigationFactory } from './navigation.factory';
import { SetupComponent } from './setup/setup.component';
import { StatusColoringDirective } from './share/status.directive';
import { StatusColoringPipe } from './share/status.pipe';
import { StatusComponent } from './status/status.component';
import { FormlyModule } from '@ngx-formly/core';
import { FormlyBootstrapModule } from '@ngx-formly/bootstrap';
import { ConfigurationComponent } from './configuration/configuration.component';
import { EventsComponent } from './share/events.component';

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
        { path: 'edge/configuration', component: ConfigurationComponent },
        { path: 'edge/control', component: ControlComponent }
      ],
      { enableTracing: false, useHash: true }
    ),
    CoreModule.forRoot(),
    FormsModule,
    AlertModule,
    ReactiveFormsModule,
    FormlyBootstrapModule,
    FormlyModule.forRoot({}),
    AnalyticsModule,
    SocketIoModule.forRoot(config),
    NgChartsModule,
    BsDropdownModule.forRoot(),
    PopoverModule
  ],
  providers: [
    hookNavigator(EdgeNavigationFactory),
    hookOptions({
      noLogin: true,
      hideNavigator: false,
      hidePowered: true,
      noAppSwitcher: true,
      cookiePreferences: {
        functional: false,
        marketing: false,
        required: true
      },
      disableTracking: true
    } as any)
  ],
  bootstrap: [BootstrapComponent],
  declarations: [
    EventsComponent,
    CloudComponent,
    SetupComponent,
    ConfigurationComponent,
    StatusComponent,
    ControlComponent,
    StatusColoringDirective,
    StatusColoringPipe
  ]
})
export class AppModule {}
