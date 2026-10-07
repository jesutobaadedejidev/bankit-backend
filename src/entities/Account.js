const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Account',
  tableName: 'accounts',
  columns: {
    id: { type: 'char', length: 36, primary: true },
    userId: { name: 'user_id', type: 'char', length: 36 },
    accountNumber: { name: 'account_number', type: 'varchar', length: 30, unique: true },
    balance: { type: 'decimal', precision: 19, scale: 2 },
    currency: { type: 'char', length: 3 },
    createdAt: { name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }
  },
  relations: {
    user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'user_id' } }
  },
  indices: [
    { name: 'idx_accounts_user_id', columns: ['userId'] }
  ]
});
