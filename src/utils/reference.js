const crypto = require('crypto');

function createReference() {
  return `TRX-${crypto.randomUUID().replace(/-/g, '').slice(0, 24).toUpperCase()}`;
}

module.exports = { createReference };
