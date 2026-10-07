const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data.error || { code: 'REQUEST_FAILED', message: 'Request failed' };
    throw new Error(`${error.code}: ${error.message}`);
  }
  return data;
}

function showResult(id, content, type = 'success') {
  const el = $(id);
  el.className = `result ${type}`;
  el.innerHTML = content;
}

function money(value, currency = '') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + (currency ? ` ${currency}` : '');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[c]);
}

$('transfer-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = $('send-btn');
  button.disabled = true;
  try {
    const key = $('idempotencyKey').value.trim() || `ui-${crypto.randomUUID()}`;
    const data = await api('/transfers', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({
        senderAccountId: $('senderAccountId').value.trim(),
        recipientAccountId: $('recipientAccountId').value.trim(),
        amount: Number($('amount').value)
      })
    });
    showResult('transfer-result', `<strong>Transfer successful</strong><br>Reference: <strong>${escapeHtml(data.reference)}</strong><br>Status: ${escapeHtml(data.status)}`);
    $('reference').value = data.reference;
  } catch (error) {
    showResult('transfer-result', `<strong>Transfer failed</strong><br>${escapeHtml(error.message)}`, 'error');
  } finally { button.disabled = false; }
});

$('balance-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api(`/accounts/${encodeURIComponent($('balanceAccountId').value.trim())}/balance`);
    showResult('balance-result', `<strong>${money(data.balance, data.currency)}</strong><br>Account: ${escapeHtml(data.accountId)}`);
  } catch (error) { showResult('balance-result', escapeHtml(error.message), 'error'); }
});

$('lookup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const data = await api(`/transfers/${encodeURIComponent($('reference').value.trim())}`);
    showResult('lookup-result', `<strong>${escapeHtml(data.status)}</strong><br>${money(data.amount, data.currency)}<br>${escapeHtml(data.senderAccountId)} → ${escapeHtml(data.recipientAccountId)}<br>${new Date(data.createdAt).toLocaleString()}`);
  } catch (error) { showResult('lookup-result', escapeHtml(error.message), 'error'); }
});

$('history-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const accountId = $('historyAccountId').value.trim();
    const limit = $('historyLimit').value;
    const data = await api(`/accounts/${encodeURIComponent(accountId)}/transactions?page=1&limit=${encodeURIComponent(limit)}`);
    if (!data.items?.length) {
      $('history-result').className = 'table-wrap';
      $('history-result').innerHTML = '<div class="result">No transactions found for this account.</div>';
      return;
    }
    $('history-result').className = 'table-wrap';
    $('history-result').innerHTML = `<table><thead><tr><th>Reference</th><th>Direction</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${data.items.map(tx => {
      const direction = tx.senderAccountId === accountId ? 'Sent' : 'Received';
      return `<tr><td>${escapeHtml(tx.reference)}</td><td>${direction}</td><td>${money(tx.amount, tx.currency)}</td><td class="status ${String(tx.status).toLowerCase()}">${escapeHtml(tx.status)}</td><td>${new Date(tx.createdAt).toLocaleString()}</td></tr>`;
    }).join('')}</tbody></table>`;
  } catch (error) {
    showResult('history-result', escapeHtml(error.message), 'error');
  }
});

(async function checkHealth() {
  try { await api('/health'); $('health').textContent = 'API online'; $('health').classList.add('ok'); }
  catch { $('health').textContent = 'API unavailable'; $('health').classList.add('bad'); }
})();
