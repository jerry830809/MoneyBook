import { readSettings } from './common.js';

const requestIntervalMs = 220;
const rateLimitCooldownMs = 30_000;
const rateLimitMessage = '請求過於頻繁，請等待 30 秒後再試。';
const readUnavailable = '暫時無法讀取 Airtable 資料，請稍後重試。';
const saveUnconfirmed = '無法確認是否已儲存，請先到月明細確認是否已有這筆記錄，再決定是否重試。';
const deleteUnconfirmed = '無法確認是否已刪除，請重新載入月明細確認。';
let nextRequestAt = 0;
let rateLimitedUntil = 0;

export class AirtableError extends Error {}

const errorMessages = new Map([
  [401, 'Airtable 驗證失敗，請到設定頁確認權杖。'],
  [404, '找不到 Airtable 資料庫或 Transactions 資料表，請檢查設定。'],
  [429, rateLimitMessage],
]);

export function isTransactionId(id) {
  return /^rec[A-Za-z0-9]{14}$/.test(id ?? '');
}

function transactionConnection(id) {
  const { token, baseId } = readSettings();
  if (!token || !baseId) throw new AirtableError('請先完成 Airtable 設定。');
  if (id !== undefined && !isTransactionId(id)) throw new AirtableError('無效的交易紀錄識別碼。');
  const path = id === undefined ? 'Transactions' : `Transactions/${id}`;
  return { token, url: new URL(`https://api.airtable.com/v0/${encodeURIComponent(baseId)}/${path}`) };
}

async function requestTransactions(url, token, { method = 'GET', body } = {}) {
  const isSave = method === 'POST' || method === 'PATCH';
  const unavailableMessage = method === 'DELETE' ? deleteUnconfirmed : isSave ? saveUnconfirmed : readUnavailable;
  if (Date.now() < rateLimitedUntil) throw new AirtableError(rateLimitMessage);

  // 請求至少間隔 220 毫秒，避免超過每個 Base 的每秒請求限制。
  const scheduledAt = Math.max(Date.now(), nextRequestAt);
  nextRequestAt = scheduledAt + requestIntervalMs;
  const delay = scheduledAt - Date.now();
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  if (Date.now() < rateLimitedUntil) throw new AirtableError(rateLimitMessage);

  const response = await fetch(url, {
    method,
    headers: body !== undefined
      ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    redirect: 'error',
  }).catch(() => { throw new AirtableError(unavailableMessage); });

  if (response.status === 429) rateLimitedUntil = Date.now() + rateLimitCooldownMs;
  if (!response.ok) {
    let message = errorMessages.get(response.status) ?? unavailableMessage;
    if (response.status === 403) {
      const operation = { GET: '讀取', POST: '新增', PATCH: '編輯', DELETE: '刪除' }[method];
      message = `沒有${operation}權限，請確認 Airtable 權杖的權限。`;
    }
    if (response.status === 404 && isTransactionId(url.pathname.split('/').pop())) {
      message = '找不到這筆交易，請重新載入月明細確認。';
    }
    if (response.status === 422) message = isSave
      ? 'Airtable 拒絕儲存，請確認交易欄位與分類選項符合資料表設定。'
      : method === 'DELETE' ? 'Airtable 拒絕刪除這筆交易。' : 'Airtable 無法處理查詢，請確認 Transactions 的欄位名稱與型別。';
    throw new AirtableError(message);
  }
  return response.json().catch(() => { throw new AirtableError(unavailableMessage); });
}

export async function listTransactionsByMonth(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AirtableError('月份格式有誤。');

  const { url, token } = transactionConnection();
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('filterByFormula', `IF({Date}, DATETIME_FORMAT({Date}, 'YYYY-MM') = '${month}', 0)`);
  url.searchParams.set('sort[0][field]', 'Date');
  url.searchParams.set('sort[0][direction]', 'desc');
  url.searchParams.set('sort[1][field]', 'CreatedAt');
  url.searchParams.set('sort[1][direction]', 'desc');
  for (const name of ['Title', 'Date', 'Type', 'Category', 'Amount', 'PaymentMethod', 'Note']) {
    url.searchParams.append('fields[]', name);
  }

  const transactions = [];
  const seenOffsets = new Set();
  let offset;
  do {
    const page = await requestTransactions(url, token);
    if (!Array.isArray(page?.records) || (page.offset != null && typeof page.offset !== 'string')) {
      throw new AirtableError(readUnavailable);
    }
    transactions.push(...page.records);
    offset = page.offset;
    if (offset) {
      if (seenOffsets.has(offset)) throw new AirtableError(readUnavailable);
      seenOffsets.add(offset);
      url.searchParams.set('offset', offset);
    }
  } while (offset);

  return transactions;
}

export async function createTransaction(fields) {
  const { url, token } = transactionConnection();
  const result = await requestTransactions(url, token, { method: 'POST', body: { records: [{ fields }], typecast: false } });
  if (typeof result?.records?.[0]?.id !== 'string') throw new AirtableError(saveUnconfirmed);
}

export async function getTransaction(id) {
  const { url, token } = transactionConnection(id);
  const result = await requestTransactions(url, token);
  if (result?.id !== id || !result.fields || typeof result.fields !== 'object') throw new AirtableError(readUnavailable);
  return result.fields;
}

export async function updateTransaction(id, fields) {
  const { url, token } = transactionConnection(id);
  const result = await requestTransactions(url, token, { method: 'PATCH', body: { fields, typecast: false } });
  if (result?.id !== id) throw new AirtableError(saveUnconfirmed);
}

export async function deleteTransaction(id) {
  const { url, token } = transactionConnection(id);
  const result = await requestTransactions(url, token, { method: 'DELETE' });
  if (result?.id !== id || result.deleted !== true) throw new AirtableError(deleteUnconfirmed);
}
