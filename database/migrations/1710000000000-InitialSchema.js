const { Table, TableForeignKey, TableIndex } = require('typeorm');

module.exports = class InitialSchema1710000000000 {
  name = 'InitialSchema1710000000000';

  async up(queryRunner) {
    await queryRunner.createTable(new Table({
      name: 'users',
      columns: [
        { name: 'id', type: 'char', length: '36', isPrimary: true },
        { name: 'name', type: 'varchar', length: '150' },
        { name: 'email', type: 'varchar', length: '255', isUnique: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }
      ]
    }));

    await queryRunner.createTable(new Table({
      name: 'accounts',
      columns: [
        { name: 'id', type: 'char', length: '36', isPrimary: true },
        { name: 'user_id', type: 'char', length: '36' },
        { name: 'account_number', type: 'varchar', length: '30', isUnique: true },
        { name: 'balance', type: 'decimal', precision: 19, scale: 2 },
        { name: 'currency', type: 'char', length: '3' },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }
      ]
    }));
    await queryRunner.createIndex('accounts', new TableIndex({ name: 'idx_accounts_user_id', columnNames: ['user_id'] }));
    await queryRunner.createForeignKey('accounts', new TableForeignKey({
      name: 'fk_accounts_user', columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'RESTRICT', onUpdate: 'CASCADE'
    }));

    await queryRunner.createTable(new Table({
      name: 'transactions',
      columns: [
        { name: 'id', type: 'char', length: '36', isPrimary: true },
        { name: 'reference', type: 'varchar', length: '40', isUnique: true },
        { name: 'sender_account_id', type: 'char', length: '36' },
        { name: 'recipient_account_id', type: 'char', length: '36' },
        { name: 'amount', type: 'decimal', precision: 19, scale: 2 },
        { name: 'currency', type: 'char', length: '3' },
        { name: 'status', type: 'enum', enum: ['SUCCESS', 'FAILED'], default: "'SUCCESS'" },
        { name: 'idempotency_key', type: 'varchar', length: '255', isNullable: true, isUnique: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }
      ]
    }));
    await queryRunner.createIndex('transactions', new TableIndex({ name: 'idx_transactions_sender', columnNames: ['sender_account_id'] }));
    await queryRunner.createIndex('transactions', new TableIndex({ name: 'idx_transactions_recipient', columnNames: ['recipient_account_id'] }));
    await queryRunner.createIndex('transactions', new TableIndex({ name: 'idx_transactions_created_at', columnNames: ['created_at'] }));
    await queryRunner.createForeignKey('transactions', new TableForeignKey({
      name: 'fk_transactions_sender', columnNames: ['sender_account_id'], referencedTableName: 'accounts', referencedColumnNames: ['id'], onDelete: 'RESTRICT', onUpdate: 'CASCADE'
    }));
    await queryRunner.createForeignKey('transactions', new TableForeignKey({
      name: 'fk_transactions_recipient', columnNames: ['recipient_account_id'], referencedTableName: 'accounts', referencedColumnNames: ['id'], onDelete: 'RESTRICT', onUpdate: 'CASCADE'
    }));
  }

  async down(queryRunner) {
    await queryRunner.dropTable('transactions', true, true, true);
    await queryRunner.dropTable('accounts', true, true, true);
    await queryRunner.dropTable('users', true, true, true);
  }
};
