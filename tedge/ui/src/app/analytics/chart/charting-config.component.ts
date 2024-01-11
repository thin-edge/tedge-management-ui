import { Component, OnInit, EventEmitter, Output, Input } from "@angular/core";
import { EdgeService } from "../../edge.service";
import { MeasurementType } from "../../property.model";
import { FormGroup } from "@angular/forms";
import { FormlyFieldConfig } from "@ngx-formly/core";
import { BehaviorSubject, Observable, from } from "rxjs";
import { map, mergeMap, toArray } from "rxjs/operators";

@Component({
  selector: "charting-config",
  templateUrl: "./charting-config.component.html",
  styleUrls: ["./charting-config.component.less"],
})
export class ChartingConfigComponent implements OnInit {
  constructor(public edgeService: EdgeService) {}

  @Output() onChangeConfig = new EventEmitter<any>();
  @Output() onClose = new EventEmitter<any>();
  @Input() config: {
    fillCurve: boolean;
    fitAxis: boolean;
    rangeLow: any;
    rangeHigh: any;
    diagramName: string;
  };
  measurementTypes$: Observable<MeasurementType[]>;
  isHidden: boolean = false;
  Object = Object;

  form = new FormGroup({});
  fields: FormlyFieldConfig[] = [
    {
      key: "diagramName",
      type: "input",
      wrappers: ["c8y-form-field"],
      templateOptions: {
        label: "Digram Name",
        required: true,
      },
    },
    {
      key: "fitAxis",
      type: "checkbox",
      wrappers: ["c8y-form-field"],
      templateOptions: {
        label: "Fit Axis",
        readonly: false,
        change: (field, $event) => {
          this.updateFitAxis();
        },
      },
    },
    {
      key: "fillCurve",
      type: "checkbox",
      wrappers: ["c8y-form-field"],
      templateOptions: {
        label: "Fill Curve",
        readonly: false,
      },
    },
    {
      key: "rangeLow",
      type: "input",
      wrappers: ["c8y-form-field"],
      hideExpression: "model.fitAxis",
      templateOptions: {
        label: "Lower range y-axis",
        type: "number",
        readonly: false,
      },
    },
    {
      key: "rangeHigh",
      type: "input",
      wrappers: ["c8y-form-field"],
      hideExpression: "model.fitAxis",
      templateOptions: {
        label: "Higher range y-axis",
        type: "number",
        readonly: false,
      },
    },
  ];
  async ngOnInit() {
    this.measurementTypes$ = from(this.edgeService.getMeasurementTypes()).pipe(
      map((mTypes) => {
        const result0 = mTypes.map((mType) => {
          const transformed = {
            type: mType.type,
            device: mType.device,
            series: mType.series.map((serie) => {
              return { name: serie, checked: false };
            }),
          };
          return transformed;
        });
        return result0;
      })
    );
    console.log("Init: config:", this.config);
  }

  public onSaveClicked(): void {
    this.onChangeConfig.emit(this.config);
  }

  public onCloseClicked(): void {
    this.onClose.emit();
  }

  public updateFitAxis() {
    console.log("Adapting fit, before:", this.config);
    if (this.config.fitAxis) {
      delete this.config.rangeLow;
      delete this.config.rangeHigh;
    }
    console.log("Adapting fit, after:", this.config);
  }
}
