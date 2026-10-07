# Bankit Backend Coding Challenge — JavaScript + MySQL

A production-oriented REST API for atomic customer-to-customer money transfers. The challenge requested Node.js, REST, database transactions, locking/concurrency control, unique references, idempotency, validation, structured errors and tests. This implementation intentionally uses **JavaScript instead of TypeScript** and **MySQL instead of PostgreSQL**, as requested.

## Stack

- Node.js 20+
- Express 5
- TypeORM 0.3
- MySQL 8.4
- Jest + Supertest
- Docker Compose

## Architecture

`routes -> controllers -> validation -> transfer service -> TypeORM/DataSource -> MySQL`

The transfer service owns the financial invariants. A transfer is executed inside one database transaction. Sender and recipient account rows are acquired with `SELECT ... FOR UPDATE` through TypeORM's pessimistic write lock. Both IDs are locked in deterministic order to reduce deadlock risk when concurrent transfers touch the same accounts.

Balances are stored as MySQL `DECIMAL(19,2)`, never JavaScript floating-point values in the database. Debit/credit SQL expressions operate on the database decimal values.

Idempotency is enforced by a unique `idempotency_key` column on `transactions`. The common retry path first looks up the key; the unique constraint also protects against two concurrent first requests using the same key.

## Database

Tables:

- `users`: customer identity.
- `accounts`: account ownership, unique account number, decimal balance and currency.
- `transactions`: immutable transfer result/reference, sender/recipient, amount, currency, status and optional idempotency key.

Foreign keys prevent orphaned accounts/transactions. Unique constraints protect email, account number, transfer reference and idempotency keys.

## Setup

### Option A — Docker Compose

```bash
docker compose up --build
```

The API will be available at `http://localhost:3000`.

### Option B — Local Node + MySQL

1. Create a MySQL database and user.
2. Copy `.env.example` to `.env` and adjust credentials.
3. Install dependencies:

```bash
npm install
```

4. Start the service:

```bash
npm start
```

The server initializes the TypeORM data source and runs pending migrations automatically outside the test environment.

## Migrations

The initial migration is in `database/migrations/1710000000000-InitialSchema.js`.

For this JavaScript project, migrations can also be run using the TypeORM CLI after adding a JS-compatible CLI configuration if desired. The application itself calls `runMigrations()` at startup, which keeps the minimal setup reproducible.

## API

### POST `/transfers`

Headers:

```text
Content-Type: application/json
Idempotency-Key: abc123   # recommended for retry-safe clients
```

Body:

```json
{
  "senderAccountId": "account-id",
  "recipientAccountId": "account-id",
  "amount": 20000
}
```

Success:

```json
{
  "success": true,
  "reference": "TRX-01ABC...",
  "status": "SUCCESS"
}
```

Validation/business errors use a structured response:

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Insufficient account balance"
  }
}
```

Possible codes include `INVALID_REQUEST`, `ACCOUNT_NOT_FOUND`, `INSUFFICIENT_FUNDS`, `CURRENCY_MISMATCH`, `DUPLICATE_REQUEST` and `TRANSFER_FAILED`.

### GET `/transfers/:reference`

Returns the transfer details:

```json
{
  "reference": "TRX-01ABC...",
  "senderAccountId": "acc-001",
  "recipientAccountId": "acc-002",
  "amount": 20000,
  "currency": "NGN",
  "status": "SUCCESS",
  "createdAt": "2026-09-09T10:00:00.000Z"
}
```

### Bonus: GET `/accounts/:accountId/transactions?page=1&limit=20`

Returns paginated transfer history for the account. `limit` is capped at 100.

### Bonus: GET `/accounts/:accountId/balance`

Returns the current balance and currency.

### GET `/health`

Returns `{ "status": "ok" }`.

## Transaction and concurrency behavior

1. Validate request and idempotency key.
2. Begin a MySQL transaction.
3. Lock sender and recipient account rows using a pessimistic write lock.
4. Verify both accounts exist, currencies match and sender has sufficient funds.
5. Insert the transaction record.
6. Debit sender.
7. Credit recipient.
8. Commit.

Any exception causes the transaction to roll back, so a successful debit cannot survive a failed credit/transaction insert.

Locking is important because checking a balance and then updating it without a row lock permits two concurrent requests to observe the same old balance and overspend the account. Deterministic locking order also reduces lock-order deadlocks when two transfers involve the same pair of accounts in opposite directions.

## Idempotency

Clients should send an `Idempotency-Key` for every transfer that may be retried. The key is stored with the resulting transaction and has a database unique constraint. Repeating the same key returns the original transaction result instead of executing another debit.

For a financial API, a stronger production contract would additionally bind an idempotency key to a canonical request payload and reject reuse with different sender/recipient/amount values. This coding challenge implementation treats the unique key as the identity of the retryable request.

## Tests

Tests cover the requested cases:

- successful transfer
- insufficient funds
- non-existent account
- same sender and recipient
- transaction rollback after debit failure
- duplicate/idempotent request
- currency mismatch
- concurrent transfers against the same sender

### Test database

Create `bankit_test`, copy `.env.test.example` to `.env.test`, then run:

```bash
npm install
npm test
```

The tests run migrations and seed isolated rows before each test.

The rollback test uses `TEST_FAIL_AFTER_DEBIT=true` as a controlled failure injection point. This proves that the debit is part of the same database transaction as the subsequent operation.

## Assumptions and limitations

- Authentication/authorization is intentionally omitted because the challenge explicitly says not to spend excessive time on authentication.
- The sample API uses account UUIDs as `accountId` values; account numbers are separate customer-facing identifiers.
- Currency conversion is not supported. Sender and recipient currencies must match.
- Amounts support up to two decimal places, matching the `DECIMAL(19,2)` storage model.
- The service assumes a single MySQL primary for transaction writes. A production deployment would also need operational controls around retries, database failover, observability, audit retention and authorization.
- Failed validation before a transaction begins does not create a `transactions` row. Every persisted transfer has a unique reference; successfully attempted database transfers also receive one.

## Security notes

- JSON body size is limited.
- Express fingerprinting header is disabled.
- SQL values are parameterized through TypeORM except for validated numeric constants used in balance expressions.
- Balances are never stored as floating-point database values.
- Foreign keys and unique constraints provide database-level integrity in addition to application validation.

## Frontend UI

A simple browser UI is included under `public/` and is served by the Express application itself, so no separate frontend server is required.

Start the application as usual:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:3000/
```

The UI provides:

- Transfer form with sender/recipient account IDs, amount and idempotency key.
- Automatic generation of an idempotency key when one is not supplied.
- Transfer result/reference lookup.
- Account balance lookup.
- Paginated account transaction history.
- API health indicator.
- Responsive layout suitable for desktop and mobile screens.

The frontend intentionally uses plain HTML, CSS and browser JavaScript to keep the coding-challenge project lightweight and avoid introducing a second build system. It uses the same-origin Express API, so no CORS configuration is necessary.

If using the API locally without Docker, run `npm start` and open `http://localhost:3000/` after the application has connected to MySQL and run its migrations.
