const crypto = require('crypto');
const AppDataSource = require('../config/dataSource');
const { createReference } = require('../utils/reference');
const { AppError, errors } = require('../utils/errors');

function isDuplicateKey(error) {
  return error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062);
}

function toTransferResponse(t) {
  return {
    reference: t.reference,
    senderAccountId: t.senderAccountId,
    recipientAccountId: t.recipientAccountId,
    amount: Number(t.amount),
    currency: t.currency,
    status: t.status,
    createdAt: new Date(t.createdAt).toISOString()
  };
}

async function findByReference(reference) {
  const repo = AppDataSource.getRepository('Transfer');
  return repo.findOne({ where: { reference } });
}

async function createTransfer({ senderAccountId, recipientAccountId, amount, idempotencyKey }) {
  const transferRepo = AppDataSource.getRepository('Transfer');
  const reference = createReference();
  const transferId = crypto.randomUUID();

  // Idempotency lookup outside the transaction handles the common retry path.
  if (idempotencyKey) {
    const existing = await transferRepo.findOne({ where: { idempotencyKey } });
    if (existing) return toTransferResponse(existing);
  }

  try {
    const result = await AppDataSource.transaction('READ COMMITTED', async (manager) => {
      const accountRepo = manager.getRepository('Account');
      const txRepo = manager.getRepository('Transfer');

      // Lock both rows in deterministic id order to prevent double-spending and reduce deadlocks.
      const ids = [senderAccountId, recipientAccountId].sort();
      const locked = await accountRepo
        .createQueryBuilder('account')
        .where('account.id IN (:...ids)', { ids })
        .orderBy('account.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      const sender = locked.find((a) => a.id === senderAccountId);
      const recipient = locked.find((a) => a.id === recipientAccountId);
      if (!sender || !recipient) throw errors.notFound();
      if (sender.currency !== recipient.currency) throw errors.currency();
      if (Number(sender.balance) < Number(amount)) throw errors.insufficient();

      const transfer = txRepo.create({
        id: transferId,
        reference,
        senderAccountId,
        recipientAccountId,
        amount,
        currency: sender.currency,
        status: 'SUCCESS',
        idempotencyKey
      });
      await txRepo.save(transfer);

      await accountRepo
        .createQueryBuilder()
        .update('accounts')
        .set({ balance: () => `balance - ${Number(amount).toFixed(2)}` })
        .where('id = :id', { id: senderAccountId })
        .execute();

      if (process.env.TEST_FAIL_AFTER_DEBIT === 'true') {
        throw new Error('Injected failure after sender debit');
      }

      await accountRepo
        .createQueryBuilder()
        .update('accounts')
        .set({ balance: () => `balance + ${Number(amount).toFixed(2)}` })
        .where('id = :id', { id: recipientAccountId })
        .execute();

      return transfer;
    });

    return toTransferResponse(result);
  } catch (error) {
    if (isDuplicateKey(error) && idempotencyKey) {
      const existing = await transferRepo.findOne({ where: { idempotencyKey } });
      if (existing) return toTransferResponse(existing);
    }
    if (error.code && error.status) throw error;
    throw errors.failed(error.message === 'Injected failure after sender debit' ? 'Injected transfer failure' : 'Unable to complete transfer');
  }
}

async function getTransfer(reference) {
  const transfer = await findByReference(reference);
  if (!transfer) throw new AppError(404, 'TRANSFER_NOT_FOUND', 'Transfer not found');
  return toTransferResponse(transfer);
}

async function getAccountTransactions(accountId, page = 1, limit = 20) {
  const repo = AppDataSource.getRepository('Transfer');
  const skip = (page - 1) * limit;
  const [items, total] = await repo.findAndCount({
    where: [{ senderAccountId: accountId }, { recipientAccountId: accountId }],
    order: { createdAt: 'DESC' },
    skip,
    take: limit
  });
  return { page, limit, total, items: items.map(toTransferResponse) };
}

async function getAccountBalance(accountId) {
  const account = await AppDataSource.getRepository('Account').findOne({ where: { id: accountId } });
  if (!account) throw errors.notFound();
  return { accountId: account.id, balance: Number(account.balance), currency: account.currency };
}

module.exports = { createTransfer, getTransfer, getAccountTransactions, getAccountBalance, toTransferResponse };
