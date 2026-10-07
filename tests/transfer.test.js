const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const dataSource = require('../src/config/dataSource');

let users;
let accounts;

async function seed() {
  const userRepo = dataSource.getRepository('User');
  const accountRepo = dataSource.getRepository('Account');
  users = [
    { id: crypto.randomUUID(), name: 'Alice', email: `alice-${Date.now()}@example.com` },
    { id: crypto.randomUUID(), name: 'Bob', email: `bob-${Date.now()}@example.com` },
    { id: crypto.randomUUID(), name: 'Dollar User', email: `dollar-${Date.now()}@example.com` }
  ];
  await userRepo.save(users);
  accounts = [
    { id: crypto.randomUUID(), userId: users[0].id, accountNumber: `ACC${Date.now()}1`, balance: '100000.00', currency: 'NGN' },
    { id: crypto.randomUUID(), userId: users[1].id, accountNumber: `ACC${Date.now()}2`, balance: '50000.00', currency: 'NGN' },
    { id: crypto.randomUUID(), userId: users[2].id, accountNumber: `ACC${Date.now()}3`, balance: '1000.00', currency: 'USD' }
  ];
  await accountRepo.save(accounts);
}

beforeAll(async () => {
  await dataSource.initialize();
  await dataSource.runMigrations();
});

beforeEach(async () => {
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  await dataSource.query('TRUNCATE TABLE transactions');
  await dataSource.query('TRUNCATE TABLE accounts');
  await dataSource.query('TRUNCATE TABLE users');
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
  await seed();
  process.env.TEST_FAIL_AFTER_DEBIT = 'false';
});

afterAll(async () => {
  await dataSource.destroy();
});

test('successful transfer debits, credits and creates a transaction', async () => {
  const key = crypto.randomUUID();
  const response = await request(app)
    .post('/transfers')
    .set('Idempotency-Key', key)
    .send({ senderAccountId: accounts[0].id, recipientAccountId: accounts[1].id, amount: 20000 });

  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.status).toBe('SUCCESS');

  const sender = await dataSource.getRepository('Account').findOneBy({ id: accounts[0].id });
  const recipient = await dataSource.getRepository('Account').findOneBy({ id: accounts[1].id });
  expect(Number(sender.balance)).toBe(80000);
  expect(Number(recipient.balance)).toBe(70000);

  const tx = await dataSource.getRepository('Transfer').findOneBy({ reference: response.body.reference });
  expect(tx).toBeTruthy();
});

test('rejects insufficient funds without changing balances', async () => {
  const response = await request(app).post('/transfers').send({ senderAccountId: accounts[0].id, recipientAccountId: accounts[1].id, amount: 100001 });
  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe('INSUFFICIENT_FUNDS');
  const sender = await dataSource.getRepository('Account').findOneBy({ id: accounts[0].id });
  expect(Number(sender.balance)).toBe(100000);
});

test('rejects a non-existent account', async () => {
  const response = await request(app).post('/transfers').send({ senderAccountId: crypto.randomUUID(), recipientAccountId: accounts[1].id, amount: 100 });
  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe('ACCOUNT_NOT_FOUND');
});

test('rejects the same sender and recipient', async () => {
  const response = await request(app).post('/transfers').send({ senderAccountId: accounts[0].id, recipientAccountId: accounts[0].id, amount: 100 });
  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe('INVALID_REQUEST');
});

test('rolls back the sender debit when a later operation fails', async () => {
  process.env.TEST_FAIL_AFTER_DEBIT = 'true';
  const response = await request(app).post('/transfers').send({ senderAccountId: accounts[0].id, recipientAccountId: accounts[1].id, amount: 20000 });
  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe('TRANSFER_FAILED');
  const sender = await dataSource.getRepository('Account').findOneBy({ id: accounts[0].id });
  const recipient = await dataSource.getRepository('Account').findOneBy({ id: accounts[1].id });
  const transactions = await dataSource.getRepository('Transfer').count();
  expect(Number(sender.balance)).toBe(100000);
  expect(Number(recipient.balance)).toBe(50000);
  expect(transactions).toBe(0);
});

test('same idempotency key returns the original result without double debit', async () => {
  const key = crypto.randomUUID();
  const payload = { senderAccountId: accounts[0].id, recipientAccountId: accounts[1].id, amount: 20000 };
  const first = await request(app).post('/transfers').set('Idempotency-Key', key).send(payload);
  const second = await request(app).post('/transfers').set('Idempotency-Key', key).send(payload);
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(second.body.reference).toBe(first.body.reference);
  const sender = await dataSource.getRepository('Account').findOneBy({ id: accounts[0].id });
  expect(Number(sender.balance)).toBe(80000);
  expect(await dataSource.getRepository('Transfer').count()).toBe(1);
});

test('rejects currency mismatch', async () => {
  const response = await request(app).post('/transfers').send({ senderAccountId: accounts[0].id, recipientAccountId: accounts[2].id, amount: 100 });
  expect(response.status).toBe(409);
  expect(response.body.error.code).toBe('CURRENCY_MISMATCH');
});

test('concurrent transfers cannot both spend the same balance', async () => {
  const payloadA = { senderAccountId: accounts[0].id, recipientAccountId: accounts[1].id, amount: 80000 };
  const payloadB = { senderAccountId: accounts[0].id, recipientAccountId: accounts[1].id, amount: 70000 };
  const [a, b] = await Promise.all([request(app).post('/transfers').send(payloadA), request(app).post('/transfers').send(payloadB)]);
  expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1);
  expect([a.status, b.status].filter((s) => s === 409)).toHaveLength(1);
  const sender = await dataSource.getRepository('Account').findOneBy({ id: accounts[0].id });
  expect(Number(sender.balance)).toBe(20000);
});
