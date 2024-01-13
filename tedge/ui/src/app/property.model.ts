export interface BackendStatusEvent {
  status: CommandStatus;
  message?: string;
  date?: Date;
}

export enum CommandStatus {
  ERROR = 'ERROR',
  START_JOB = 'START_JOB',
  END_JOB = 'END_JOB',
  SUCCESS = 'SUCCESS',
  PROCESSING = 'PROCESSING',
  RESET_JOB_LOG = 'RESET_JOB_LOG'
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