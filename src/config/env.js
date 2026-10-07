require('dotenv').config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    username: process.env.DB_USER || 'bankit',
    password: process.env.DB_PASSWORD || 'bankit',
    database: process.env.DB_NAME || 'bankit',
    poolSize: Number(process.env.DB_POOL_SIZE || 10)
  }
};
