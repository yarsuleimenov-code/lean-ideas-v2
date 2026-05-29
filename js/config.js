export const CONFIG = {
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbzb1YF_Dt9WNl8B1_PlY2HGjNXJu0qJKmH-vMIy6rlgQt7FlSZtgiR-_4YCEbFWfgo/exec',
  ADMIN_TOKEN_STORAGE_KEY: 'zaberman_lean_admin_token_v2',
  ADMIN_ALIAS_STORAGE_KEY: 'zaberman_lean_admin_alias_v2',
  REQUEST_TIMEOUT_MS: 30000,
  TEXT_LIMITS: {
    currentSituation: 1000,
    problem: 1000,
    proposedSolution: 1000,
    expectedImpact: 600,
    contact: 200,
    owner: 120,
    publicDecision: 1000,
    publicResult: 1200,
    internalDecision: 1500,
    rejectedReason: 120,
    duplicateOf: 80,
    managerComment: 1500
  }
};

export const CATEGORIES = [
  'Улучшение процесса',
  'Автоматизация',
  'Отчетность и аналитика',
  'Качество данных',
  'Клиентский сервис',
  'Снижение затрат',
  'Риски и контроль',
  'Другое'
];

export const FREQUENCIES = [
  'Каждый день',
  'Несколько раз в неделю',
  'Несколько раз в месяц',
  'Редко'
];

export const ALL_STATUSES = [
  'New',
  'Under Review',
  'Accepted',
  'Planned',
  'Implemented',
  'Rejected'
];

export const PUBLIC_STATUSES = [
  'New',
  'Under Review',
  'Accepted',
  'Planned',
  'Implemented'
];

export const STATUS_LABELS = {
  New: 'Новая',
  'Under Review': 'На рассмотрении',
  Accepted: 'Одобрена',
  Planned: 'Запланирована',
  Implemented: 'Реализована',
  Rejected: 'Отклонена'
};

export const STATUS_TRANSITIONS = {
  New: ['Under Review'],
  'Under Review': ['Accepted', 'Rejected'],
  Accepted: ['Planned', 'Rejected'],
  Planned: ['Implemented', 'Rejected'],
  Implemented: [],
  Rejected: []
};

export const BUSINESS_PRIORITIES = ['', 'Low', 'Medium', 'High', 'Critical'];

export const REJECTED_REASONS = [
  '',
  'Дубликат',
  'Низкий эффект',
  'Не реализуемо',
  'Вне зоны ответственности',
  'Недостаточно данных',
  'Другое'
];

export const SLA_FILTERS = ['', 'OK', 'Warning', 'Breach'];

export const PUBLIC_EXPORT_FIELDS = [
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

export const ADMIN_EXPORT_FIELDS = [
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
