const http = require('http');

const flattenJSON = (obj = {}, sep = '.', res = {}, extraKey = '') => {
  for (key in obj) {
    if (typeof obj[key] !== 'object') {
      res[extraKey + key] = obj[key];
    } else {
      flattenJSON(obj[key], sep, res, `${extraKey}${key}${sep}`);
    }
  }
  return res;
};

const flattenJSONAndClean = (
  obj = {},
  sep = '.',
  clean = '_',
  res = {},
  extraKey = ''
) => {
  for (key in obj) {
    if (typeof obj[key] !== 'object') {
      const newKey = extraKey + key;
      res[newKey.replace('.', clean)] = obj[key];
    } else {
      flattenJSONAndClean(obj[key], sep, clean, res, `${extraKey}${key}${sep}`);
    }
  }
  return res;
};

const makeGetRequest = (url) => {
  return new Promise((resolve, reject) => {
    http
      .get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          resolve(data);
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

const aggregateAttributes = (obj, level = 0) => {
  const count = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'object') {
        count[key] = aggregateAttributes(obj[key], level + 1);
      } else {
        count[key] = 1;
      }
    }
  }

  // Sum the counts of child attributes at the current level
  const childCount = Object.values(count).reduce(
    (acc, val) => acc + (typeof val !== 'object' ? val : 1),
    0
  );

  return {
    attributes: childCount,
    children: count
  };
};

const checkNested = (obj, ...props) => {
  for (const prop of props) {
    if (!obj || !Object.prototype.hasOwnProperty.call(obj, prop)) {
      return false;
    }
    obj = obj[prop];
  }
  return true;
};

const propertiesToJson = (propertiesContent) => {
  const lines = propertiesContent.split('\n');
  const jsonObject = {};

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    // Ignore comments and empty lines
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, value] = trimmedLine.split('=');
      assignNestedObject(jsonObject, key.trim(), value.trim());
    }
  });

  return jsonObject;
};

const assignNestedObject = (obj, key, value) => {
  const keys = key.split('.');
  let currentObj = obj;

  keys.forEach((keyPart, index) => {
    if (!currentObj[keyPart]) {
      if (index === keys.length - 1) {
        currentObj[keyPart] = value;
      } else {
        currentObj[keyPart] = {};
      }
    }
    currentObj = currentObj[keyPart];
  });
};

module.exports = {
  makeGetRequest,
  flattenJSON,
  flattenJSONAndClean,
  propertiesToJson,
  assignNestedObject,
  aggregateAttributes,
  checkNested
};
