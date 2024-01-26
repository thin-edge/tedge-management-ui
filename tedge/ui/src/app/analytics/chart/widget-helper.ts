import { interpolateRainbow } from 'd3-scale-chromatic';
import { RawListItem, SpanListItem } from '../../share/property.model';

const colorScale = interpolateRainbow;
const colorRangeInfo = {
  colorStart: 0,
  colorEnd: 1,
  useEndAsStart: false
};

const calculatePoint = function (i, intervalSize, colorRangeInfo) {
  const { colorStart, colorEnd, useEndAsStart } = colorRangeInfo;
  return useEndAsStart
    ? colorEnd - i * intervalSize
    : colorStart + i * intervalSize;
};

export const generateNextColor = function (index) {
  const { colorStart, colorEnd } = colorRangeInfo;
  const colorRange = colorEnd - colorStart;
  // accommodate 20 colors
  // var intervalSize = colorRange / dataLength;
  const intervalSize = colorRange / 10;
  // console.log("Color", index)
  const colorPoint = calculatePoint(index, intervalSize, colorRangeInfo);
  return colorScale(colorPoint);
};

export enum UNIT {
  UNIT_YEAR = 7,
  QUARTER = 6,
  MONTH = 5,
  WEEK = 4,
  DAY = 3,
  HOUR = 2,
  MINUTE = 1,
  SECOND = 0
}

export const UnitList: RawListItem[] = [
  //  { id: 0, unit: "second", text: "measurements", format: "h:mm:ss.SSS a" },
  { id: 1, unit: 'second', text: 'second', format: 'h:mm:ss a' },
  { id: 60, unit: 'second', text: 'minute', format: 'h:mm a' },
  { id: 3600, unit: 'minute', text: 'hour', format: 'hA' },
  { id: 86400, unit: 'day', text: 'day', format: 'MMM D' },
  { id: 604800, unit: 'week', text: 'week', format: 'week ll' },
  { id: 2592000, unit: 'month', text: 'month', format: 'MMM YYYY' },
  { id: 7776000, unit: 'quarter', text: 'quarter', format: '[Q]Q - YYYY' },
  { id: 31536000, unit: 'year', text: 'year', format: 'YYYY' }
];

export enum SPAN {
  REALTIME = 0,
  LAST_1_MINUTE = 1,
  LAST_5_MINUTES = 2,
  LAST_30_MINUTES = 3,
  CUSTOM = 4
}

export const SpanList: SpanListItem[] = [
  { text: 'Realtime', spanInSeconds: 0, type: 'realtime' },
  {
    text: 'Last minute',
    spanInSeconds: 60,
    displayUnit: 'second',
    type: 'historic'
  },
  {
    text: 'Last 5 minutes',
    spanInSeconds: 300,
    displayUnit: 'minute',
    type: 'historic'
  },
  {
    text: 'Last 30 minutes',
    spanInSeconds: 1800,
    displayUnit: 'minute',
    type: 'historic'
  },
  { text: 'Custom', spanInSeconds: -1, displayUnit: 'hour', type: 'historic' }
];

export const flatten = function (data) {
  const result = {};
  function recurse(cur, prop) {
    if (Object(cur) !== cur) {
      result[prop] = cur;
    } else if (Array.isArray(cur)) {
      const l = cur.length;
      if (l == 0) result[prop] = [];
      for (let i = 0; i < l; i++)
        recurse(cur[i], prop ? `${prop}.${i}` : `${i}`);
    } else {
      let isEmpty = true;
      for (const p in cur) {
        isEmpty = false;
        recurse(cur[p], prop ? `${prop}.${p}` : p);
      }
      if (isEmpty) result[prop] = {};
    }
  }
  recurse(data, '');
  return result;
};
