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
    const stopped = "<span style='color:red'>stopped</span>";
    const crashed = "<span style='color:red'>crashed</span>";
    const started = "<span style='color:green'>started</span>";
    let fmt: string = text;
    if (text) {
      fmt = text
        .replace(/stopped/g, stopped)
        .replace(/crashed/g, crashed)
        .replace(/started/g, started);
      // console.log ("Formatted status exit:", fmt)
    }
    return fmt;
  }
}
