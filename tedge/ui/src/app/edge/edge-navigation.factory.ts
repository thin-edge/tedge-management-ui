import { Injectable } from '@angular/core';
import { NavigatorNode, NavigatorNodeFactory, _ } from '@c8y/ngx-components';

@Injectable()
export class EdgeNavigationFactory implements NavigatorNodeFactory {
  nav: NavigatorNode[] = [];
  constructor() {
    const setup: NavigatorNode = new NavigatorNode({
      label: _('Setup'),
      icon: 'c8y-administration',
      path: '/edge/setup',
      priority: 80,
      routerLinkExact: false
    });
    const status: NavigatorNode = new NavigatorNode({
      label: _('Service Control'),
      icon: 'rocket',
      path: '/edge/status',
      priority: 60,
      routerLinkExact: false
    });
    const configuration: NavigatorNode = new NavigatorNode({
      label: _('Configuration'),
      icon: 'cog',
      path: '/edge/configuration',
      priority: 40,
      routerLinkExact: false
    });
    const log: NavigatorNode = new NavigatorNode({
      label: _('Log'),
      icon: 'logs',
      path: '/edge/log',
      priority: 20,
      routerLinkExact: false
    });
    const device: NavigatorNode = new NavigatorNode({
      label: _('Device'),
      icon: 'sensor',
      path: '/edge/device',
      priority: 10,
      routerLinkExact: false
    });
    const edge: NavigatorNode = new NavigatorNode({
      label: _('Edge'),
      priority: 300,
      children: [setup, status, configuration, log, device],
      icon: 'thin-client',
      routerLinkExact: false
    });
    this.nav.push(edge);
  }

  get() {
    return this.nav;
  }
}
