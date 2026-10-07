const { errors } = require('../utils/errors');

function validateTransferBody(body) {
  const { senderAccountId, recipientAccountId, amount } = body || {};
  if (!senderAccountId) throw errors.invalid('senderAccountId is required');
  if (!recipientAccountId) throw errors.invalid('recipientAccountId is required');
  if (senderAccountId === recipientAccountId) throw errors.sameAccount();
  if (amount === undefined || amount === null || amount === '') throw errors.invalid('amount is required');

  const normalized = typeof amount === 'number' ? amount.toString() : String(amount).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw errors.invalid('amount must be a positive monetary value with at most 2 decimal places');
  }
  if (Number(normalized) <= 0) throw errors.invalid('amount must be greater than zero');
  if (normalized.replace('.', '').length > 17) throw errors.invalid('amount is too large');

  return { senderAccountId, recipientAccountId, amount: normalized };
}

function validateIdempotencyKey(key) {
  if (key === undefined) return null;
  if (typeof key !== 'string' || key.trim().length === 0 || key.length > 255) {
    throw errors.invalid('Idempotency-Key must be a non-empty string of at most 255 characters');
  }
  return key.trim();
}

module.exports = { validateTransferBody, validateIdempotencyKey };
