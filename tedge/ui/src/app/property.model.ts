export interface BackendStatusEvent {
  status: CommandStatus;
  message: string;
  date: Date;
}

export enum CommandStatus {
  FAILURE = 'FAILURE',
  START_JOB = 'START_JOB',
  SUCCESS = 'SUCCESS',
  PROCESSING = 'PROCESSING'
}

export interface RawMeasurement {
  _id?: string;
  topic?: string;
  device?: string;
  payload?: any;
  type?: string;
  datetime?: Date;
  timestamp?: number;
}

export interface Serie {
  selected?: boolean;
  name: string;
}

export interface AnalyticsConfiguration {
  fillCurve: boolean;
  fitAxis: boolean;
  rangeLow: any;
  rangeHigh: any;
  diagramName: string;
  selectedMeasurements?: MeasurementType[];
}
export interface MeasurementType {
  type: string;
  device?: string;
  series: Serie[];
}

export interface RawListItem {
  id: any;
  unit: string;
  text: any;
  format?: string;
}

export interface SpanListItem {
  text: string;
  spanInSeconds: number;
  displayUnit?: string;
  type: string;
}

export interface RowStructure {
  name: string;
  value: string;
}

export interface BackendCommand {
  job: string;
  promptText: string;
  deviceId?: string;
  tenantUrl?: string;
}

export interface BackendCommandProgress {
  cmd: string;
  job: string;
  promptText: string;
  status: string;
  progress: number;
  total: number;
}
