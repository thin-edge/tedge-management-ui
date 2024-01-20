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

module.exports = { flattenJSON, flattenJSONAndClean };
