
mongo_port = process.env['MONGO_PORT'];
mongo_host = process.env['MONGO_HOST'];

rsconf = {
  _id: 'rsmongo',
  members: [
    {
      _id: 0,
      host: `${mongo_host}:${mongo_port}`,
      priority: 1,
    },
  ],
};
rs.initiate(rsconf);
print(`Creating replication set: ${mongo_host}:${mongo_port}`);
sleep(5000);
let st = rs.status();
print('Waiting (extra) for replication set creation, status rs:', st['ok']);

// create collections and index with ttl, so old measurements are deleted automatically
keys = { datetime: 1 };
ttl = process.env['TTL_DOCUMENT'];
options = {
  expireAfterSeconds: parseInt(ttl),
  name: 'datetime_ttl',
};
print('Setting TTL for measurements to:', ttl);
db.createCollection('measurement');
db.measurement.createIndex(keys, options);
db.createCollection('serie');
