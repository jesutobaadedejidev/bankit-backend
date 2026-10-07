const app = require('./app');
const dataSource = require('./config/dataSource');
const env = require('./config/env');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function initializeDatabase() {
  const maxRetries = 15;
  const retryDelay = 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await dataSource.initialize();
      console.log('Database connected successfully.');
      return;
    } catch (error) {
      console.error(
        `Database connection attempt ${attempt}/${maxRetries} failed: ${error.message}`
      );

      if (attempt === maxRetries) {
        throw error;
      }

      await sleep(retryDelay);
    }
  }
}

async function start() {
  await initializeDatabase();

  if (env.nodeEnv !== 'test') {
    await dataSource.runMigrations();
  }

  app.listen(env.port, () =>
    console.log(`Bankit API listening on port ${env.port}`)
  );
}

start().catch((error) => {
  console.error('Failed to start application', error);
  process.exit(1);
});