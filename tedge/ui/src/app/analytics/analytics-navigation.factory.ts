import { Injectable } from '@angular/core';
import { NavigatorNode, NavigatorNodeFactory, _ } from '@c8y/ngx-components';
import { SharedService } from '../share';

@Injectable()
export class AnalyticsNavigationFactory implements NavigatorNodeFactory {
  nav: NavigatorNode[] = [];
  constructor(private sharedService: SharedService) {}

  async get() {
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
      hidden: !(await this.sharedService.isStorageEnabled())
    });
    const storage: NavigatorNode = new NavigatorNode({
      path: '/analytics/storage',
      priority: 1000,
      label: 'Storage',
      icon: 'filing-cabinet',
      routerLinkExact: false,
      hidden: !(await this.sharedService.isStorageEnabled())
    });
    const flow: NavigatorNode = new NavigatorNode({
      path: '/analytics/flow',
      priority: 1100,
      label: 'Flow',
      icon: 'workflow',
      routerLinkExact: false
    });
    const analyticsNodes = [realtime, historic, storage];
    if (this.sharedService.isAnalyticsFlowEnabled) analyticsNodes.push(flow);
    const analytics: NavigatorNode = new NavigatorNode({
      label: _('Analytics'),
      priority: 200,
      icon: 'area-chart',
      children: analyticsNodes
    });
    this.nav.push(analytics);
    return this.nav;
  }
}
