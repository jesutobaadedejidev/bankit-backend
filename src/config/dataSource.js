require('reflect-metadata');
const { DataSource } = require('typeorm');
const env = require('./env');
const User = require('../entities/User');
const Account = require('../entities/Account');
const Transfer = require('../entities/Transfer');

const AppDataSource = new DataSource({
  type: 'mysql',
  host: env.db.host,
  port: env.db.port,
  username: env.db.username,
  password: env.db.password,
  database: env.db.database,
  entities: [User, Account, Transfer],
  migrations: [require.resolve('../../database/migrations/1710000000000-InitialSchema.js')],
  synchronize: false,
  logging: false,
  extra: { connectionLimit: env.db.poolSize }
});

module.exports = AppDataSource;
