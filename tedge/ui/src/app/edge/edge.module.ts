import { NgModule } from '@angular/core';
import { CoreModule, hookNavigator, hookRoute } from '@c8y/ngx-components';
import { ControlComponent } from './control/control.component';
import { SetupComponent } from './setup/setup.component';
import { StatusComponent } from './status/status.component';
import { UploadCertificateComponent } from './setup/upload-certificate-modal.component';
import { GeneralConfirmModalComponent } from './setup/confirm-modal.component';
import { LogViewComponent } from './log/log-view.component';
import { ConfigViewComponent } from './config/config-view.component';
import { DeviceComponent } from './device/device.component';
import { EdgeNavigationFactory } from './edge-navigation.factory';
import { SharedModule } from '../share';

@NgModule({
  imports: [CoreModule, SharedModule],
  providers: [
    hookNavigator(EdgeNavigationFactory),
    hookRoute({ path: '', component: SetupComponent }), // set default route
    hookRoute({ path: 'edge/setup', component: SetupComponent }),
    hookRoute({ path: 'edge/status', component: StatusComponent }),
    hookRoute({ path: 'edge/configuration', component: ConfigViewComponent }),
    hookRoute({ path: 'edge/log', component: LogViewComponent }),
    hookRoute({ path: 'edge/device', component: DeviceComponent }),
    hookRoute({ path: 'edge/control', component: ControlComponent })
  ],
  declarations: [
    SetupComponent,
    DeviceComponent,
    StatusComponent,
    GeneralConfirmModalComponent,
    ControlComponent,
    UploadCertificateComponent,
    LogViewComponent,
    ConfigViewComponent
  ]
})
export class EdgeModule {}
