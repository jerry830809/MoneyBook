const tokenKey = 'moneybook.token';
const baseIdKey = 'moneybook.baseId';

export function readSettings() {
  return {
    token: localStorage.getItem(tokenKey) ?? '',
    baseId: localStorage.getItem(baseIdKey) ?? '',
  };
}

export function writeSettings(token, baseId) {
  const previousBaseId = localStorage.getItem(baseIdKey);
  localStorage.setItem(baseIdKey, baseId);

  try {
    localStorage.setItem(tokenKey, token);
  } catch (error) {
    // 權杖寫入失敗時還原資料庫識別碼，避免兩個設定不一致。
    if (previousBaseId === null) {
      localStorage.removeItem(baseIdKey);
    } else {
      localStorage.setItem(baseIdKey, previousBaseId);
    }
    throw error;
  }
}

export function clearSettings() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem(baseIdKey);
}

function addNavigation() {
  const header = document.createElement('header');
  header.className = 'site-header';
  const nav = document.createElement('nav');
  nav.className = 'navbar site-nav justify-content-start';
  nav.setAttribute('aria-label', '主要導覽');

  const brand = document.createElement('a');
  brand.className = 'site-brand';
  brand.href = './index.html';
  brand.textContent = 'MoneyBook';

  const links = document.createElement('div');
  links.className = 'nav';
  const pages = [
    ['index.html', '月明細'],
    ['edit.html', '記帳'],
    ['stats.html', '統計'],
    ['settings.html', '設定'],
  ];
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  for (const [file, label] of pages) {
    const link = document.createElement('a');
    link.className = 'nav-link';
    link.href = `./${file}`;
    link.textContent = label;
    if (file === currentPage) link.setAttribute('aria-current', 'page');
    links.append(link);
  }
  nav.append(brand, links);
  header.append(nav);
  document.body.prepend(header);
}

addNavigation();

if (document.body.hasAttribute('data-requires-settings')) {
  let configured = false;
  try {
    const { token, baseId } = readSettings();
    configured = Boolean(token && baseId);
  } catch {
    // 無法讀取瀏覽器儲存空間時，交由設定頁顯示原因。
  }
  if (!configured) location.replace('./settings.html');
}
