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

module.exports = { makeGetRequest, flattenJSON, flattenJSONAndClean, aggregateAttributes };
