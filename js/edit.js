import { AirtableError, createTransaction, getTransaction, updateTransaction } from './airtable.js';

const categoriesByType = new Map([
  ['收入', ['薪資', '獎金', '兼職', '投資收益', '其他收入']],
  ['支出', ['餐飲', '交通', '購物', '居住', '娛樂', '醫療', '教育', '其他支出']],
]);
const paymentMethods = ['現金', '刷卡', '銀行轉帳', '行動支付', '其他'];

const form = document.querySelector('#transaction-form');
const fieldset = document.querySelector('#transaction-fields');
const saveButton = document.querySelector('#save-transaction');
const cancel = document.querySelector('#cancel-transaction');
const loading = document.querySelector('#transaction-loading');
const loadingMessage = document.querySelector('#transaction-loading-message');
const feedback = document.querySelector('#transaction-feedback');
const title = document.querySelector('#title');
const date = document.querySelector('#date');
const amount = document.querySelector('#amount');
const type = document.querySelector('#type');
const category = document.querySelector('#category');
const payment = document.querySelector('#payment-method');
const note = document.querySelector('#note');
let saving = false;
let original = null;
const params = new URLSearchParams(location.search);
const recordId = params.get('id');
const isEditing = recordId !== null;

function todayInTaiwan() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function setError(input, message = '') {
  document.getElementById(`${input.id}-error`).textContent = message;
  input.classList.toggle('is-invalid', Boolean(message));
  if (message) input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
}

function refreshCategories() {
  const options = categoriesByType.get(type.value) ?? [];
  category.replaceChildren(new Option(options.length ? '請選擇' : '請先選擇收支類型', ''));
  for (const option of options) category.add(new Option(option, option));
  category.disabled = options.length === 0;
  setError(category);
}

function setSaving(value) {
  saving = value;
  fieldset.disabled = value;
  saveButton.disabled = value;
  loading.hidden = !value;
  loadingMessage.textContent = '正在儲存…';
  if (value) cancel.setAttribute('aria-disabled', 'true');
  else cancel.removeAttribute('aria-disabled');
}

function showFeedback(message, kind = 'danger') {
  feedback.className = `alert alert-${kind} mt-3 mb-0`;
  feedback.textContent = message;
  feedback.hidden = false;
}

const originMonth = params.get('month');
if (/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(originMonth ?? '')) {
  cancel.href = `./index.html?month=${originMonth}`;
}
type.addEventListener('change', refreshCategories);
cancel.addEventListener('click', (event) => { if (saving) event.preventDefault(); });

for (const input of [title, date, amount, type, category, payment]) {
  input.addEventListener('input', () => setError(input));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (saving || saveButton.disabled) return;
  feedback.hidden = true;

  const transaction = {
    Title: title.value.trim(), Date: date.value, Type: type.value,
    Category: category.value, Amount: amount.valueAsNumber, PaymentMethod: payment.value,
  };
  const errors = [
    [title, transaction.Title ? '' : '請輸入交易名稱。'],
    [date, date.validity.valid ? '' : '請輸入有效的交易日期。'],
    [type, categoriesByType.has(transaction.Type) ? '' : '請選擇收入或支出。'],
    [category, categoriesByType.get(transaction.Type)?.includes(transaction.Category) ? '' : '請選擇符合收支類型的分類。'],
    [amount, Number.isSafeInteger(transaction.Amount) && transaction.Amount > 0 ? '' : '請輸入大於零的整數金額。'],
    [payment, paymentMethods.includes(transaction.PaymentMethod) ? '' : '請選擇收付款方式。'],
  ];
  for (const [input, message] of errors) setError(input, message);
  const firstError = errors.find(([input, message]) => message && !input.disabled);
  if (firstError) {
    firstError[0].focus();
    return;
  }

  transaction.Note = note.value.trim();
  const changed = isEditing
    ? Object.fromEntries(Object.entries(transaction).filter(([key, value]) => value !== (original[key] ?? '')))
    : transaction;
  if (isEditing && Object.keys(changed).length === 0) {
    showFeedback('沒有需要儲存的變更。', 'info');
    return;
  }
  if (changed.Note === '') {
    if (isEditing) changed.Note = null;
    else delete changed.Note;
  }

  setSaving(true);
  try {
    if (isEditing) await updateTransaction(recordId, changed);
    else await createTransaction(changed);
  } catch (error) {
    showFeedback(error instanceof AirtableError ? error.message : '無法儲存記錄，請確認瀏覽器設定後再試。');
    setSaving(false);
    return;
  }
  const savedMonth = transaction.Date.slice(0, 7);
  try {
    sessionStorage.setItem(isEditing ? 'moneybook.updatedMonth' : 'moneybook.createdMonth', savedMonth);
  } catch {
    // 無法暫存成功提示時，仍導回月明細。
  }
  location.replace(`./index.html?month=${savedMonth}`);
});

async function initializeForm() {
  if (!isEditing) {
    date.value = todayInTaiwan();
    refreshCategories();
    setSaving(false);
    return;
  }

  document.querySelector('#edit-heading').textContent = '編輯記錄';
  document.title = '編輯記錄｜MoneyBook';
  loadingMessage.textContent = '正在載入交易…';
  loading.hidden = false;
  try {
    original = await getTransaction(recordId);
    title.value = original.Title ?? '';
    date.value = original.Date ?? '';
    amount.value = original.Amount ?? '';
    type.value = original.Type ?? '';
    refreshCategories();
    category.value = original.Category ?? '';
    payment.value = original.PaymentMethod ?? '';
    note.value = original.Note ?? '';
    setSaving(false);
  } catch (error) {
    loading.hidden = true;
    showFeedback(error instanceof AirtableError ? error.message : '無法載入這筆交易。');
  }
}

initializeForm();
