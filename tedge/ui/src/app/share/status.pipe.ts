import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
  name: 'applyStatusColoring'
})
export class StatusColoringPipe implements PipeTransform {
  constructor(private _domSanitizer: DomSanitizer) {}

  transform(value: any): any {
    return this._domSanitizer.bypassSecurityTrustHtml(this.highlight(value));
  }

  highlight(text: string) {
    const stopped = "<span style='color:red'>[  stopped  ]</span>";
    const failed = "<span style='color:orange'>[$1failed$2]</span>";
    const started = "<span style='color:green'>[  started $1]</span>";
    let fmt: string = text;
    if (text) {
      fmt = text
        .replace(/\[ {2}stopped {2}\]/g, stopped)
        .replace(/\[([ ]*)failed([ ]*)\]/g, failed)
        .replace(/\[ {2}started ([^\]]*)]/g, started);
      // console.log ("Formatted status exit:", fmt)
    }
    return fmt;
  }
}
