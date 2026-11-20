import { clearSettings, readSettings, writeSettings } from './common.js';

const form = document.querySelector('#settings-form');
const tokenInput = document.querySelector('#token');
const baseIdInput = document.querySelector('#base-id');
const tokenHint = document.querySelector('#token-hint');
const status = document.querySelector('#settings-state');
const feedback = document.querySelector('#settings-feedback');
const clearButton = document.querySelector('#clear-settings');

function showFeedback(message, type) {
  feedback.className = `alert alert-${type} settings-feedback`;
  feedback.hidden = false;
  feedback.textContent = message;
}

function setError(input, message = '') {
  document.getElementById(`${input.id}-error`).textContent = message;
  input.classList.toggle('is-invalid', Boolean(message));
  if (message) {
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
}

function refreshForm({ token, baseId }) {
  const configured = Boolean(token && baseId);
  status.textContent = configured ? '已儲存設定' : '尚未完成設定';
  status.dataset.configured = String(configured);
  tokenInput.value = '';
  tokenInput.required = !token;
  tokenHint.textContent = token ? '已儲存權杖。留空會沿用原設定。' : '輸入個人存取權杖。';
  baseIdInput.value = baseId;
  clearButton.disabled = !(token || baseId);
  setError(tokenInput);
  setError(baseIdInput);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  feedback.hidden = true;

  try {
    const stored = readSettings();
    const token = tokenInput.value.trim() || stored.token;
    const baseId = baseIdInput.value.trim();
    const tokenError = !token ? '請輸入 Airtable 權杖。' : /\s/.test(token) ? '權杖不能包含空白。' : '';
    const baseIdError = /^app[A-Za-z0-9]{14}$/.test(baseId) ? '' : '請輸入以 app 開頭、共 17 個英數字元的 Base ID。';
    setError(tokenInput, tokenError);
    setError(baseIdInput, baseIdError);
    if (tokenError || baseIdError) {
      (tokenError ? tokenInput : baseIdInput).focus();
      return;
    }

    writeSettings(token, baseId);
    refreshForm({ token, baseId });
    showFeedback('已儲存於此瀏覽器。尚未驗證 Airtable 連線。', 'success');
  } catch {
    showFeedback('無法儲存設定。請確認瀏覽器允許此網站使用本機儲存空間。', 'danger');
  }
});

clearButton.addEventListener('click', () => {
  try {
    clearSettings();
    refreshForm({ token: '', baseId: '' });
    tokenInput.focus();
    showFeedback('已清除此瀏覽器的 Airtable 設定。', 'success');
  } catch {
    showFeedback('無法清除設定。請確認瀏覽器允許此網站使用本機儲存空間。', 'danger');
  }
});

for (const input of [tokenInput, baseIdInput]) {
  input.addEventListener('input', () => setError(input));
}

try {
  refreshForm(readSettings());
} catch {
  showFeedback('無法讀取此瀏覽器的本機儲存空間。', 'danger');
}
