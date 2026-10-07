class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'AppError';
  }
}

const errors = {
  invalid: (message) => new AppError(400, 'INVALID_REQUEST', message),
  notFound: (message = 'Account not found') => new AppError(404, 'ACCOUNT_NOT_FOUND', message),
  insufficient: () => new AppError(409, 'INSUFFICIENT_FUNDS', 'Insufficient account balance'),
  currency: () => new AppError(409, 'CURRENCY_MISMATCH', 'Sender and recipient currencies must match'),
  sameAccount: () => new AppError(400, 'INVALID_REQUEST', 'Sender and recipient accounts must be different'),
  failed: (message = 'Transfer failed') => new AppError(500, 'TRANSFER_FAILED', message),
  duplicate: () => new AppError(409, 'DUPLICATE_REQUEST', 'A request with this idempotency key is already in progress or has been processed')
};

module.exports = { AppError, errors };
