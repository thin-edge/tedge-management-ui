import { Injectable } from '@angular/core';
import { NavigatorNode, NavigatorNodeFactory, _ } from '@c8y/ngx-components';

@Injectable()
export class EdgeNavigationFactory implements NavigatorNodeFactory {
  nav: NavigatorNode[] = [];
  // Implement the get()-method, otherwise the ExampleNavigationFactory
  // implements the NavigatorNodeFactory interface incorrectly (!)
  constructor() {
    const setup: NavigatorNode = new NavigatorNode({
      label: _('Setup'),
      icon: 'c8y-administration',
      path: '/edge/setup',
      priority: 80,
      routerLinkExact: false
    });
    const control: NavigatorNode = new NavigatorNode({
      label: _('Control'),
      icon: 'rocket',
      path: '/edge/control',
      priority: 40,
      routerLinkExact: false
    });
    const status: NavigatorNode = new NavigatorNode({
      label: _('Service Status'),
      icon: 'info-circle',
      path: '/edge/status',
      priority: 20,
      routerLinkExact: false
    });
    const configuration: NavigatorNode = new NavigatorNode({
      label: _('Configuration'),
      icon: 'cog',
      path: '/edge/configuration',
      priority: 20,
      routerLinkExact: false
    });
    const cloud: NavigatorNode = new NavigatorNode({
      path: '/cloud',
      label: _('Cloud'),
      priority: 100,
      icon: 'cloud',
      routerLinkExact: false
    });
    const edge: NavigatorNode = new NavigatorNode({
      label: _('Edge'),
      priority: 300,
      children: [setup, control, status, configuration],
      icon: 'thin-client',
      routerLinkExact: false
    });
    this.nav.push(edge, cloud);
  }

  get() {
    return this.nav;
  }
}
