const VERSION = '2.0.0';
const MAIN_SHEET_NAME = 'Lean Ideas';
const AUDIT_SHEET_NAME = 'Audit Log';

const MAIN_HEADERS = [
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
  'Business Priority',
  'Owner',
  'Review Date',
  'Implemented Date',
  'Public Decision',
  'Public Result',
  'Internal Decision',
  'Rejected Reason',
  'Duplicate Of',
  'Manager Comment',
  'Source'
];

const AUDIT_HEADERS = [
  'Timestamp',
  'Initiative ID',
  'Action',
  'Changed By',
  'Field',
  'Old Value',
  'New Value',
  'Comment'
];

const PUBLIC_HEADERS = [
  'ID',
  'Created At',
  'Category',
  'Status',
  'Problem',
  'Proposed Solution',
  'Expected Impact',
  'Public Decision',
  'Public Result',
  'Implemented Date'
];

const UPDATE_HEADERS = [
  'Status',
  'Business Priority',
  'Owner',
  'Review Date',
  'Implemented Date',
  'Public Decision',
  'Public Result',
  'Internal Decision',
  'Rejected Reason',
  'Duplicate Of',
  'Manager Comment'
];

const CATEGORIES = [
  'Улучшение процесса',
  'Автоматизация',
  'Отчетность и аналитика',
  'Качество данных',
  'Клиентский сервис',
  'Снижение затрат',
  'Риски и контроль',
  'Другое'
];

const FREQUENCY_SCORE = {
  'Каждый день': 4,
  'Несколько раз в неделю': 3,
  'Несколько раз в месяц': 2,
  'Редко': 1
};

const STATUSES = ['New', 'Under Review', 'Accepted', 'Planned', 'Implemented', 'Rejected'];
const BUSINESS_PRIORITIES = ['', 'Low', 'Medium', 'High', 'Critical'];
const REJECTED_REASONS = ['', 'Дубликат', 'Низкий эффект', 'Не реализуемо', 'Вне зоны ответственности', 'Недостаточно данных', 'Другое'];

const TRANSITIONS = {
  New: ['Under Review'],
  'Under Review': ['Accepted', 'Rejected'],
  Accepted: ['Planned', 'Rejected'],
  Planned: ['Implemented', 'Rejected'],
  Implemented: [],
  Rejected: []
};

const TEXT_LIMITS = {
  category: 80,
  currentSituation: 1000,
  problem: 1000,
  proposedSolution: 1000,
  expectedImpact: 600,
  frequency: 80,
  contact: 200,
  owner: 120,
  publicDecision: 1000,
  publicResult: 1200,
  internalDecision: 1500,
  rejectedReason: 120,
  duplicateOf: 80,
  managerComment: 1500
};

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const action = sanitizeText_(params.action, 80);
    if (action === 'getPublicBoard') return json_(getPublicBoard_());
    if (action === 'healthCheck') return json_(healthCheck_());
    return json_(fail_('UNKNOWN_ACTION', 'Неизвестное действие'));
  } catch (error) {
    return json_(fail_('SERVER_ERROR', error.message));
  }
}

function doPost(e) {
  try {
    const body = parsePostBody_(e);
    const action = sanitizeText_(body.action, 80);
    if (action === 'submitInitiative') return json_(submitInitiative_(body.data || {}));
    if (action === 'getAdminData') {
      assertAdmin_(body.token);
      return json_(getAdminData_());
    }
    if (action === 'updateInitiative') {
      assertAdmin_(body.token);
      return json_(updateInitiative_(body.id, body.updates || {}, body.changedBy));
    }
    return json_(fail_('UNKNOWN_ACTION', 'Неизвестное действие'));
  } catch (error) {
    return json_(fail_('SERVER_ERROR', error.message));
  }
}

function parsePostBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function ok_(data) {
  return { success: true, data: data };
}

function fail_(code, message) {
  return { success: false, error: { code: code, message: message } };
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Укажите SPREADSHEET_ID в Script Properties или используйте bound script');
  return active;
}

function getOrCreateSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  ensureHeaders_(sheet, headers);
  return sheet;
}

function getMainSheet_() {
  return getOrCreateSheet_(getSpreadsheet_(), MAIN_SHEET_NAME, MAIN_HEADERS);
}

function getAuditSheet_() {
  return getOrCreateSheet_(getSpreadsheet_(), AUDIT_SHEET_NAME, AUDIT_HEADERS);
}

function ensureHeaders_(sheet, requiredHeaders) {
  const lastColumn = Math.max(sheet.getLastColumn(), requiredHeaders.length);
  const values = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(value) {
    return String(value || '').trim();
  });
  const isEmpty = values.every(function(value) { return !value; });

  if (isEmpty) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    return;
  }

  const differences = [];
  requiredHeaders.forEach(function(header, index) {
    const actual = values[index] || '';
    if (actual !== header) {
      differences.push('колонка ' + (index + 1) + ': ожидается "' + header + '", сейчас "' + (actual || '(пусто)') + '"');
    }
  });

  if (differences.length) {
    throw new Error('Структура листа "' + sheet.getName() + '" отличается от ожидаемой: ' + differences.join('; '));
  }
}

function healthCheck_() {
  const spreadsheet = getSpreadsheet_();
  const main = spreadsheet.getSheetByName(MAIN_SHEET_NAME);
  const audit = spreadsheet.getSheetByName(AUDIT_SHEET_NAME);
  let headersValid = false;
  let sheetStatus = 'missing';

  try {
    getOrCreateSheet_(spreadsheet, MAIN_SHEET_NAME, MAIN_HEADERS);
    getOrCreateSheet_(spreadsheet, AUDIT_SHEET_NAME, AUDIT_HEADERS);
    headersValid = true;
    sheetStatus = 'ok';
  } catch (error) {
    sheetStatus = error.message;
  }

  return ok_({
    version: VERSION,
    timestamp: formatDateTime_(new Date()),
    sheetStatus: sheetStatus,
    requiredSheetsExist: Boolean(main || spreadsheet.getSheetByName(MAIN_SHEET_NAME)) && Boolean(audit || spreadsheet.getSheetByName(AUDIT_SHEET_NAME)),
    headersValid: headersValid
  });
}

function submitInitiative_(data) {
  const item = normalizeSubmission_(data);
  let rowObject;

  withLock_('создания инициативы', function() {
    const sheet = getMainSheet_();
    const id = generateUniqueId_(sheet);
    rowObject = {
      'ID': id,
      'Created At': formatDateTime_(new Date()),
      'Category': item.category,
      'Current Situation': item.currentSituation,
      'Problem': item.problem,
      'Proposed Solution': item.proposedSolution,
      'Expected Impact': item.expectedImpact,
      'Frequency': item.frequency,
      'Contact': item.contact,
      'Status': 'New',
      'Impact Score': FREQUENCY_SCORE[item.frequency],
      'Business Priority': '',
      'Owner': '',
      'Review Date': '',
      'Implemented Date': '',
      'Public Decision': '',
      'Public Result': '',
      'Internal Decision': '',
      'Rejected Reason': '',
      'Duplicate Of': '',
      'Manager Comment': '',
      'Source': 'Manual Form'
    };

    sheet.appendRow(MAIN_HEADERS.map(function(header) { return rowObject[header]; }));
    appendAuditRows_([{
      id: id,
      action: 'Create',
      changedBy: 'System',
      field: 'Initiative',
      oldValue: '',
      newValue: 'Created',
      comment: 'Manual Form'
    }]);
  });

  sendNewInitiativeNotification_(rowObject);
  return ok_({ id: rowObject.ID });
}

function getPublicBoard_() {
  const items = getRows_()
    .filter(function(item) { return item.ID && item.Status !== 'Rejected'; })
    .map(function(item) { return pick_(item, PUBLIC_HEADERS); });
  return ok_({ items: items });
}

function getAdminData_() {
  return ok_({ items: getRows_().filter(function(item) { return item.ID; }) });
}

function updateInitiative_(id, updates, changedBy) {
  const cleanId = sanitizeText_(id, 80);
  if (!cleanId) throw new Error('Не указан ID инициативы');
  const actor = sanitizeText_(changedBy, 120) || 'Admin';
  let updatedItem;
  let statusChanged = false;
  let oldStatus = '';

  withLock_('обновления инициативы', function() {
    const sheet = getMainSheet_();
    const index = headerIndex_(MAIN_HEADERS);
    const rowInfo = findRowById_(sheet, cleanId, index);
    if (!rowInfo) throw new Error('Инициатива не найдена');

    const oldItem = rowToObject_(rowInfo.values);
    const normalized = normalizeUpdates_(updates);
    const finalItem = Object.assign({}, oldItem, normalized);
    validateTransition_(oldItem.Status, finalItem.Status);
    validateRequiredByStatus_(finalItem);

    const auditRows = [];
    UPDATE_HEADERS.forEach(function(header) {
      if (Object.prototype.hasOwnProperty.call(normalized, header)) {
        const oldValue = stringifyCell_(oldItem[header]);
        const newValue = stringifyCell_(normalized[header]);
        if (oldValue !== newValue) {
          sheet.getRange(rowInfo.rowNumber, index[header] + 1).setValue(normalized[header]);
          auditRows.push({
            id: cleanId,
            action: header === 'Status' ? 'Status Change' : 'Update',
            changedBy: actor,
            field: header,
            oldValue: oldValue,
            newValue: newValue,
            comment: normalized['Manager Comment'] || ''
          });
          if (header === 'Status') {
            statusChanged = true;
            oldStatus = oldValue;
          }
        }
      }
    });

    if (auditRows.length) appendAuditRows_(auditRows);
    updatedItem = rowToObject_(sheet.getRange(rowInfo.rowNumber, 1, 1, MAIN_HEADERS.length).getValues()[0]);
  });

  if (statusChanged) sendStatusNotification_(updatedItem, oldStatus);
  return ok_({ item: updatedItem });
}

function normalizeSubmission_(data) {
  const item = {
    category: sanitizeText_(data.category, TEXT_LIMITS.category),
    currentSituation: sanitizeText_(data.currentSituation, TEXT_LIMITS.currentSituation),
    problem: sanitizeText_(data.problem, TEXT_LIMITS.problem),
    proposedSolution: sanitizeText_(data.proposedSolution, TEXT_LIMITS.proposedSolution),
    expectedImpact: sanitizeText_(data.expectedImpact, TEXT_LIMITS.expectedImpact),
    frequency: sanitizeText_(data.frequency, TEXT_LIMITS.frequency),
    contact: sanitizeText_(data.contact, TEXT_LIMITS.contact)
  };
  requireValue_(item.category, 'Категория');
  requireValue_(item.currentSituation, 'Текущая ситуация');
  requireValue_(item.problem, 'Проблема');
  requireValue_(item.proposedSolution, 'Предлагаемое решение');
  requireValue_(item.expectedImpact, 'Ожидаемый эффект');
  requireValue_(item.frequency, 'Частота возникновения');
  if (CATEGORIES.indexOf(item.category) < 0) throw new Error('Некорректная категория');
  if (!FREQUENCY_SCORE[item.frequency]) throw new Error('Некорректная частота возникновения');
  return item;
}

function normalizeUpdates_(updates) {
  const normalized = {};
  UPDATE_HEADERS.forEach(function(header) {
    if (Object.prototype.hasOwnProperty.call(updates, header)) {
      normalized[header] = sanitizeUpdateValue_(header, updates[header]);
    }
  });
  if (Object.prototype.hasOwnProperty.call(normalized, 'Status') && STATUSES.indexOf(normalized.Status) < 0) throw new Error('Некорректный статус');
  if (Object.prototype.hasOwnProperty.call(normalized, 'Business Priority') && BUSINESS_PRIORITIES.indexOf(normalized['Business Priority']) < 0) throw new Error('Некорректный Business Priority');
  if (Object.prototype.hasOwnProperty.call(normalized, 'Rejected Reason') && REJECTED_REASONS.indexOf(normalized['Rejected Reason']) < 0) throw new Error('Некорректный Rejected Reason');
  return normalized;
}

function sanitizeUpdateValue_(header, value) {
  const limits = {
    'Owner': TEXT_LIMITS.owner,
    'Public Decision': TEXT_LIMITS.publicDecision,
    'Public Result': TEXT_LIMITS.publicResult,
    'Internal Decision': TEXT_LIMITS.internalDecision,
    'Rejected Reason': TEXT_LIMITS.rejectedReason,
    'Duplicate Of': TEXT_LIMITS.duplicateOf,
    'Manager Comment': TEXT_LIMITS.managerComment
  };
  if (header === 'Review Date' || header === 'Implemented Date') return normalizeDate_(value);
  return sanitizeText_(value, limits[header] || 120);
}

function validateTransition_(oldStatus, newStatus) {
  if (!newStatus || oldStatus === newStatus) return;
  const allowed = TRANSITIONS[oldStatus] || [];
  if (allowed.indexOf(newStatus) < 0) {
    throw new Error('Недопустимый переход статуса: ' + oldStatus + ' → ' + newStatus);
  }
}

function validateRequiredByStatus_(item) {
  if (item.Status === 'Rejected') requireValue_(item['Rejected Reason'], 'Rejected Reason');
  if (item.Status === 'Planned') requireValue_(item.Owner, 'Owner');
  if (item.Status === 'Accepted') requireValue_(item['Public Decision'], 'Public Decision');
  if (item.Status === 'Implemented') {
    requireValue_(item['Implemented Date'], 'Implemented Date');
    requireValue_(item['Public Result'], 'Public Result');
  }
}

function getRows_() {
  const sheet = getMainSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, MAIN_HEADERS.length).getValues()
    .map(rowToObject_)
    .filter(function(item) { return item.ID; });
}

function rowToObject_(row) {
  return MAIN_HEADERS.reduce(function(result, header, index) {
    const value = row[index];
    result[header] = value instanceof Date ? formatDateCell_(value) : value;
    return result;
  }, {});
}

function findRowById_(sheet, id, index) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, MAIN_HEADERS.length).getValues();
  for (let i = 0; i < values.length; i += 1) {
    if (String(values[i][index.ID]).trim() === id) {
      return { rowNumber: i + 2, values: values[i] };
    }
  }
  return null;
}

function generateUniqueId_(sheet) {
  const index = headerIndex_(MAIN_HEADERS);
  const ids = {};
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, index.ID + 1, lastRow - 1, 1).getValues().forEach(function(row) {
      if (row[0]) ids[String(row[0]).trim()] = true;
    });
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = 'LI-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
    if (!ids[id]) return id;
  }
  throw new Error('Не удалось сгенерировать уникальный ID');
}

function appendAuditRows_(items) {
  const sheet = getAuditSheet_();
  const rows = items.map(function(item) {
    return [
      formatDateTime_(new Date()),
      item.id,
      item.action,
      item.changedBy || 'Admin',
      item.field,
      item.oldValue,
      item.newValue,
      item.comment || ''
    ];
  });
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, AUDIT_HEADERS.length).setValues(rows);
}

function triggerDailyDigest() {
  const breaches = getRows_().filter(function(item) {
    const sla = calculateSla_(item);
    return sla === 'Breach';
  });
  if (!breaches.length) return;
  const lines = ['SLA breach digest', ''];
  breaches.forEach(function(item) {
    lines.push(item.ID + ' — ' + item.Status + ' — ' + item.Category);
  });
  sendTelegramText_(lines.join('\n'));
}

function calculateSla_(item) {
  const created = parseDate_(item['Created At']);
  if (!created) return 'OK';
  const ageDays = (new Date().getTime() - created.getTime()) / 86400000;
  if (item.Status === 'New' && ageDays > 7) return 'Breach';
  if (item.Status === 'Under Review' && ageDays > 14) return 'Breach';
  if (item.Status === 'Planned' && !item['Implemented Date'] && ageDays > 30) return 'Warning';
  return 'OK';
}

function headerIndex_(headers) {
  return headers.reduce(function(result, header, index) {
    result[header] = index;
    return result;
  }, {});
}

function pick_(item, headers) {
  return headers.reduce(function(result, header) {
    result[header] = item[header];
    return result;
  }, {});
}

function normalizeDate_(value) {
  const text = sanitizeText_(value, 30);
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Дата должна быть в формате YYYY-MM-DD');
  return text;
}

function parseDate_(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const text = String(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const ru = text.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (ru) return new Date(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function formatDateCell_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function sanitizeText_(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function stringifyCell_(value) {
  if (value instanceof Date) return formatDateCell_(value);
  return String(value || '').trim();
}

function requireValue_(value, label) {
  if (!String(value || '').trim()) throw new Error('Заполните поле: ' + label);
}

function assertAdmin_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!expected) throw new Error('ADMIN_TOKEN не настроен в Script Properties');
  if (sanitizeText_(token, 200) !== expected) throw new Error('Неверный ADMIN_TOKEN');
}

function withLock_(operationName, callback) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(30000);
    locked = true;
    return callback();
  } catch (error) {
    throw new Error('Не удалось выполнить операцию "' + operationName + '": ' + error.message);
  } finally {
    if (locked) lock.releaseLock();
  }
}

function sendNewInitiativeNotification_(item) {
  const text = [
    'Новая инициатива',
    '',
    'ID: ' + item.ID,
    'Категория: ' + item.Category,
    'Частота: ' + item.Frequency,
    'Контакт указан: ' + (item.Contact ? 'Да' : 'Нет'),
    '',
    'Проблема:',
    String(item.Problem || '').slice(0, 500)
  ].join('\n');
  sendTelegramText_(text);
}

function sendStatusNotification_(item, oldStatus) {
  const text = [
    'Изменение статуса инициативы',
    '',
    'ID: ' + item.ID,
    'Было: ' + oldStatus,
    'Стало: ' + item.Status
  ].join('\n');
  sendTelegramText_(text);
}

function sendTelegramText_(text) {
  const properties = PropertiesService.getScriptProperties();
  const botToken = properties.getProperty('BOT_TOKEN');
  const chatId = properties.getProperty('CHAT_ID');
  if (!botToken || !chatId) return;
  try {
    UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        text: text,
        disable_web_page_preview: true
      }),
      muteHttpExceptions: true
    });
  } catch (error) {
    console.warn('Ошибка Telegram: ' + error.message);
  }
}
