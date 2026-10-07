function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  const code = err.code && typeof err.code === 'string' && /^[A-Z_]+$/.test(err.code) ? err.code : 'TRANSFER_FAILED';
  const message = status >= 500 ? (err.status ? err.message : 'Internal server error') : err.message;
  res.status(status).json({ success: false, error: { code, message } });
}

module.exports = errorHandler;
