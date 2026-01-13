# Структура системы оплаты подписки

## Обзор

Система оплаты подписки поддерживает два типа клиентов:
1. **Физические лица** - оплата через YooKassa
2. **Юридические лица** - генерация счета для оплаты по реквизитам

## 1. Модель данных

### Invoice (обновления)
- `invoiceNumber` (String, unique) - автоматически присваиваемый номер счета
- `paymentPeriodMonths` (Int) - период оплаты: 1, 3, 6, 12 месяцев
- `companyId` (Int) - ID компании плательщика (для подтверждения оплаты)
- `payerType` (Enum: 'INDIVIDUAL' | 'LEGAL') - тип плательщика
- Существующие поля остаются без изменений

### Subscription (без изменений)
- Поля остаются как есть

## 2. Процесс оплаты для физических лиц

### 2.1. Выбор тарифа и периода
**Страница:** Страница тарифов (существующая или новая)
- Пользователь выбирает тариф (LITE, TEAM, PRO)
- Пользователь выбирает период оплаты: **1, 3, 6, 12 месяцев**
- Кнопка "Оплатить подписку"

### 2.2. API endpoint: POST /api/billing/payment

**Обновления:**
```typescript
Request body:
{
  planId: number,
  paymentPeriodMonths: 1 | 3 | 6 | 12, // новое поле
  billingInterval?: 'MONTHLY' | 'YEARLY' // устаревшее, заменено на paymentPeriodMonths
}

Response:
{
  paymentUrl: string, // URL для редиректа на YooKassa
  invoiceId: number,
  invoiceNumber: string // номер счета
}
```

**Логика:**
1. Проверка авторизации (только admin)
2. Получение плана из БД
3. Определение типа плательщика из Company.isLegalEntity
4. Если `isLegalEntity === false` (физ лицо):
   - Создание подписки (статус TRIAL)
   - Расчет суммы: `plan.price * paymentPeriodMonths`
   - Создание Invoice с:
     - `invoiceNumber` (автоматически сгенерированный)
     - `paymentPeriodMonths`
     - `companyId`
     - `payerType: 'INDIVIDUAL'`
     - `status: 'PENDING'`
   - Создание платежа в YooKassa
   - Возврат URL для редиректа

### 2.3. После успешной оплаты (webhook)
- YooKassa отправляет webhook на `/api/billing/webhook`
- Обновление Invoice: `status: 'PAID'`, `paidAt: new Date()`
- Активация подписки: `status: 'ACTIVE'`
- Обновление `currentPeriodEnd`: текущая дата + paymentPeriodMonths месяцев

## 3. Процесс оплаты для юридических лиц

### 3.1. Генерация счета
**Страница:** Страница тарифов
- Пользователь выбирает тариф
- Пользователь выбирает период оплаты: **1, 3, 6, 12 месяцев**
- Кнопка "Сформировать счет"

### 3.2. API endpoint: POST /api/billing/invoice/generate

**Новый endpoint:**
```typescript
Request body:
{
  planId: number,
  paymentPeriodMonths: 1 | 3 | 6 | 12
}

Response:
{
  invoice: {
    id: number,
    invoiceNumber: string,
    amount: number,
    currency: string,
    paymentPeriodMonths: number,
    companyId: number,
    companyName: string,
    companyInn: string | null,
    createdAt: string
  },
  pdfUrl: string // URL для скачивания PDF счета
}
```

**Логика:**
1. Проверка авторизации (только admin)
2. Проверка типа плательщика: `Company.isLegalEntity === true`
3. Получение плана из БД
4. Расчет суммы: `plan.price * paymentPeriodMonths`
5. Генерация номера счета (автоматически)
6. Создание подписки (статус TRIAL)
7. Создание Invoice с:
   - `invoiceNumber` (уникальный, автоматически сгенерированный)
   - `paymentPeriodMonths`
   - `companyId`
   - `payerType: 'LEGAL'`
   - `status: 'PENDING'`
8. Генерация PDF счета (на основе существующей логики генерации PDF)
9. Возврат данных счета и URL PDF

### 3.3. Подтверждение оплаты (ручное)
**API endpoint: POST /api/admin/invoices/:id/confirm**

**Доступ:** Только для role === 'owner'

**Логика:**
1. Найти Invoice по ID
2. Проверить, что статус PENDING
3. Обновить Invoice: `status: 'PAID'`, `paidAt: new Date()`
4. Найти подписку по `subscriptionId`
5. Активировать подписку: `status: 'ACTIVE'`
6. Обновить `currentPeriodEnd`: текущая дата + paymentPeriodMonths месяцев

## 4. Административный интерфейс для продления подписки

### 4.1. Страница /ops (обновление)

**Изменения:**
- В таблице пользователей добавить колонку "ID компании"
- Добавить кнопку "Продлить подписку" для каждой компании (группировка по companyId)
- При клике открывается модальное окно

### 4.2. Модальное окно продления подписки

**Компонент:** `ExtendSubscriptionModal`

**Поля:**
- Компания (readonly): название, ID, ИНН (если есть)
- Текущая подписка (readonly): тариф, период окончания, статус
- Период продления: выбор 1, 3, 6, 12 месяцев
- Сумма к оплате: автоматический расчет

**API endpoint: POST /api/admin/extend-subscription**

```typescript
Request body:
{
  companyId: number,
  paymentPeriodMonths: 1 | 3 | 6 | 12
}

Response:
{
  invoice: {
    id: number,
    invoiceNumber: string,
    amount: number,
    paymentPeriodMonths: number
  },
  subscription: {
    id: number,
    currentPeriodEnd: string
  }
}
```

**Логика:**
1. Проверка доступа (только owner)
2. Найти компанию по companyId
3. Найти активную подписку компании
4. Если подписка не найдена - создать новую
5. Если подписка найдена:
   - Рассчитать новую дату окончания: `currentPeriodEnd + paymentPeriodMonths месяцев`
   - Обновить `currentPeriodEnd`
6. Создать Invoice для продления
7. Если компания - физ лицо: создать платеж в YooKassa и вернуть paymentUrl
8. Если компания - юр лицо: сгенерировать PDF счета и вернуть invoiceNumber

## 5. Автоматическая нумерация счетов

### Формат номера счета
`INV-YYYYMMDD-NNNN`
- `YYYYMMDD` - дата создания (20250111)
- `NNNN` - порядковый номер за день (0001, 0002, ...)

### Реализация
1. При создании Invoice:
   - Получить дату: `new Date().toISOString().slice(0, 10).replace(/-/g, '')`
   - Найти последний счет за этот день: `SELECT MAX(invoiceNumber) WHERE invoiceNumber LIKE 'INV-YYYYMMDD-%'`
   - Инкрементировать порядковый номер
   - Сохранить в формате `INV-YYYYMMDD-NNNN`

## 6. Страницы и компоненты

### 6.1. Страница тарифов (обновление)
**Файл:** Нужно создать или обновить существующую
- Список тарифов (LITE, TEAM, PRO)
- Для каждого тарифа:
  - Выбор периода: 1, 3, 6, 12 месяцев
  - Отображение цены за выбранный период
  - Кнопка:
    - "Оплатить подписку" (для физ лиц)
    - "Сформировать счет" (для юр лиц)

### 6.2. Страница /ops (обновление)
**Файл:** `app/ops/page.tsx`
- Добавить колонку "ID компании" в таблицу
- Группировка по компаниям (можно сделать отдельную секцию)
- Кнопка "Продлить подписку" для каждой компании
- Модальное окно `ExtendSubscriptionModal`

### 6.3. Компонент ExtendSubscriptionModal
**Файл:** `components/ExtendSubscriptionModal.tsx`
- Модальное окно с формой выбора периода
- Отображение информации о компании
- Отображение текущей подписки
- Расчет суммы
- Кнопки: "Продлить" / "Отмена"

## 7. API Endpoints (резюме)

### Обновляемые
- `POST /api/billing/payment` - добавить поддержку `paymentPeriodMonths`

### Новые
- `POST /api/billing/invoice/generate` - генерация счета для юр лиц
- `POST /api/admin/invoices/:id/confirm` - подтверждение оплаты счета (ручное)
- `POST /api/admin/extend-subscription` - продление подписки админом
- `GET /api/admin/companies` - список всех компаний с подписками (для /ops страницы)

## 8. Миграция базы данных

### Добавить в Invoice:
```sql
ALTER TABLE "Invoice" ADD COLUMN "invoiceNumber" TEXT UNIQUE;
ALTER TABLE "Invoice" ADD COLUMN "paymentPeriodMonths" INTEGER DEFAULT 1;
ALTER TABLE "Invoice" ADD COLUMN "companyId" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "payerType" TEXT DEFAULT 'INDIVIDUAL';

-- Создать индекс для быстрого поиска по номеру
CREATE INDEX "Invoice_invoiceNumber_idx" ON "Invoice"("invoiceNumber");

-- Внешний ключ (опционально)
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" 
  FOREIGN KEY ("companyId") REFERENCES "Company"("id");
```

## 9. Порядок реализации

1. ✅ Создать документ со структурой
2. Обновить Prisma schema (добавить поля в Invoice)
3. Создать миграцию
4. Обновить API /api/billing/payment (поддержка paymentPeriodMonths)
5. Создать API /api/billing/invoice/generate
6. Создать API /api/admin/invoices/:id/confirm
7. Создать API /api/admin/extend-subscription
8. Обновить страницу /ops (добавить ID компании, кнопку продления)
9. Создать компонент ExtendSubscriptionModal
10. Обновить/создать страницу тарифов (выбор периода, кнопки оплаты)
11. Тестирование
