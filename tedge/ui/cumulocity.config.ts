import { EnvironmentOptions } from '@c8y/devkit/dist/options';
import { author, description, version } from './package.json';

export default {
  runTime: {
    author,
    description,
    version,
    name: 'Thin Edge Management UI',
    contextPath: 'tedge-mgmt-ui',
    key: 'tedge-management-key',
    contentSecurityPolicy:
      "base-uri 'none'; default-src 'self' 'unsafe-inline' http: https: ws: wss:; connect-src 'self' http: https: ws: wss:;  script-src 'self' *.bugherd.com *.twitter.com *.twimg.com *.aptrinsic.com 'unsafe-inline' 'unsafe-eval' data:; style-src * 'unsafe-inline' blob:; img-src * data: blob:; font-src * data:; frame-src *; worker-src 'self' blob:;",

    icon: {
      url: 'url(./branding/img/thin-edge-avatar.png)'
    }
  },
  buildTime: {
    brandingEntry: './branding/branding.less',
    copy: [
      {
        from: './branding',
        to: './branding'
      }
    ],
    federation: [
      '@angular/animations',
      '@angular/cdk',
      '@angular/common',
      '@angular/compiler',
      '@angular/core',
      '@angular/forms',
      '@angular/platform-browser',
      '@angular/platform-browser-dynamic',
      '@angular/router',
      '@angular/upgrade',
      '@c8y/client',
      '@c8y/ngx-components',
      'ngx-bootstrap',
      '@ngx-translate/core'
    ]
  }
} as const satisfies EnvironmentOptions;
