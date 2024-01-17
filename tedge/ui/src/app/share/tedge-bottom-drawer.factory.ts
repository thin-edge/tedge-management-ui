import { Injectable } from '@angular/core';
import {
  DrawerItem,
  ExtensionFactory,
  OptionsService
} from '@c8y/ngx-components';
import { TedgeBottomComponent } from './tedge-bottom-drawer.component';

@Injectable()
export class TedgeBottomDrawerFactory implements ExtensionFactory<DrawerItem> {
  protected drawerItem: DrawerItem = {
    component: TedgeBottomComponent,
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
