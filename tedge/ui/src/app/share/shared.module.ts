import { NgModule } from '@angular/core';
import {
  CoreModule,
} from '@c8y/ngx-components';
import { EventsComponent } from './event/events.component';
import { SocketIoConfig, SocketIoModule } from 'ngx-socket-io';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { PopoverModule } from 'ngx-bootstrap/popover';

const config: SocketIoConfig = { url: location.origin, options: {} };

@NgModule({
  imports: [
    CoreModule,
    SocketIoModule.forRoot(config),
    BsDropdownModule.forRoot(),
    PopoverModule,
  ],
  declarations: [
    EventsComponent,
  ],
  exports: [EventsComponent]
})
export class SharedModule {}
