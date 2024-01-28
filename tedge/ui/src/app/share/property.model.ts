export interface BackendStatusEvent {
  status: CommandStatus;
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

export enum CommandStatus {
  ERROR = 'ERROR',
  START_JOB = 'START_JOB',
  END_JOB = 'END_JOB',
  CMD_JOB = 'CMD_JOB',
  RESULT_JOB = 'RESULT_JOB',
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

export interface TedgeConfiguration {}

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
  jobName: string;
  args?: any[];
  promptText: string;
  deviceId?: string;
  tenantUrl?: string;
}

export interface BackendJobProgress {
  cmd: string;
  jobName: string;
  promptText: string;
  status: string;
  progress: number;
  total: number;
}

export interface BackendTaskOutput {
    jobName: string;
    task?: string;
    output: string;
  }
