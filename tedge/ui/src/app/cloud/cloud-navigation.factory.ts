import { Injectable } from '@angular/core';
import { NavigatorNode, NavigatorNodeFactory, _ } from '@c8y/ngx-components';

@Injectable()
export class CloudNavigationFactory implements NavigatorNodeFactory {
  nav: NavigatorNode[] = [];
  constructor() {
    const cloud: NavigatorNode = new NavigatorNode({
        path: '/cloud',
        label: _('Cloud'),
        priority: 100,
        icon: 'cloud',
        routerLinkExact: false
      });
    this.nav.push(cloud);
  }

  get() {
    return this.nav;
  }
}
