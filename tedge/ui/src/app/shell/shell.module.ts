import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CoreModule, hookNavigator } from '@c8y/ngx-components';
import { ShellNavigationFactory } from './shell.navigation.factory';
import { ShellComponent } from './shell.component';
import { CollapseModule } from 'ngx-bootstrap/collapse';

/**
 * Angular Routes.
 * Within this array at least path (url) and components are linked.
 */
const routes: Routes = [
  {
    path: 'edge/shell',
    component: ShellComponent
  }
];

@NgModule({
  declarations: [ShellComponent],
  imports: [
    RouterModule.forChild(routes),
    CoreModule,
    CollapseModule.forRoot()
  ],
  /**
   * Adding the hooks to the providers:
   */
  providers: [
    hookNavigator(ShellNavigationFactory)
  ],
})
export class ShellModule {}
