import { Injectable } from '@angular/core';
import { NavigatorNode, NavigatorNodeFactory, _ } from '@c8y/ngx-components';
import { SharedService } from '../shared.service';

@Injectable()
export class AnalyticsNavigationFactory implements NavigatorNodeFactory {
  nav: NavigatorNode[] = [];
  constructor( private sharedService: SharedService) {
    const realtime: NavigatorNode = new NavigatorNode({
      path: '/analytics/realtime',
      priority: 800,
      label: 'Realtime',
      icon: 'arrow-advance',
      routerLinkExact: false
    });
    const historic: NavigatorNode = new NavigatorNode({
      path: '/analytics/historic',
      priority: 900,
      label: 'Historic',
      icon: 'timeline',
      routerLinkExact: false,
      hidden: !this.sharedService.isStorageEnabled()
    });
    const storage: NavigatorNode = new NavigatorNode({
      path: '/analytics/storage',
      priority: 1000,
      label: 'Storage',
      icon: 'filing-cabinet',
      routerLinkExact: false,
      hidden: !this.sharedService.isStorageEnabled()
    });
    const flow: NavigatorNode = new NavigatorNode({
      path: '/analytics/flow',
      priority: 1100,
      label: 'Flow',
      icon: 'workflow',
      routerLinkExact: false
    });
    const analytics: NavigatorNode = new NavigatorNode({
      label: _('Analytics'),
      priority: 200,
      icon: 'area-chart',
      children: [realtime, historic, storage, flow]
    });

    this.nav.push(analytics);
  }

  get() {
    return this.nav;
  }
}
