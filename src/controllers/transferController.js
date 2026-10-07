const service = require('../services/transferService');
const { validateTransferBody, validateIdempotencyKey } = require('../validation/transferSchema');

async function create(req, res, next) {
  try {
    const body = validateTransferBody(req.body);
    const idempotencyKey = validateIdempotencyKey(req.get('Idempotency-Key'));
    const transfer = await service.createTransfer({ ...body, idempotencyKey });
    res.status(200).json({ success: true, reference: transfer.reference, status: transfer.status });
  } catch (error) { next(error); }
}

async function getByReference(req, res, next) {
  try { res.json(await service.getTransfer(req.params.reference)); } catch (error) { next(error); }
}

async function history(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'page must be >= 1 and limit must be between 1 and 100' } });
    }
    res.json(await service.getAccountTransactions(req.params.accountId, page, limit));
  } catch (error) { next(error); }
}

async function balance(req, res, next) {
  try { res.json(await service.getAccountBalance(req.params.accountId)); } catch (error) { next(error); }
}

module.exports = { create, getByReference, history, balance };
