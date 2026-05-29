import { CONFIG } from './config.js';

function assertConfigured() {
  if (!CONFIG.WEB_APP_URL || !CONFIG.WEB_APP_URL.startsWith('https://script.google.com/macros/s/')) {
    throw new Error('Укажите корректный Google Apps Script Web App URL в js/config.js');
  }
}

function createAbort(timeoutMs) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timer };
}

async function parseResponse(response) {
  const text = await response.text();
  let result;

  try {
    result = JSON.parse(text);
  } catch (error) {
    throw new Error('Backend вернул не JSON. Проверьте URL Web App и доступ deployment.');
  }

  if (!result.success) {
    throw new Error(result.error?.message || 'Запрос не выполнен');
  }

  return result.data;
}

export async function postAction(action, payload = {}) {
  assertConfigured();
  const { controller, timer } = createAbort(CONFIG.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.WEB_APP_URL, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Ошибка backend: ${response.status}`);
    }

    return await parseResponse(response);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Превышено время ожидания ответа backend');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function getAction(action, params = {}) {
  assertConfigured();
  const { controller, timer } = createAbort(CONFIG.REQUEST_TIMEOUT_MS);
  const url = new URL(CONFIG.WEB_APP_URL);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      url.searchParams.set(key, String(value).trim());
    }
  });

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Ошибка backend: ${response.status}`);
    }

    return await parseResponse(response);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Превышено время ожидания ответа backend');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function getAdminToken() {
  return window.sessionStorage.getItem(CONFIG.ADMIN_TOKEN_STORAGE_KEY) || '';
}

export function setAdminToken(token) {
  window.sessionStorage.setItem(CONFIG.ADMIN_TOKEN_STORAGE_KEY, token.trim());
}

export function clearAdminToken() {
  window.sessionStorage.removeItem(CONFIG.ADMIN_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(CONFIG.ADMIN_ALIAS_STORAGE_KEY);
}

export function getAdminAlias() {
  return window.sessionStorage.getItem(CONFIG.ADMIN_ALIAS_STORAGE_KEY) || 'Admin';
}

export function setAdminAlias(alias) {
  window.sessionStorage.setItem(CONFIG.ADMIN_ALIAS_STORAGE_KEY, alias.trim() || 'Admin');
}
