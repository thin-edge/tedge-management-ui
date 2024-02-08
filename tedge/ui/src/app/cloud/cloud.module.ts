import { NgModule } from '@angular/core';
import { CloudComponent } from './cloud.component';
import { SharedModule } from '../share';
import { hookRoute, hookNavigator, CoreModule } from '@c8y/ngx-components';
import { CloudNavigationFactory } from './cloud-navigation.factory';

@NgModule({
  imports: [CoreModule, SharedModule],
  providers: [
    hookNavigator(CloudNavigationFactory),
    hookRoute({ path: 'cloud', component: CloudComponent })
  ],
  declarations: [CloudComponent]
})
export class CloudModule {}
