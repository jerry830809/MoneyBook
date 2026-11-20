import { AirtableError, listTransactionsByMonth } from './airtable.js';
import { readSettings } from './common.js';

const monthFormatter = new Intl.DateTimeFormat('zh-TW', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit',
});
const numberFormatter = new Intl.NumberFormat('zh-TW');
const percentFormatter = new Intl.NumberFormat('zh-TW', { style: 'percent', maximumFractionDigits: 1 });
const colors = ['#14675b', '#2468a2', '#b74738', '#875195', '#8a5c12', '#416e37', '#6c5bb2', '#ad4275'];

const monthPicker = document.querySelector('#month-picker');
const previousMonth = document.querySelector('#previous-month');
const nextMonth = document.querySelector('#next-month');
const monthLabel = document.querySelector('#month-label');
const monthLinks = Array.from(document.querySelectorAll('a[href="./index.html"], a[href="./edit.html"]'),
  (link) => [link, link.getAttribute('href')]);
const loading = document.querySelector('#stats-loading');
const errorPanel = document.querySelector('#stats-error');
const retry = document.querySelector('#stats-retry');
const content = document.querySelector('#stats-content');
const categoryCanvas = document.querySelector('#category-chart');
const totalsCanvas = document.querySelector('#totals-chart');
const categoryWrap = document.querySelector('#category-chart-wrap');
const totalsWrap = document.querySelector('#totals-chart-wrap');
const chartWarning = document.querySelector('#chart-warning');
let categoryChart;
let totalsChart;
let requestInProgress = false;

function isMonth(value) {
  return /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value ?? '');
}

function getSelectedMonth() {
  const requested = new URLSearchParams(location.search).get('month');
  if (isMonth(requested)) return requested;
  const parts = Object.fromEntries(monthFormatter.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}`;
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

function formatAmount(value) {
  return `NT$${numberFormatter.format(value)}`;
}

function summarize(records) {
  let income = 0;
  let expense = 0;
  const categories = new Map();

  for (const { fields } of records) {
    if (!Number.isSafeInteger(fields?.Amount) || fields.Amount <= 0 || !['收入', '支出'].includes(fields.Type)) {
      throw new AirtableError('本月有紀錄的類型或金額不符合規格，請檢查 Airtable 資料。');
    }
    if (fields.Type === '收入') {
      income += fields.Amount;
    } else {
      expense += fields.Amount;
      const category = fields.Category || '未分類';
      categories.set(category, (categories.get(category) ?? 0) + fields.Amount);
    }
  }

  const ordered = Array.from(categories).sort(([firstName, firstAmount], [secondName, secondAmount]) =>
    secondAmount - firstAmount || firstName.localeCompare(secondName, 'zh-TW'));
  return { income, expense, categories: ordered };
}

function renderNumbers({ income, expense, categories }) {
  document.querySelector('#stats-income').textContent = formatAmount(income);
  document.querySelector('#stats-expense').textContent = formatAmount(expense);
  document.querySelector('#no-expenses').hidden = categories.length > 0;
  document.querySelector('#categories-wrap').hidden = categories.length === 0;
  const rows = document.createDocumentFragment();
  categories.forEach(([name, amount], index) => {
    const row = document.createElement('tr');
    const heading = document.createElement('th');
    heading.scope = 'row';
    const marker = document.createElement('span');
    marker.className = 'd-inline-block rounded-circle p-1 me-2';
    marker.style.backgroundColor = colors[index % colors.length];
    marker.setAttribute('aria-hidden', 'true');
    heading.append(marker, name);
    row.append(heading);
    for (const value of [formatAmount(amount), percentFormatter.format(amount / expense)]) {
      const cell = row.insertCell();
      cell.className = 'text-end text-nowrap';
      cell.textContent = value;
    }
    rows.append(row);
  });
  document.querySelector('#category-totals').replaceChildren(rows);
}

function renderCharts({ income, expense, categories }) {
  categoryChart?.destroy();
  totalsChart?.destroy();
  categoryChart = undefined;
  totalsChart = undefined;
  categoryWrap.hidden = true;
  totalsWrap.hidden = true;

  try {
    const Chart = window.Chart;
    if (typeof Chart !== 'function') throw new Error('Chart.js 無法載入。');
    totalsWrap.hidden = false;
    totalsChart = new Chart(totalsCanvas, {
      type: 'bar',
      data: {
        labels: ['收入', '支出'],
        datasets: [{ data: [income, expense], backgroundColor: ['#14675b', '#b74738'], borderRadius: 4, maxBarThickness: 64 }],
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ({ raw }) => formatAmount(raw) } } },
        scales: { y: { beginAtZero: true, suggestedMax: 1, ticks: { precision: 0, callback: formatAmount } } },
      },
    });

    if (categories.length) {
      categoryWrap.hidden = false;
      categoryChart = new Chart(categoryCanvas, {
        type: 'pie',
        data: {
          labels: categories.map(([name]) => name),
          datasets: [{ data: categories.map(([, amount]) => amount), backgroundColor: categories.map((_, index) => colors[index % colors.length]) }],
        },
        options: {
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ({ label, raw }) => `${label} ${formatAmount(raw)}（${percentFormatter.format(raw / expense)}）` } },
          },
        },
      });
    }
  } catch {
    chartWarning.hidden = false;
    if (!categoryChart) categoryWrap.hidden = true;
    if (!totalsChart) totalsWrap.hidden = true;
  }
}

function showLoading() {
  loading.hidden = false;
  errorPanel.hidden = true;
  chartWarning.hidden = true;
  content.hidden = true;
  retry.disabled = true;
}

async function loadMonth() {
  if (requestInProgress) return;
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
    if (requestedMonth === selectedMonth) {
      const summary = summarize(records);
      renderNumbers(summary);
      content.hidden = false;
      renderCharts(summary);
    }
  } catch (error) {
    if (requestedMonth === selectedMonth) {
      document.querySelector('#stats-error-message').textContent = error instanceof AirtableError
        ? error.message : '無法載入統計，請稍後重試。';
      content.hidden = true;
      errorPanel.hidden = false;
    }
  } finally {
    requestInProgress = false;
    if (requestedMonth !== selectedMonth) loadMonth();
    else {
      loading.hidden = true;
      retry.disabled = false;
    }
  }
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
