import { Injectable } from '@angular/core';
import { NavigatorNode, NavigatorNodeFactory, _ } from '@c8y/ngx-components';

@Injectable()
export class AnalyticsNavigationFactory implements NavigatorNodeFactory {
  nav: NavigatorNode[] = [];
  // Implement the get()-method, otherwise the ExampleNavigationFactory
  // implements the NavigatorNodeFactory interface incorrectly (!)
  constructor() {
    const Realtime: NavigatorNode = new NavigatorNode({
      path: '/analytics/realtime',
      priority: 800,
      label: 'Realtime',
      icon: 'arrow-advance',
      routerLinkExact: false
    });
    const Historic: NavigatorNode = new NavigatorNode({
      path: '/analytics/historic',
      priority: 900,
      label: 'Historic',
      icon: 'timeline',
      routerLinkExact: false
    });
    const Flow: NavigatorNode = new NavigatorNode({
      path: '/analytics/flow',
      priority: 1000,
      label: 'Flow',
      icon: 'workflow',
      routerLinkExact: false
    });
    const Analytics: NavigatorNode = new NavigatorNode({
      label: _('Analytics'),
      priority: 200,
      icon: 'area-chart',
      children: [Realtime, Historic, Flow]
    });

    this.nav.push(Analytics);
  }

  get() {
    return this.nav;
  }
}
