import {
  getAction,
  postAction,
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  getAdminAlias,
  setAdminAlias
} from './api.js';
import {
  ALL_STATUSES,
  BUSINESS_PRIORITIES,
  CATEGORIES,
  REJECTED_REASONS,
  SLA_FILTERS,
  STATUS_LABELS,
  PUBLIC_EXPORT_FIELDS,
  ADMIN_EXPORT_FIELDS,
  CONFIG
} from './config.js';

const kpiGrid = document.querySelector('#kpiGrid');
const tableBody = document.querySelector('#tableBody');
const adminMessage = document.querySelector('#adminMessage');
const searchFilter = document.querySelector('#searchFilter');
const statusFilter = document.querySelector('#statusFilter');
const categoryFilter = document.querySelector('#categoryFilter');
const priorityFilter = document.querySelector('#priorityFilter');
const slaFilter = document.querySelector('#slaFilter');
const tokenButton = document.querySelector('#tokenButton');
const healthButton = document.querySelector('#healthButton');
const refreshButton = document.querySelector('#refreshButton');
const publicExportButton = document.querySelector('#publicExportButton');
const adminExportButton = document.querySelector('#adminExportButton');
const logoutButton = document.querySelector('#logoutButton');
const modal = document.querySelector('#modal');
const modalTitle = document.querySelector('#modalTitle');
const modalSla = document.querySelector('#modalSla');
const closeModalButton = document.querySelector('#closeModalButton');
const detailReadOnly = document.querySelector('#detailReadOnly');
const detailForm = document.querySelector('#detailForm');
const modalError = document.querySelector('#modalError');
const saveButton = document.querySelector('#saveButton');
const statusHelp = document.querySelector('#statusHelp');

let initiatives = [];
let currentItem = null;

const readOnlyFields = [
  'ID',
  'Created At',
  'Category',
  'Current Situation',
  'Problem',
  'Proposed Solution',
  'Expected Impact',
  'Frequency',
  'Contact',
  'Status',
  'Impact Score',
  'Source'
];

function fillSelect(select, values, allLabel) {
  select.replaceChildren();
  if (allLabel !== null) {
    const all = document.createElement('option');
    all.value = '';
    all.textContent = allLabel;
    select.append(all);
  }
  values.forEach((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = STATUS_LABELS[value] || value || 'Не указано';
    select.append(option);
  });
}

function statusClass(status) {
  return `status-badge status-${String(status).toLowerCase().replace(/\s+/g, '-')}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date);
}

function dateInputValue(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function trimLimited(value, limit) {
  return String(value || '').trim().slice(0, limit);
}

function appendCell(row, text, className = 'px-4 py-3 align-top') {
  const cell = document.createElement('td');
  cell.className = className;
  cell.textContent = text || '';
  row.append(cell);
  return cell;
}

function showMessage(message) {
  adminMessage.textContent = message;
  adminMessage.classList.remove('hidden');
}

function hideMessage() {
  adminMessage.textContent = '';
  adminMessage.classList.add('hidden');
}

function showModalError(message) {
  modalError.textContent = message;
  modalError.classList.remove('hidden');
}

function hideModalError() {
  modalError.textContent = '';
  modalError.classList.add('hidden');
}

function getSlaStatus(item) {
  const created = new Date(item['Created At']);
  if (Number.isNaN(created.getTime())) return { code: 'OK', label: 'OK' };
  const ageDays = (Date.now() - created.getTime()) / 86400000;
  if (item.Status === 'New' && ageDays > 7) return { code: 'Breach', label: 'Breach: New > 7 дней' };
  if (item.Status === 'Under Review' && ageDays > 14) return { code: 'Breach', label: 'Breach: Review > 14 дней' };
  if (item.Status === 'Planned' && !item['Implemented Date'] && ageDays > 30) return { code: 'Warning', label: 'Warning: Planned > 30 дней' };
  return { code: 'OK', label: 'OK' };
}

function createSlaBadge(item) {
  const sla = getSlaStatus(item);
  const badge = document.createElement('span');
  badge.className = `sla-badge sla-${sla.code.toLowerCase()}`;
  badge.textContent = sla.label;
  return badge;
}

function renderKpi() {
  const definitions = [
    ['Всего', null],
    ['New', 'New'],
    ['Under Review', 'Under Review'],
    ['Accepted', 'Accepted'],
    ['Planned', 'Planned'],
    ['Implemented', 'Implemented'],
    ['Rejected', 'Rejected'],
    ['SLA Breach', 'SLA_BREACH']
  ];

  kpiGrid.replaceChildren();
  definitions.forEach(([label, status]) => {
    const count = status === null
      ? initiatives.length
      : status === 'SLA_BREACH'
        ? initiatives.filter((item) => getSlaStatus(item).code === 'Breach').length
        : initiatives.filter((item) => item.Status === status).length;
    const card = document.createElement('article');
    card.className = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm';
    const title = document.createElement('p');
    title.className = 'text-xs font-black uppercase tracking-wide text-slate-500';
    title.textContent = label;
    const value = document.createElement('p');
    value.className = 'mt-2 text-3xl font-black text-slate-950';
    value.textContent = String(count);
    card.append(title, value);
    kpiGrid.append(card);
  });
}

function getFiltered() {
  const query = searchFilter.value.trim().toLowerCase();
  return initiatives.filter((item) => {
    const searchable = [
      item.ID,
      item.Category,
      item.Problem,
      item['Proposed Solution'],
      item['Expected Impact'],
      item['Public Decision'],
      item['Public Result'],
      item['Internal Decision'],
      item['Manager Comment'],
      item.Owner
    ].join(' ').toLowerCase();
    const sla = getSlaStatus(item).code;

    if (query && !searchable.includes(query)) return false;
    if (statusFilter.value && item.Status !== statusFilter.value) return false;
    if (categoryFilter.value && item.Category !== categoryFilter.value) return false;
    if (priorityFilter.value && item['Business Priority'] !== priorityFilter.value) return false;
    if (slaFilter.value && sla !== slaFilter.value) return false;
    return true;
  });
}

function renderTable() {
  tableBody.replaceChildren();
  const filtered = getFiltered();
  if (!filtered.length) {
    const row = document.createElement('tr');
    const cell = appendCell(row, 'По выбранным фильтрам инициативы не найдены.', 'px-4 py-5 text-center font-bold text-slate-600');
    cell.colSpan = 9;
    tableBody.append(row);
    return;
  }

  filtered.forEach((item) => {
    const sla = getSlaStatus(item);
    const row = document.createElement('tr');
    row.className = `cursor-pointer hover:bg-slate-50 ${sla.code === 'Breach' ? 'row-breach' : ''} ${sla.code === 'Warning' ? 'row-warning' : ''}`;
    row.tabIndex = 0;
    row.addEventListener('click', () => openModal(item.ID));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') openModal(item.ID);
    });

    appendCell(row, item.ID, 'px-4 py-3 align-top font-black text-slate-900');
    appendCell(row, formatDate(item['Created At']));
    appendCell(row, item.Category);

    const statusCell = document.createElement('td');
    statusCell.className = 'px-4 py-3 align-top';
    const badge = document.createElement('span');
    badge.className = statusClass(item.Status);
    badge.textContent = STATUS_LABELS[item.Status] || item.Status;
    statusCell.append(badge);
    row.append(statusCell);

    appendCell(row, String(item['Impact Score'] || ''));
    appendCell(row, item['Business Priority']);
    appendCell(row, item.Owner);
    const slaCell = document.createElement('td');
    slaCell.className = 'px-4 py-3 align-top';
    slaCell.append(createSlaBadge(item));
    row.append(slaCell);
    appendCell(row, item.Contact ? 'Да' : 'Нет');
    tableBody.append(row);
  });
}

function renderAll() {
  hideMessage();
  renderKpi();
  renderTable();
}

function addReadOnlyField(label, value) {
  const wrapper = document.createElement('div');
  wrapper.className = 'rounded-lg border border-slate-200 bg-slate-50 p-3';
  const title = document.createElement('p');
  title.className = 'text-xs font-black uppercase tracking-wide text-slate-500';
  title.textContent = label;
  const content = document.createElement('p');
  content.className = 'mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800';
  content.textContent = value || 'Не указано';
  wrapper.append(title, content);
  detailReadOnly.append(wrapper);
}

function setStatusOptions(item) {
  const current = item.Status || 'New';
  fillSelect(detailForm.elements.Status, ALL_STATUSES, null);
  detailForm.elements.Status.value = current;
  statusHelp.textContent = 'Можно выбрать любой статус. Обязательные поля проверяются по выбранному статусу.';
}

function setFormValues(item) {
  setStatusOptions(item);
  detailForm.elements['Business Priority'].value = item['Business Priority'] || '';
  detailForm.elements.Owner.value = item.Owner || '';
  detailForm.elements['Review Date'].value = dateInputValue(item['Review Date']);
  detailForm.elements['Implemented Date'].value = dateInputValue(item['Implemented Date']);
  detailForm.elements['Public Decision'].value = item['Public Decision'] || '';
  detailForm.elements['Public Result'].value = item['Public Result'] || '';
  detailForm.elements['Internal Decision'].value = item['Internal Decision'] || '';
  detailForm.elements['Duplicate Of'].value = item['Duplicate Of'] || '';
  detailForm.elements['Manager Comment'].value = item['Manager Comment'] || '';
  detailForm.elements['Rejected Reason'].value = item['Rejected Reason'] || '';
}

function openModal(id) {
  currentItem = initiatives.find((item) => item.ID === id);
  if (!currentItem) return;
  hideModalError();
  modalTitle.textContent = currentItem.ID;
  modalSla.replaceChildren(createSlaBadge(currentItem));
  detailReadOnly.replaceChildren();
  readOnlyFields.forEach((field) => addReadOnlyField(field, field.includes('Date') || field === 'Created At' ? formatDate(currentItem[field]) : currentItem[field]));
  setFormValues(currentItem);
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
  currentItem = null;
}

function collectUpdate() {
  return {
    Status: detailForm.elements.Status.value,
    'Business Priority': detailForm.elements['Business Priority'].value,
    Owner: trimLimited(detailForm.elements.Owner.value, CONFIG.TEXT_LIMITS.owner),
    'Review Date': detailForm.elements['Review Date'].value,
    'Implemented Date': detailForm.elements['Implemented Date'].value,
    'Public Decision': trimLimited(detailForm.elements['Public Decision'].value, CONFIG.TEXT_LIMITS.publicDecision),
    'Public Result': trimLimited(detailForm.elements['Public Result'].value, CONFIG.TEXT_LIMITS.publicResult),
    'Internal Decision': trimLimited(detailForm.elements['Internal Decision'].value, CONFIG.TEXT_LIMITS.internalDecision),
    'Rejected Reason': detailForm.elements['Rejected Reason'].value,
    'Duplicate Of': trimLimited(detailForm.elements['Duplicate Of'].value, CONFIG.TEXT_LIMITS.duplicateOf),
    'Manager Comment': trimLimited(detailForm.elements['Manager Comment'].value, CONFIG.TEXT_LIMITS.managerComment)
  };
}

function validateUpdate(updates) {
  if (updates.Status === 'Rejected' && !updates['Rejected Reason']) return 'Для Rejected необходимо указать Rejected Reason';
  if (updates.Status === 'Planned' && !updates.Owner) return 'Для Planned необходимо указать Owner';
  if (updates.Status === 'Accepted' && !updates['Public Decision']) return 'Для Accepted необходимо заполнить Public Decision';
  if (updates.Status === 'Implemented' && !updates['Implemented Date']) return 'Для Implemented необходимо указать Implemented Date';
  if (updates.Status === 'Implemented' && !updates['Public Result']) return 'Для Implemented необходимо заполнить Public Result';
  return '';
}

async function handleSave(event) {
  event.preventDefault();
  if (!currentItem) return;
  hideModalError();
  const updates = collectUpdate();
  const validationError = validateUpdate(updates);
  if (validationError) {
    showModalError(validationError);
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Сохранение...';
  try {
    const data = await postAction('updateInitiative', {
      token: getAdminToken(),
      changedBy: getAdminAlias(),
      id: currentItem.ID,
      updates
    });
    const index = initiatives.findIndex((item) => item.ID === currentItem.ID);
    if (index >= 0) initiatives[index] = data.item;
    renderAll();
    closeModal();
  } catch (error) {
    showModalError(error.message);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Сохранить изменения';
  }
}

async function loadAdminData() {
  const token = getAdminToken() || window.prompt('Введите ADMIN_TOKEN') || '';
  if (!token.trim()) {
    showMessage('Для загрузки панели нужен ADMIN_TOKEN.');
    return;
  }
  setAdminToken(token);

  refreshButton.disabled = true;
  refreshButton.textContent = 'Загрузка...';
  showMessage('Загружаем данные...');
  try {
    const data = await postAction('getAdminData', { token });
    initiatives = data.items || [];
    renderAll();
  } catch (error) {
    showMessage(error.message);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = 'Обновить';
  }
}

async function runHealthCheck() {
  showMessage('Проверяем backend...');
  try {
    const data = await getAction('healthCheck');
    showMessage(`Backend ${data.version}. Sheet: ${data.sheetStatus}. Headers: ${data.headersValid ? 'OK' : 'ошибка'}. Timestamp: ${data.timestamp}`);
  } catch (error) {
    showMessage(error.message);
  }
}

function csvEscape(value) {
  let text = String(value ?? '').trim();
  if (/^[=*\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(fields, filePrefix) {
  const rows = [fields.map(csvEscape).join(',')];
  getFiltered().forEach((item) => rows.push(fields.map((field) => csvEscape(item[field])).join(',')));
  const blob = new Blob([`\ufeff${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function editToken() {
  const token = window.prompt('Введите ADMIN_TOKEN', getAdminToken());
  if (token === null) return;
  if (!token.trim()) {
    clearAdminToken();
    showMessage('ADMIN_TOKEN удален из текущей сессии.');
    return;
  }
  const alias = window.prompt('Имя администратора для Audit Log', getAdminAlias()) || 'Admin';
  setAdminToken(token);
  setAdminAlias(alias);
  loadAdminData();
}

function logout() {
  clearAdminToken();
  initiatives = [];
  renderAll();
  showMessage('Вы вышли из админки. Токен удален из sessionStorage.');
}

fillSelect(statusFilter, ALL_STATUSES, 'Все статусы');
fillSelect(categoryFilter, CATEGORIES, 'Все категории');
fillSelect(priorityFilter, BUSINESS_PRIORITIES.filter(Boolean), 'Все приоритеты');
fillSelect(slaFilter, SLA_FILTERS.filter(Boolean), 'Все SLA');
fillSelect(detailForm.elements['Business Priority'], BUSINESS_PRIORITIES, null);
fillSelect(detailForm.elements['Rejected Reason'], REJECTED_REASONS, null);

[searchFilter, statusFilter, categoryFilter, priorityFilter, slaFilter].forEach((element) => {
  element.addEventListener('input', renderTable);
  element.addEventListener('change', renderTable);
});

refreshButton.addEventListener('click', loadAdminData);
healthButton.addEventListener('click', runHealthCheck);
tokenButton.addEventListener('click', editToken);
logoutButton.addEventListener('click', logout);
publicExportButton.addEventListener('click', () => exportCsv(PUBLIC_EXPORT_FIELDS, 'lean-ideas-public'));
adminExportButton.addEventListener('click', () => {
  if (window.confirm('Файл содержит контактные и внутренние данные. Вы уверены, что хотите экспортировать?')) {
    exportCsv(ADMIN_EXPORT_FIELDS, 'lean-ideas-admin');
  }
});
closeModalButton.addEventListener('click', closeModal);
detailForm.addEventListener('submit', handleSave);
modal.addEventListener('click', (event) => {
  if (event.target.classList.contains('modal-backdrop')) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

loadAdminData();
