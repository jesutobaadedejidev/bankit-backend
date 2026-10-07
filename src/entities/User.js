const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'User',
  tableName: 'users',
  columns: {
    id: { type: 'char', length: 36, primary: true },
    name: { type: 'varchar', length: 150 },
    email: { type: 'varchar', length: 255, unique: true },
    createdAt: { name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }
  },
  relations: {
    accounts: { type: 'one-to-many', target: 'Account', inverseSide: 'user' }
  }
});
