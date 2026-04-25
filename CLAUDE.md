# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Проект

Русскоязычный чат-бот для поиска дешёвых авиабилетов. **MVP** — поиск направления Шри-Ланка (аэропорт Коломбо, IATA: CMB) с заданным фильтром по цене. В дальнейшем планируется расширение скоупа: новые направления и сопутствующая функциональность.

Бот строго удерживается в рамках темы: авиабилеты, направления, даты, цены, практическая информация о перелётах. На off-topic вопросы (погода, рецепты, общие знания) — вежливый отказ и возврат к теме.

Текущий скоуп фиксируется в этом файле и в системном промпте бота (когда появится — `lib/chat/`). При расширении продукта оба обновляются синхронно.

## Технологический стек

- **Next.js 16** (App Router) + TypeScript + React 19
- **Prisma 7** + PostgreSQL 16
- **Tailwind CSS v4** (через `@tailwindcss/postcss`) + **shadcn/ui**
- **Ollama** (через npm-пакет `ollama`) — модель задаётся через env `OLLAMA_MODEL`
- **Travelpayouts API** — источник данных о билетах
- **Vitest** — юнит- и интеграционные тесты
- **Playwright** (через MCP) — e2e-тесты
- Шрифт Geist через `next/font/google`
- Path alias: `@/*` → корень проекта

## Архитектурные принципы

- **SOLID, DRY, KISS, YAGNI** — соблюдаем строго, без компромиссов.
- **Repository pattern** — все обращения к БД через репозитории
  (`UserRepository`, `ChatRepository`, `MessageRepository`), никаких прямых вызовов `prisma.*` из API-роутов или компонентов.
- **Все внешние интеграции — за интерфейсами.** Ollama и Travelpayouts имеют интерфейсы (`IChatProvider`, `IFlightsProvider`) и реальные реализации + мок-реализации для тестов и CI.
- **SRP на уровне файлов.** Один файл — одна ответственность.
- **Env-переменные через единый модуль `lib/env.ts`** с валидацией через zod. Никаких `process.env.XXX` в разных местах кода.

## Структура каталогов
- `app/`                     # Next.js App Router
- `api/`                     # API endpoints
- `chat/[id]/`               # Страницы чата
- `generated/prisma/`        # Сгенерированный Prisma Client (в .gitignore)
- `components/`
- `ui/`                      # shadcn/ui компоненты (не править вручную)
- `chat/`                    # Наши компоненты чата
- `lib/`
- `db/`                      # Prisma Client + репозитории
- `ollama/`                  # Клиент Ollama + моки
- `flights/`                 # Клиент Travelpayouts + моки
- `env.ts`                   # Валидация env через zod
- `prisma/`
- `schema.prisma`
- `migrations/`
- `tests/`
- `unit/`                    # Vitest
- `e2e/`                     # Playwright

## Правила написания кода

- **TypeScript strict.** `any` запрещён. Если нужна широкая типизация — `unknown` + narrowing.
- **Именование.** PascalCase для типов, классов, компонентов. camelCase для функций и переменных. kebab-case для имён файлов.
- **Prisma-модели** — PascalCase в коде (`prisma.user`), snake_case в БД через `@@map`.
- **Без комментариев-шума.** Комментарий пишем только когда объясняет
  *почему*, а не *что*.
- **Никаких inline-стилей.** Только Tailwind-классы.

## Тесты

- **Каждый новый модуль — с тестами в том же коммите.** Без исключений.
- **Юнит-тесты репозиториев** работают против реальной тестовой БД (`chatbot_test` в CI), не против моков.
- **Тесты API** — на мок-реализациях Ollama и Travelpayouts (`OLLAMA_MODE=mock`, `TRAVELPAYOUTS_MODE=mock`).
- **E2E через Playwright** — покрывают ключевые сценарии: создать чат, отправить сообщение, получить ответ с билетами, отказ на off-topic.

## Чего НЕ делать

- Не коммитить `.env` и любые секреты.
- Не ставить новые npm-зависимости без явного запроса в задаче.
- Не трогать папку `components/ui/` вручную — это shadcn, обновляется через `npx shadcn add`.
- Не писать код без тестов.
- Не использовать `any` в TypeScript.
- Не обращаться к Prisma Client напрямую из API-роутов — только через репозитории.
- Не менять `schema.prisma` без создания миграции через `npx prisma migrate dev --name <осмысленное_имя>`.
- Не писать код «на вырост» для фич, которых нет в текущей задаче. YAGNI применяется построчно, не только к продуктовому скоупу.
- Не менять `lib/env.ts` без синхронной правки `.env.example` в том же коммите. Конвенция записи — в разделе «Переменные окружения».

## Переменные окружения

Все переменные валидируются в `lib/env.ts` через zod при импорте модуля (fail-fast). В рантайме читаются только из `.env`. 
Канонический справочник формы (что обязательно, что опционально, какие дефолты) — `.env.example` в корне репо.

**Обязательные** (zod-схема без `.default(...)`):

* `DATABASE_URL` — строка подключения к PostgreSQL.
* `OLLAMA_MODEL` — имя модели (`qwen3.5:cloud` для dev/prod).
* `OLLAMA_MODE` — `real` | `mock`. В CI всегда `mock`. В dev — `mock`,
  пока нет локально запущенной Ollama.
* `TRAVELPAYOUTS_TOKEN` — API-ключ. Пока ключа нет — любое непустое
  значение (используется только при `TRAVELPAYOUTS_MODE=real`).
* `TRAVELPAYOUTS_MARKER` — партнёрский маркер. Аналогично, любое
  непустое значение до получения реального.
* `TRAVELPAYOUTS_MODE` — `real` | `mock`. В CI и dev всегда `mock`,
  пока не реализован `TravelpayoutsFlightsProvider`. При `real` фабрика
  `lib/flights/factory.ts` бросает Error с инструкцией переключиться
  в `mock`.

**Опциональные** (zod-схема с `.default(...)`):

* `NODE_ENV` — `development` | `production` | `test`. Дефолт `development`.
* `OLLAMA_HOST` — URL Ollama-сервера. Дефолт `http://127.0.0.1:11434`.
  Переопределяется только для cloud-режима на VDS.
* `TRAVELPAYOUTS_CURRENCY` — ISO 4217, ровно 3 символа. Дефолт `RUB`.
  Используется как `defaultCurrency` для `IFlightsProvider`, если параметры запроса не задают свою валюту.

**Как это отражено в `.env.example`**:

* Обязательные — раскомментированы, значение — плейсхолдер (`your_token_here`) или пример формата.
* Опциональные — закомментированы, значение — реальный дефолт из zod-схемы (например, `# OLLAMA_HOST=http://127.0.0.1:11434`). Разработчик раскомментирует, только если хочет переопределить.

`.env.example` коммитится в репо. `.env` — в `.gitignore`. Локальная копия создаётся через `cp .env.example .env` + подстановка реальных секретов.

## Команды

- `npm run dev` — запуск dev-сервера (localhost:3000).
- `npm run build` — продакшен-сборка.
- `npm run start` — продакшен-сервер.
- `npm run lint` — ESLint (Next.js core-web-vitals + TypeScript).
- `npm test` — юнит-тесты (Vitest).
- `npm run test:e2e` — e2e-тесты (Playwright).
- `npx prisma migrate dev --name X` — новая миграция локально.
- `npx prisma migrate deploy` — применить миграции в CI/prod.
- `npx prisma studio` — GUI для БД.

## Key Constraints — Prisma 7

У проекта **Prisma 7 с новым runtime** (`provider = "prisma-client"` в `schema.prisma`). Это важно, потому что поведение отличается от Prisma 5/6, и большинство туториалов в интернете устарели. Конкретные правила:

### 1. URL подключения — только в `prisma.config.ts`

В `schema.prisma` **нет** `url`, только `provider`:

```prisma
datasource db {
  provider = "postgresql"
}
```

URL читается из `.env` через `dotenv/config` в `prisma.config.ts`.

### 2. Конструктор клиента — через adapter, не через `datasourceUrl`

Параметры `datasourceUrl` и `datasources` в Prisma 7 удалены. URL передаётся через driver adapter:

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/app/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

Любая попытка использовать `datasourceUrl` или `datasources` приводит к ошибке `Unknown property ... provided to PrismaClient constructor`.

### 3. Импорт клиента — не из корня, а из `/client`

Новый runtime не генерирует `index.ts` в корне `app/generated/prisma/`.
Правильные пути импорта:

- `import { PrismaClient } from '@/app/generated/prisma/client'` — сам клиент
- `import type { User, Chat, Message } from '@/app/generated/prisma/models'` — типы моделей
- `import { MessageRole } from '@/app/generated/prisma/enums'` — enum'ы

Конвенция репозиториев: в `*.repository.ts` делаем `export type User = UserModel`,
чтобы наружу шло чистое имя без Prisma-специфичного суффикса.

### 4. Модели в PascalCase, таблицы в snake_case

В `schema.prisma` модели `User`, `Chat`, `Message`. В БД таблицы
`users`, `chats`, `messages`. Связь через `@@map` на уровне модели
и `@map` на уровне полей. Отсюда в коде:

```ts
await prisma.user.findUnique(...)   // НЕ prisma.users
await prisma.chat.create(...)       // НЕ prisma.chats
await prisma.message.findMany(...)  // НЕ prisma.messages
```

### 5. `server-only` и тесты

Модули, импортирующие `server-only` (напр. `lib/env.ts`, `lib/db/client.ts`),
**не могут быть импортированы** из client-компонентов. Это защита Next.js.

В Vitest `server-only` замокан пустым модулем через `resolve.alias` в `vitest.config.ts`. Это работает из коробки, трогать не надо.

### 6. Переменные окружения в тестах

Vitest не читает `.env` автоматически. Это делает `tests/setup.ts` через `import 'dotenv/config'`. 
Любой тест, обращающийся к `env`, требует корректных значений в `.env`.

## Key Constraints — Next.js

- **Next.js 16** — APIs and conventions may differ from earlier versions.
  Read `node_modules/next/dist/docs/` before using unfamiliar APIs.

## Key Constraints — Ollama

- Для локального запуска сервер должен быть доступен на `localhost:11434`.
- В CI всегда используется mock-режим (`OLLAMA_MODE=mock`).
- Модель задаётся через env `OLLAMA_MODEL`. Для dev — `qwen3.5:cloud`.