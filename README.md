# Lean Ideas v2 Zaberman

Lean Ideas v2 — pilot-ready система управления инициативами по улучшению процессов для внутреннего использования Zaberman.

## 1. Цель проекта

Система помогает сотрудникам подавать инициативы по улучшению процессов, а менеджерам — рассматривать, приоритизировать, назначать ответственных, контролировать SLA, публиковать решения и фиксировать историю изменений.

## 2. Отличия v2 от MVP

- `ADMIN_TOKEN` не передается через URL.
- Admin-запросы и update выполняются только через `POST`.
- `ADMIN_TOKEN` хранится в `sessionStorage`, а не в `localStorage`.
- Добавлена кнопка `Выйти`.
- Публичные и внутренние поля разделены.
- ID генерируется через `Utilities.getUuid()` и проверяется на уникальность.
- Дополнительные колонки после обязательной структуры разрешены.
- Добавлен лист `Audit Log`.
- Добавлены правила переходов статусов.
- Добавлены обязательные поля по статусам.
- Добавлены SLA-индикаторы.
- Добавлен `healthCheck`.
- Добавлены Public Export и Admin Export.

## 3. Архитектура

```text
GitHub Pages
↓
HTML + Tailwind CDN + Vanilla JS Modules
↓
Google Apps Script Web App
↓
Google Sheets
↓
Telegram Bot API
```

Frontend работает как статический сайт. Backend размещается как Google Apps Script Web App. Данные хранятся в Google Sheets.

## 4. Ограничения безопасности

Это pilot-ready v2, а не enterprise production.

Важно:

- `ADMIN_TOKEN` не является production security.
- `admin.html` нельзя распространять публично.
- `ADMIN_TOKEN` должен быть сложным и регулярно меняться.
- Для production нужен Google Workspace OAuth, полноценный backend или IAM.
- GitHub Pages является публичным hosting, поэтому frontend-код виден всем.
- `BOT_TOKEN`, `CHAT_ID`, `ADMIN_TOKEN` нельзя хранить во frontend.

## 5. Структура Google Sheets

Лист `Lean Ideas`:

```text
ID
Created At
Category
Current Situation
Problem
Proposed Solution
Expected Impact
Frequency
Contact
Status
Impact Score
Business Priority
Owner
Review Date
Implemented Date
Public Decision
Public Result
Internal Decision
Rejected Reason
Duplicate Of
Manager Comment
Source
```

Лист `Audit Log`:

```text
Timestamp
Initiative ID
Action
Changed By
Field
Old Value
New Value
Comment
```

Apps Script создаст листы и заголовки, если они пустые или отсутствуют. Если обязательные колонки переименованы или удалены, API вернет понятную ошибку. Дополнительные колонки справа от обязательных разрешены.

## 6. Настройка Apps Script

1. Создайте Google Sheet.
2. Откройте `Extensions` → `Apps Script`.
3. Удалите стандартный код.
4. Скопируйте содержимое `google-apps-script.gs`.
5. Вставьте в `Code.gs`.
6. Сохраните проект.

## 7. Script Properties

В Apps Script откройте `Project Settings` → `Script Properties`.

Добавьте:

| Key | Value |
| --- | --- |
| `ADMIN_TOKEN` | сложный временный токен администратора |
| `BOT_TOKEN` | Telegram bot token, опционально |
| `CHAT_ID` | Telegram chat id, опционально |
| `SPREADSHEET_ID` | ID таблицы, если Apps Script не bound script |

Если `BOT_TOKEN` или `CHAT_ID` не заполнены, система продолжит работать без Telegram.

## 8. Настройка Telegram

1. Откройте `@BotFather`.
2. Создайте бота через `/newbot`.
3. Скопируйте `BOT_TOKEN`.
4. Добавьте бота в группу.
5. Отправьте сообщение в группу.
6. Откройте:

```text
https://api.telegram.org/botBOT_TOKEN/getUpdates
```

7. Найдите `chat.id` и сохраните его как `CHAT_ID`.

## 9. Деплой Web App

1. Apps Script → `Deploy` → `New deployment`.
2. Type: `Web app`.
3. Execute as: `Me`.
4. Who has access: `Anyone`.
5. Нажмите `Deploy`.
6. Скопируйте Web App URL формата:

```text
https://script.google.com/macros/s/.../exec
```

После каждого изменения Apps Script создавайте `New version` в deployment.

## 10. Настройка GitHub Pages

1. Создайте новый GitHub репозиторий.
2. Загрузите содержимое папки `lean-ideas-v2`.
3. Откройте `Settings` → `Pages`.
4. Source: `Deploy from a branch`.
5. Branch: `main`.
6. Folder: `/root`.
7. Сохраните.

## 11. Настройка config.js

В `js/config.js` укажите:

```js
WEB_APP_URL: 'https://script.google.com/macros/s/.../exec'
```

Не храните во frontend:

- `ADMIN_TOKEN`;
- `BOT_TOKEN`;
- `CHAT_ID`.

## 12. Smoke Test

1. Открыть `index.html`.
2. Подать тестовую инициативу.
3. Проверить строку в Google Sheet.
4. Проверить Telegram уведомление.
5. Открыть `board.html`.
6. Проверить, что инициатива видна без приватных данных.
7. Открыть `admin.html`.
8. Ввести `ADMIN_TOKEN`.
9. Перевести `New → Under Review`.
10. Перевести `Under Review → Accepted` с `Public Decision`.
11. Перевести `Accepted → Planned` с `Owner`.
12. Перевести `Planned → Implemented` с `Implemented Date` и `Public Result`.
13. Проверить `Audit Log`.
14. Проверить публичную карточку на `board.html`.
15. Проверить `Public Export`.
16. Проверить `Admin Export`.

## 13. Troubleshooting

### Неверный ADMIN_TOKEN

- Проверьте `ADMIN_TOKEN` в Script Properties.
- Нажмите `Выйти` в admin panel.
- Введите токен заново.

### CORS / Failed to fetch

- Убедитесь, что Web App deployment доступен для `Anyone`.
- Убедитесь, что URL заканчивается на `/exec`, а не `/dev`.
- Убедитесь, что frontend использует `Content-Type: text/plain`.
- Откройте URL `/exec?action=healthCheck` напрямую.

### Пустой WEB_APP_URL

Откройте:

```text
https://ваш-github-pages/js/config.js
```

Проверьте, что URL не пустой.

### Старый deploy Apps Script

Если код Apps Script менялся:

1. `Deploy` → `Manage deployments`.
2. `Edit`.
3. `Version` → `New version`.
4. `Deploy`.

### Кэш GitHub Pages

После push подождите 1-3 минуты и обновите страницу через `Ctrl + F5`.

## 14. Roadmap Production

- Google Workspace OAuth.
- Полноценный backend.
- Ролевая модель.
- Нормальная база данных.
- BI dashboard.
- Интеграция Kaiten/Jira.
- SLA reminders.
- История комментариев.
- Голосование за инициативы.
- База знаний реализованных улучшений.

## Статусы и правила переходов

```text
New → Under Review
Under Review → Accepted
Under Review → Rejected
Accepted → Planned
Accepted → Rejected
Planned → Implemented
Planned → Rejected
```

Обязательные поля:

- `Rejected`: `Rejected Reason`.
- `Accepted`: `Public Decision`.
- `Planned`: `Owner`.
- `Implemented`: `Implemented Date`, `Public Result`.

## Экспорт CSV

`Public Export` содержит только публичные поля.

`Admin Export` содержит все поля и требует подтверждения, потому что включает контактные и внутренние данные.

CSV Injection защита: если значение начинается с `=`, `*`, `-`, `@`, перед ним добавляется апостроф.
