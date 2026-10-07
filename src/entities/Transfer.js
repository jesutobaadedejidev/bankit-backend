const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Transfer',
  tableName: 'transactions',
  columns: {
    id: { type: 'char', length: 36, primary: true },
    reference: { type: 'varchar', length: 40, unique: true },
    senderAccountId: { name: 'sender_account_id', type: 'char', length: 36 },
    recipientAccountId: { name: 'recipient_account_id', type: 'char', length: 36 },
    amount: { type: 'decimal', precision: 19, scale: 2 },
    currency: { type: 'char', length: 3 },
    status: { type: 'enum', enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' },
    idempotencyKey: { name: 'idempotency_key', type: 'varchar', length: 255, nullable: true, unique: true },
    createdAt: { name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }
  },
  indices: [
    { name: 'idx_transactions_sender', columns: ['senderAccountId'] },
    { name: 'idx_transactions_recipient', columns: ['recipientAccountId'] },
    { name: 'idx_transactions_created_at', columns: ['createdAt'] }
  ]
});
