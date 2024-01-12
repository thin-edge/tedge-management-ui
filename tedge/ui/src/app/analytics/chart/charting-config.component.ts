import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import { EdgeService } from '../../edge.service';
import { AnalyticsConfiguration, MeasurementType } from '../../property.model';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { isSerieSelected } from '../../share/utils';

@Component({
  selector: 'tedge-charting-config',
  templateUrl: './charting-config.component.html',
  styleUrls: ['./charting-config.component.less']
})
export class ChartingConfigComponent implements OnInit {
  constructor(
    private formBuilder: FormBuilder,
    public edgeService: EdgeService
  ) {}

  @Output() onChangeConfig = new EventEmitter<any>();
  @Output() onClose = new EventEmitter<any>();
  @Input() config: AnalyticsConfiguration;
  measurementTypes$: Observable<MeasurementType[]>;
  isHidden: boolean = false;
  Object = Object;

  configForm = new FormGroup({});
  seriesForm: FormGroup;

  fields: FormlyFieldConfig[] = [
    {
      key: 'diagramName',
      type: 'input',
      wrappers: ['c8y-form-field'],
      templateOptions: {
        label: 'Digram Name',
        required: true
      }
    },
    {
      key: 'fitAxis',
      type: 'checkbox',
      wrappers: ['c8y-form-field'],
      templateOptions: {
        label: 'Fit Axis',
        readonly: false,
        change: ( field, $event) => {
          this.updateFitAxis();
        }
      }
    },
    {
      key: 'fillCurve',
      type: 'checkbox',
      wrappers: ['c8y-form-field'],
      templateOptions: {
        label: 'Fill Curve',
        readonly: false
      }
    },
    {
      key: 'rangeLow',
      type: 'input',
      wrappers: ['c8y-form-field'],
      hideExpression: 'model.fitAxis',
      templateOptions: {
        label: 'Lower range y-axis',
        type: 'number',
        readonly: false
      }
    },
    {
      key: 'rangeHigh',
      type: 'input',
      wrappers: ['c8y-form-field'],
      hideExpression: 'model.fitAxis',
      templateOptions: {
        label: 'Higher range y-axis',
        type: 'number',
        readonly: false
      }
    }
  ];
  ngOnInit() {
    this.seriesForm = this.formBuilder.group({
      seriesArray: new FormArray([])
    });
    this.measurementTypes$ = from(this.edgeService.getMeasurementTypes()).pipe(
      map((mTypes) => {
        const result0 = mTypes.map((mType) => {
          const transformed = {
            type: mType.type,
            device: mType.device,
            series: mType.series.map((serie) => {
              return {
                name: serie,
                selected: isSerieSelected(
                  mType.device,
                  mType.type,
                  serie,
                  this.config?.selectedMeasurements
                )
              };
            })
          };
          return transformed;
        });
        return result0;
      })
    );
    console.log('Init: config:', this.config);
  }

  onSaveClicked(): void {
    this.onChangeConfig.emit(this.config);
  }

  onCloseClicked(): void {
    this.onClose.emit();
  }

  updateFitAxis() {
    console.log('Adapting fit, before:', this.config);
    if (this.config.fitAxis) {
      delete this.config.rangeLow;
      delete this.config.rangeHigh;
    }
    console.log('Adapting fit, after:', this.config);
  }

  selectSerie(event) {
    // mType.device + '___' + mType.type + '___' + serie.name
    const [device, type, name] = event.target.id.split('___');
    console.log('Selected serie', event);
    const {selectedMeasurements} = this.config;
    const mtss = selectedMeasurements.filter(
      (mt) => mt.device == device && mt.type == type
    );
    let mts;
    if (!mtss || mtss.length == 0) {
      mts = {
        type,
        device,
        series: [{ selected: event.target.checked, name }]
      };
      selectedMeasurements.push(mts);
    } else {
      // update existing measurementType
      mts = mtss[0];
      // find relevant series
      if (!mts.series) {
        mts.series = [];
      }
      const sers = mts.series.filter((ser) => ser.name == name);
      let ser;
      if (!sers || sers.length == 0) {
        ser = {
          name,
          selected: event.target.checked
        };
        mts.series.push(ser);
      } else {
        sers[0].selected = event.target.checked;
      }
    }
  }
}
