export interface RawMeasurement {
  _id?: string
  topic?: string
  device?: string
  payload?: Object
  type?: string
  datetime?: Date
  timestamp?: number
}

export interface Serie {
    checked?:boolean
    name: string
  }
export interface MeasurementType {
  type: string
  device?: string
  series: Serie[]
}

export interface RawListItem {
  id: any;
  unit: string
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
};

export interface BackendCommand {
  job: string;
  promptText: string;
  deviceId?: string;
  tenantUrl?: string
};

export interface BackendCommandProgress {
  cmd: string
  job: string
  promptText: string
  status: string
  progress: number
  total: number
}