# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Проект

Русскоязычный чат-бот для поиска дешёвых авиабилетов. **MVP** — поиск направления Шри-Ланка (аэропорт Коломбо, IATA: CMB) с заданным фильтром по цене. В дальнейшем планируется расширение скоупа: новые направления и сопутствующая функциональность.

Бот строго удерживается в рамках темы: авиабилеты, направления, даты, цены, практическая информация о перелётах. На off-topic вопросы (погода, рецепты, общие знания) — вежливый отказ и возврат к теме.

Текущий скоуп фиксируется в этом файле и в системном промпте бота (`lib/chat/system-prompt.ts`). Системный промпт параметризуется списком направлений (`buildSystemPrompt({ destinations: [...] })`) — расширение скоупа продукта обновляет конфиг, а не код. При расширении этот файл и конфиг направлений обновляются синхронно.

## Технологический стек

- **Next.js 16** (App Router) + TypeScript + React 19
- **Prisma 7** + PostgreSQL 16
- **Tailwind CSS v4** (через `@tailwindcss/postcss`) + **shadcn/ui**
- **Ollama** (через npm-пакет `ollama`) — модель задаётся через env `OLLAMA_MODEL`
- **Travelpayouts API** — источник данных о билетах (real-провайдер не реализован до получения ключа, работаем в `mock`)
- **Zod v4** — валидация env и tool-аргументов. JSON Schema из zod-схем — через встроенный `z.toJSONSchema`. Внешний `zod-to-json-schema` НЕ ставим — несовместим с zod v4.
- **Vitest** — юнит- и интеграционные тесты
- **Playwright** (через MCP) — e2e-тесты
- Шрифт Geist через `next/font/google`
- Path alias: `@/*` → корень проекта

## Архитектурные принципы

- **SOLID, DRY, KISS, YAGNI** — соблюдаем строго, без компромиссов.
- **DIP** — API-роуты и оркестратор зависят от интерфейсов (`IChatProvider`, `IFlightsProvider`), не от конкретных реализаций. Реализации поднимаются через lazy-фабрики (`getChatProvider()`, `getFlightsProvider()`) поверх конфига из `lib/env.ts`.
- **Repository pattern** — все обращения к БД через репозитории
  (`UserRepository`, `ChatRepository`, `MessageRepository`), никаких прямых вызовов `prisma.*` из API-роутов или компонентов.
- **Все внешние интеграции — за интерфейсами.** Ollama и Travelpayouts имеют интерфейсы (`IChatProvider`, `IFlightsProvider`) и реальные реализации + мок-реализации для тестов и CI.
- **SRP на уровне файлов.** Один файл — одна ответственность.
- **Env-переменные через единый модуль `lib/env.ts`** с валидацией через zod. Никаких `process.env.XXX` в разных местах кода.

## Структура каталогов
- `app/`                     # Next.js App Router
- `api/chats/`               # POST/GET список чатов
- `api/chats/[id]/messages/` # POST (tool-loop) + GET истории
- `chat/[id]/`               # Страницы чата
- `generated/prisma/`        # Сгенерированный Prisma Client (в .gitignore)
- `components/`
- `ui/`                      # shadcn/ui компоненты (не править вручную)
- `chat/`                    # Наши компоненты чата
- `lib/`
- `api/`                     # withApiHandler + кастомные ошибки
- `auth/`                    # getCurrentUser (MVP, lazy upsert)
- `db/`                      # Prisma Client + репозитории
- `ollama/`                  # IChatProvider + Ollama- и Mock-реализации
- `flights/`                 # IFlightsProvider + Mock-реализация
- `chat/`                    # Системный промпт + search_flights tool + tool-loop оркестратор
- `env.ts`                   # Валидация env через zod
- `prisma/`
- `schema.prisma`
- `migrations/`
- `tests/`
- `unit/`                    # Vitest
- `e2e/`                     # Playwright
- `setup.ts`                 # dotenv/config
- `utils/env.ts`             # setEnv/unsetEnv
- `stubs/server-only.ts`

## Что уже реализовано

Все слои покрыты тестами, тесты идут вместе с кодом в одном коммите. Состояние на момент завершения шага 4: ~153 зелёных юнит-теста, четыре API-роута (POST/GET `/api/chats`, POST/GET `/api/chats/[id]/messages`).

### `lib/env.ts`
zod-валидация env, синглтон, `server-only`. Поля: см. раздел «Переменные окружения».

### `lib/db/`
PrismaClient singleton через `PrismaPg` adapter. Репозитории `UserRepository`, `ChatRepository`, `MessageRepository` (паттерн: интерфейс + класс + singleton). Конвенция: `export type User = UserModel` для очищения Prisma-суффиксов. Каскады `User → Chat → Message`. Индексы: `idx_chats_user_updated`, `idx_messages_chat_created`. Enum `MessageRole` (`system`, `user`, `assistant`, `tool`).

### `lib/ollama/`
Контракт `IChatProvider { chat(req): Promise<ChatResponse> }`. Non-streaming в v1 (streaming откладываем до UI отдельным `IStreamingChatProvider`). Tool-calling заложен в контракт: `ChatMessage.toolCalls`, `ToolDefinition` в `ChatRequest`. ID tool-вызовов синтетические (`call_0`, `call_1`, ...) — `ollama-js` их не отдаёт.

Реализации:
- `OllamaChatProvider` поверх `ollama-js`. Гибридная стратегия клиента: shared-инстанс для запросов без `AbortSignal` (нулевой overhead), изолированный инстанс на каждый запрос с `signal` (`ollama.abort()` грохает все активные запросы клиента — изоляция обязательна).
- `MockChatProvider` — список правил `{ match, respond }` + fallback. `respond` — функция, не значение (stateful-ответы через замыкание + инспекция запроса).

Фабрика `createChatProvider(config)` + lazy singleton `getChatProvider()`. Публичная поверхность barrel-а: `IChatProvider`, типы, `createChatProvider`, `getChatProvider`. Mock/Ollama-реализации, мапперы, сценарии — внутренние.

### `lib/flights/`
Контракт `IFlightsProvider { search(params, signal?): Promise<FlightOffer[]> }`. Задокументированные инварианты: результат отсортирован по `price ASC`; `maxPrice` отсекает дороже; размер ≤ `limit` (default 5); aborted signal → `AbortError` без HTTP-запросов.

Ключевые решения:
- `FlightSearchParams.destination` — параметр, не хардкод. Удержание скоупа — работа системного промпта, не инфраструктуры.
- `FlexibleDate.flexDays` описывает намерение пользователя. Travelpayouts диапазон не умеет — real-провайдер при появлении будет делать `2·flex+1` параллельных запросов и склеивать. Для мока проблемы нет.
- Round-trip — одно вложенное `FlightOffer` с полями `outbound` и `return` (тип `FlightSegment` переиспользуется), одна цена за пару, не два отдельных оффера.
- Сортировка всегда `price ASC`, без `sortBy`. Соответствует позиционированию «дешёвые авиабилеты».
- `FLIGHT_SEARCH_DEFAULTS = { passengers: 1, currency: 'RUB', limit: 5 }` — fallback контракта в коде; `TRAVELPAYOUTS_CURRENCY` в env — для переключения валюты в одном месте на уровне инстанса провайдера.

Реализации:
- `MockFlightsProvider` — инварианты контракта (сортировка/фильтрация/лимит) живут в КЛАССЕ, не в генераторе. Это LSP: любой генератор автоматически получает корректное поведение. `defaultCurrency` подставляется в `params.currency`, если запрос её не задал.
- `defaultMockGenerator` — 6 шаблонов рейсов (SU/TK/QR/EK/S7/EK2), цены 42–72k RUB, пересадки 0/1/2. Раскладывает шаблоны на все даты в пределах `flexDays`. Умножает цену на `passengers` и на 2 для round-trip.

Фабрика: `createFlightsProvider(config)`. `mode='real'` сейчас кидает Error с инструкцией переключиться в `mock` (TravelpayoutsFlightsProvider не реализован до получения ключа). При появлении ключа добавится `travelpayouts-provider.ts` и case `'real'` заменится на `new TravelpayoutsFlightsProvider(...)`. `getFlightsProvider()` — lazy singleton поверх env, пробрасывает `TRAVELPAYOUTS_CURRENCY` как `defaultCurrency`.

### `lib/chat/`
- `buildSystemPrompt({ destinations, now? })` — системный промпт, параметризованный по списку направлений и текущей дате (для разрешения относительных дат типа «в мае»). Off-topic фильтр статичен и от скоупа не зависит — он есть всегда.
- `MVP_DESTINATIONS` — единый источник списка направлений MVP (сейчас только `Коломбо/CMB`). Расширение скоупа — обновление этого массива и CLAUDE.md в одном коммите.
- `searchFlightsTool: ToolDefinition` — JSON Schema инструмента получается из zod-схемы через `z.toJSONSchema(schema, { target: 'openapi-3.0' })`. Tool-args — подмножество `FlightSearchParams` (без `currency` и `limit` — это системные настройки, модель их не указывает).
- `parseSearchFlightsArguments(raw): ParseResult<...>` — `safeParse` → discriminated result, без эксепшенов на ожидаемые сценарии. Модель регулярно ошибается в аргументах — это штатный control flow tool-loop, а не баг.
- `executeSearchFlights(toolCall, deps)` — total-функция, всегда возвращает `ChatMessage` role='tool'. Формат content (JSON-конверт): `{ count, currency, priceRange, offers }`. Ошибки провайдера заворачиваются в `{ error: 'provider', message }`. `AbortError` пробрасывается наружу.
- `runChatTurn({ messages, chatProvider, flightsProvider, tools, signal, maxIterations? })` — tool-loop оркестратор. Прокручивает диалог `chatProvider → executeSearchFlights → chatProvider` до финального assistant без `toolCalls`. `MAX_TOOL_ITERATIONS = 5`, при превышении возвращает накопленный след + assistant-fallback. `AbortSignal` пробрасывается насквозь — отмена клиента моментально останавливает и `chat`, и tool-вызовы. Возвращает только новые сообщения turn-а (без исходного user).

### `lib/auth/`
- `getCurrentUser(): Promise<User>` — единственная точка получения текущего пользователя. MVP-схема: `userRepository.findByEmail(env.MVP_USER_EMAIL)` + lazy create при первом запросе. Когда появится настоящая авторизация, меняется только эта функция.

### `lib/api/`
- `withApiHandler(handler)` — обёртка для App Router-роутов. Маппит `ZodError → 400 { error: 'validation', issues }`, `NotFoundError → 404`, `ValidationError → 400`, `ForbiddenError → 403`. `AbortError` пробрасывается наверх (Next закрывает соединение). Прочие ошибки → 500 + `console.error`.
- `errors.ts` — `NotFoundError`, `ValidationError`, `ForbiddenError`. Несут поле `statusCode`. Для «не существует / чужой» используем `NotFoundError` (а не `ForbiddenError`), чтобы не палить факт существования чужого ресурса.

### `app/api/chats/`
- `POST /api/chats` — создаёт чат под текущим MVP-пользователем (поле `model = env.OLLAMA_MODEL`, `title` опционален, валидация Zod, max 200). 201 + `{ id, title, updatedAt }`.
- `GET /api/chats` — список чатов пользователя по `updatedAt DESC`. `{ chats: Array<{ id, title, updatedAt }> }`.
- `POST /api/chats/[id]/messages` — главный chat-эндпоинт. Записывает user-сообщение, поднимает всю историю, подмешивает system-prompt, прогоняет `runChatTurn` и сохраняет весь след turn-а: assistant с tool_calls (`content = JSON.stringify(toolCalls)`, `tool_name = '__tool_calls__'` — sentinel), tool-result, финальный assistant. Записи делаются последовательно, чтобы `createdAt` оставался монотонным. Ответ: `{ message: <финальный assistant> }`. Чужой/несуществующий чат → 404.
- `GET /api/chats/[id]/messages` — история, видимая UI. Фильтрует `tool` и assistant с `tool_name === '__tool_calls__'`, оставляет только `user`/`assistant` с человекочитаемым текстом. Чужой/несуществующий чат → 404.

## Правила написания кода

- **TypeScript strict.** `any` запрещён. Если нужна широкая типизация — `unknown` + narrowing.
- **Импорт типов** — `import type { ... }` для type-only имён. При `verbatimModuleSyntax` обычный импорт типа ломает сборку.
- **Именование.** PascalCase для типов, классов, компонентов. camelCase для функций и переменных. kebab-case для имён файлов.
- **Prisma-модели** — PascalCase в коде (`prisma.user`), snake_case в БД через `@@map`.
- **Без комментариев-шума.** Комментарий пишем только когда объясняет
  *почему*, а не *что*.
- **Никаких inline-стилей.** Только Tailwind-классы.

## Тесты

- **Каждый новый модуль — с тестами в том же коммите.** Без исключений.
- **Юнит-тесты репозиториев** работают против реальной тестовой БД (`chatbot_test` в CI), не против моков.
- **`vitest.config.ts`:** `fileParallelism: false` (тесты идут последовательно — важно для БД), `vite-tsconfig-paths` для path-алиасов, stub `server-only` через `resolve.alias`.
- **`tests/setup.ts`** — `import 'dotenv/config'`. Vitest не читает `.env` автоматически.
- **Тесты API** — на мок-реализациях Ollama и Travelpayouts (`OLLAMA_MODE=mock`, `TRAVELPAYOUTS_MODE=mock`).
- **E2E через Playwright** — покрывают ключевые сценарии: создать чат, отправить сообщение, получить ответ с билетами, отказ на off-topic.

## Чего НЕ делать

- Не коммитить `.env` и любые секреты.
- Не ставить новые npm-зависимости без явного запроса в задаче.
- Не ставить `zod-to-json-schema` — несовместим с zod v4. Использовать встроенный `z.toJSONSchema`.
- Не трогать папку `components/ui/` вручную — это shadcn, обновляется через `npx shadcn add`.
- Не трогать `app/generated/prisma/` — генерируется автоматически.
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
* `MVP_USER_EMAIL` — email текущего пользователя для MVP-режима без
  авторизации. `getCurrentUser()` делает по нему `findByEmail` + lazy
  upsert, поэтому email должен быть валидным форматом. Меняется только
  при появлении настоящего auth-слоя.

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
- `npm run lint` — ESLint напрямую (`eslint .`). В Next.js 16 команда `next lint` удалена, поэтому скрипт не оборачивает её.
- `npm test` — юнит-тесты (Vitest), эквивалент `vitest run`.
- `npm run test:watch` — Vitest в watch-режиме.
- `npm run test:coverage` — Vitest с покрытием (`vitest run --coverage`).
- `npm run test:e2e` — e2e-тесты (Playwright).
- `npx tsc --noEmit` — проверка типов без эмита. Vitest проверяет только синтаксис (через esbuild), типы — задача `tsc`.
- `npx prisma migrate dev --name X` — новая миграция локально.
- `npx prisma migrate deploy` — применить миграции в CI/prod.
- `npx prisma studio` — GUI для БД.

**Стандартный цикл проверки перед коммитом:**

```bash
npx tsc --noEmit && npm run lint && npm test
```

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

## Key Constraints — Next.js 16

- **APIs and conventions могут отличаться** от ранних версий. Перед использованием незнакомых API — читать `node_modules/next/dist/docs/`.
- **`next lint` удалена.** Скрипт `lint` в `package.json` вызывает `eslint .` напрямую. Конфиг — `eslint.config.mjs` (flat config, `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`).
- **`process.env.NODE_ENV` типизирован readonly** — в тестах используем утилиты `setEnv`/`unsetEnv` из `tests/utils/env.ts`.

## Key Constraints — Ollama

- Для локального запуска сервер должен быть доступен на `localhost:11434`.
- В CI всегда используется mock-режим (`OLLAMA_MODE=mock`).
- Модель задаётся через env `OLLAMA_MODEL`. Для dev — `qwen3.5:cloud`.