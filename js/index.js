import { AirtableError, deleteTransaction, isTransactionId, listTransactionsByMonth } from './airtable.js';
import { readSettings } from './common.js';

const monthFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit',
});
const dateFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
});
const numberFormatter = new Intl.NumberFormat('zh-TW');

const loading = document.querySelector('#transactions-loading');
const errorPanel = document.querySelector('#transactions-error');
const status = document.querySelector('#transactions-status');
const table = document.querySelector('#transactions-table');
const tableBody = document.querySelector('#transactions-body');
const retry = document.querySelector('#transactions-retry');
const monthPicker = document.querySelector('#month-picker');
const monthLabel = document.querySelector('#month-label');
const previousMonth = document.querySelector('#previous-month');
const nextMonth = document.querySelector('#next-month');
const incomeTotal = document.querySelector('#income-total');
const expenseTotal = document.querySelector('#expense-total');
const balance = document.querySelector('#balance');
const notice = document.querySelector('#transaction-notice');
const deleteDialog = document.querySelector('#delete-modal');
const deleteSummary = document.querySelector('#delete-summary');
const deleteError = document.querySelector('#delete-error');
const deleteLoading = document.querySelector('#delete-loading');
const cancelDelete = document.querySelector('#cancel-delete');
const confirmDelete = document.querySelector('#confirm-delete');
const monthLinks = Array.from(document.querySelectorAll('a[href="./edit.html"], a[href="./stats.html"]'),
  (link) => [link, link.getAttribute('href')]);
let requestInProgress = false;
let visibleRecords = [];
const deletedIds = new Set();
let deleteModal;
let deleteTarget;
let deleting = false;

function isMonth(value) {
  return /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value ?? '');
}

function getSelectedMonth() {
  const requested = new URLSearchParams(location.search).get('month');
  if (isMonth(requested)) return requested;

  const parts = monthFormatter.formatToParts(new Date());
  const year = parts.find(({ type }) => type === 'year').value;
  const month = parts.find(({ type }) => type === 'month').value;
  return `${year}-${month}`;
}

let selectedMonth = getSelectedMonth();

function updateMonthControls() {
  monthPicker.value = selectedMonth;
  monthPicker.disabled = false;
  previousMonth.disabled = selectedMonth === '0001-01';
  nextMonth.disabled = selectedMonth === '9999-12';
  monthLabel.textContent = monthFormatter.format(new Date(`${selectedMonth}-01T12:00:00Z`));
  for (const [link, path] of monthLinks) link.href = `${path}?month=${selectedMonth}`;
}

function showNotice(message, kind = 'success') {
  notice.className = `alert alert-${kind}`;
  notice.textContent = message;
  notice.hidden = false;
}

try {
  for (const [key, message] of [
    ['moneybook.updatedMonth', '已更新交易記錄。'],
    ['moneybook.createdMonth', '已新增交易記錄。'],
  ]) {
    if (sessionStorage.getItem(key) === selectedMonth) {
      sessionStorage.removeItem(key);
      showNotice(message);
      break;
    }
  }
} catch {
  // 成功提示的暫存無法讀取時，仍載入月明細。
}

function formatAmount(value) {
  return `${value < 0 ? '-' : ''}NT$${numberFormatter.format(Math.abs(value))}`;
}

function appendActions(row, id, fields) {
  const cell = row.insertCell();
  cell.className = 'text-nowrap';
  if (!isTransactionId(id)) {
    cell.textContent = '—';
    return;
  }

  const edit = document.createElement('a');
  edit.className = 'btn btn-sm btn-outline-secondary me-2';
  edit.href = `./edit.html?id=${id}&month=${selectedMonth}`;
  edit.textContent = '編輯';
  const remove = document.createElement('button');
  remove.className = 'btn btn-sm btn-outline-danger';
  remove.type = 'button';
  remove.textContent = '刪除';
  remove.addEventListener('click', () => {
    if (!window.bootstrap?.Modal) {
      showNotice('無法開啟刪除確認視窗，請重新載入頁面後再試。', 'danger');
      return;
    }
    deleteModal ??= window.bootstrap.Modal.getOrCreateInstance(deleteDialog);
    deleteTarget = { id, month: selectedMonth, button: remove };
    deleteSummary.textContent = `${fields.Title || '未命名交易'}（${formatAmount(fields.Amount)}）`;
    deleteError.hidden = true;
    deleteModal.show();
  });
  cell.append(edit, remove);
}

function renderTransactions(records) {
  const currentRecords = records.filter(({ id }) => !deletedIds.has(id));
  let income = 0;
  let expense = 0;
  const rows = document.createDocumentFragment();

  for (const { id, fields } of currentRecords) {
    const date = new Date(`${fields?.Date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || !Number.isSafeInteger(fields?.Amount) || fields.Amount <= 0 || !['收入', '支出'].includes(fields.Type)) {
      throw new AirtableError('本月有紀錄的日期、類型或金額不符合規格，請檢查 Airtable 資料。');
    }

    const isIncome = fields.Type === '收入';
    if (isIncome) income += fields.Amount;
    else expense += fields.Amount;

    const row = document.createElement('tr');
    for (const [value, className] of [
      [dateFormatter.format(date), 'text-nowrap'],
      [fields.Title],
      [fields.Type, isIncome ? 'text-success text-nowrap' : 'text-danger text-nowrap'],
      [fields.Category, 'text-nowrap'],
      [fields.PaymentMethod, 'text-nowrap'],
      [formatAmount(fields.Amount), 'text-end text-nowrap'],
      [fields.Note],
    ]) {
      const cell = row.insertCell();
      cell.textContent = value || '—';
      if (className) cell.className = className;
    }
    appendActions(row, id, fields);
    rows.append(row);
  }

  incomeTotal.textContent = formatAmount(income);
  expenseTotal.textContent = formatAmount(expense);
  balance.textContent = formatAmount(income - expense);
  tableBody.replaceChildren(rows);
  visibleRecords = currentRecords;
  table.hidden = currentRecords.length === 0;
  status.textContent = currentRecords.length ? `共 ${numberFormatter.format(currentRecords.length)} 筆紀錄` : '本月沒有收支紀錄。';
}

deleteDialog.addEventListener('shown.bs.modal', () => cancelDelete.focus());
deleteDialog.addEventListener('hide.bs.modal', (event) => { if (deleting) event.preventDefault(); });
deleteDialog.addEventListener('hidden.bs.modal', () => {
  if (deleteTarget?.button.isConnected && !table.hidden) deleteTarget.button.focus();
  else document.querySelector('#details-heading').focus();
  deleteTarget = undefined;
});

confirmDelete.addEventListener('click', async () => {
  if (!deleteTarget || deleting) return;
  const { id, month } = deleteTarget;
  deleting = true;
  confirmDelete.disabled = true;
  cancelDelete.disabled = true;
  deleteLoading.hidden = false;
  deleteError.hidden = true;
  try {
    await deleteTransaction(id);
  } catch (error) {
    deleteError.textContent = error instanceof AirtableError ? error.message : '無法刪除這筆交易，請稍後再試。';
    deleteError.hidden = false;
    return;
  } finally {
    deleting = false;
    confirmDelete.disabled = false;
    cancelDelete.disabled = false;
    deleteLoading.hidden = true;
  }

  deletedIds.add(id);
  if (selectedMonth === month && !table.hidden) renderTransactions(visibleRecords);
  showNotice('已刪除交易記錄。');
  deleteModal.hide();
});

async function loadMonth() {
  if (requestInProgress) return;
  // 切換月份時也檢查設定，處理在別的分頁清除設定的情況。
  let settings;
  try {
    settings = readSettings();
  } catch { /* 無法讀取設定時，導向設定頁。 */ }
  if (!settings?.token || !settings.baseId) {
    location.replace('./settings.html');
    return;
  }

  const requestedMonth = selectedMonth;
  requestInProgress = true;
  showLoading();
  try {
    const records = await listTransactionsByMonth(requestedMonth);
    if (requestedMonth === selectedMonth) renderTransactions(records);
  } catch (error) {
    if (requestedMonth === selectedMonth) {
      document.querySelector('#transactions-error-message').textContent = error instanceof AirtableError
        ? error.message
        : '無法載入本月收支，請稍後重試。';
      errorPanel.hidden = false;
    }
  } finally {
    requestInProgress = false;
    if (requestedMonth !== selectedMonth) {
      loadMonth();
    } else {
      loading.hidden = true;
      retry.disabled = false;
    }
  }
}

function showLoading() {
  loading.hidden = false;
  errorPanel.hidden = true;
  retry.disabled = true;
  table.hidden = true;
  status.textContent = '';
  for (const total of [incomeTotal, expenseTotal, balance]) total.textContent = '—';
}

function selectMonth(month, updateHistory = true) {
  if (!isMonth(month) || month === selectedMonth) {
    monthPicker.value = selectedMonth;
    return;
  }
  if (updateHistory) {
    const url = new URL(location.href);
    url.searchParams.set('month', month);
    history.pushState(null, '', url);
  }
  selectedMonth = month;
  notice.hidden = true;
  if (!deleting) deleteModal?.hide();
  updateMonthControls();
  if (requestInProgress) showLoading();
  else loadMonth();
}

function moveMonth(direction) {
  const date = new Date(`${selectedMonth}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + direction);
  selectMonth(date.toISOString().slice(0, 7));
}

previousMonth.addEventListener('click', () => moveMonth(-1));
nextMonth.addEventListener('click', () => moveMonth(1));
monthPicker.addEventListener('change', () => selectMonth(monthPicker.value));
window.addEventListener('popstate', () => selectMonth(getSelectedMonth(), false));
retry.addEventListener('click', loadMonth);
updateMonthControls();
loadMonth();
