import { Injectable } from '@angular/core';
import {
  DrawerItem,
  ExtensionFactory,
  OptionsService
} from '@c8y/ngx-components';
import { NavigationBottomComponent } from './navigation-bottom-drawer.component';

@Injectable()
export class NavigationBottomDrawerFactory implements ExtensionFactory<DrawerItem> {
  protected drawerItem: DrawerItem = {
    component: NavigationBottomComponent,
    position: 'left',
    priority: 1001,
    noneRequired: true
  };
  constructor(private options: OptionsService) {}
  get(): DrawerItem[] | DrawerItem {
    if (this.options.get('hidePowered')) {
      return [];
    }
    return this.drawerItem;
  }
}
