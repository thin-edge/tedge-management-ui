import { MeasurementType } from '../property.model';

export function isSerieSelected(
  device: string,
  type: string,
  serie: string,
  selectedMeasurements: MeasurementType[]
): boolean {
  let result = false;
  if (selectedMeasurements) {
    const mtss = selectedMeasurements.filter(
      (mt) => mt.device == device && mt.type == type
    );
    let mts;
    if (!mtss || mtss.length == 0) {
      result = false;
    } else {
      // update existing measurementType
      mts = mtss[0];
      // find relevant series
      if (!mts.series) {
        result = false;
      } else {
        const sers = mts.series.filter((_serie) => _serie.name == serie);
        if (!sers || sers.length == 0) {
          result = false;
        } else {
          result = sers[0].selected;
        }
      }
    }
  }
  return result;
}
