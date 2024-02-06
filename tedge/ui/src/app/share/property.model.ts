import { BackendJobType } from './utils';

export interface BackendStatusEvent {
  jobName: string;
  currentTask: number;
  statusType: StatusType;
  message?: string;
  date?: Date;
}

export enum TedgeStatus {
  UNKNOWN = 'UNKNOWN',
  BLANK = 'BLANK',
  INITIALIZED = 'INITIALIZED',
  REGISTERED = 'REGISTERED',
  CERTIFICATE_UPLOADED = 'CERTIFICATE_UPLOADED'
}

export enum StatusType {
  ERROR = 'ERROR',
  START_JOB = 'START_JOB',
  END_JOB = 'END_JOB',
  START_TASK = 'START_TASK',
  RESULT_TASK = 'RESULT_TASK',
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

export interface BackendConfiguration {
  analytics: AnalyticsConfiguration;
  status: TedgeStatus;
  storageEnabled: boolean;
  analyticsFlowEnabled: boolean;
}

export type TedgeConfiguration = any;

export interface AnalyticsConfiguration {
  fillCurve: boolean;
  fitAxis: boolean;
  rangeLow: any;
  rangeHigh: any;
  diagramName: string;
  ttl: number;
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

export interface BackendJob {
  jobName: BackendJobType;
  args?: any[];
  promptText: string;
  deviceId?: string;
  c8yUrl?: string;
  displayingProgressBar?: boolean;
}

export interface BackendJobProgress {
  jobName: string;
  status: string;
  cmd: string;
  promptText: string;
  currentTask: number;
  totalTask: number;
  displayingProgressBar?: boolean;
}

export interface BackendTaskOutput {
  jobName: string;
  currentTask: number;
  task?: string;
  output: string;
}
