# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

@AGENTS.md

## Проект

Русскоязычный чат-бот для поиска дешёвых авиабилетов на Шри-Ланку
(аэропорт Коломбо, IATA: CMB) с заданным фильтром по цене.

Бот строго удерживается в рамках темы: авиабилеты, направления, даты,
цены, практическая информация о перелётах. На off-topic вопросы
(погода, рецепты, общие знания) — вежливый отказ и возврат к теме.

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
  (`UserRepository`, `ChatRepository`, `MessageRepository`), никаких
  прямых вызовов `prisma.*` из API-роутов или компонентов.
- **Все внешние интеграции — за интерфейсами.** Ollama и Travelpayouts
  имеют интерфейсы (`IChatProvider`, `IFlightsProvider`) и реальные
  реализации + мок-реализации для тестов и CI.
- **SRP на уровне файлов.** Один файл — одна ответственность.
- **Env-переменные через единый модуль `lib/env.ts`** с валидацией
  через zod. Никаких `process.env.XXX` в разных местах кода.

## Структура каталогов
`app/`                     # Next.js App Router
`api/`                     # API endpoints
`chat/[id]/`               # Страницы чата
`generated/prisma/`        # Сгенерированный Prisma Client (в .gitignore)
`components/`
`ui/`                      # shadcn/ui компоненты (не править вручную)
`chat/`                    # Наши компоненты чата
`lib/`
`db/`                      # Prisma Client + репозитории
`ollama/`                  # Клиент Ollama + моки
`flights/`                 # Клиент Travelpayouts + моки
`env.ts`                   # Валидация env через zod
`prisma/`
`schema.prisma`
`migrations/`
`tests/`
`unit/`                    # Vitest
`e2e/`                     # Playwright

## Правила написания кода

- **TypeScript strict.** `any` запрещён. Если нужна широкая типизация —
  `unknown` + narrowing.
- **Именование.** PascalCase для типов, классов, компонентов. camelCase
  для функций и переменных. kebab-case для имён файлов.
- **Prisma-модели** — PascalCase в коде (`prisma.user`), snake_case
  в БД через `@@map`.
- **Без комментариев-шума.** Комментарий пишем только когда объясняет
  *почему*, а не *что*.
- **Никаких inline-стилей.** Только Tailwind-классы.

## Тесты

- **Каждый новый модуль — с тестами в том же коммите.** Без исключений.
- **Юнит-тесты репозиториев** работают против реальной тестовой БД
  (`chatbot_test` в CI), не против моков.
- **Тесты API** — на мок-реализациях Ollama и Travelpayouts
  (`OLLAMA_MODE=mock`, `TRAVELPAYOUTS_MODE=mock`).
- **E2E через Playwright** — покрывают ключевые сценарии: создать чат,
  отправить сообщение, получить ответ с билетами, отказ на off-topic.

## Чего НЕ делать

- Не коммитить `.env` и любые секреты.
- Не ставить новые npm-зависимости без явного запроса в задаче.
- Не трогать папку `components/ui/` вручную — это shadcn, обновляется
  через `npx shadcn add`.
- Не писать код без тестов.
- Не использовать `any` в TypeScript.
- Не обращаться к Prisma Client напрямую из API-роутов — только через
  репозитории.
- Не менять `schema.prisma` без создания миграции через
  `npx prisma migrate dev --name <осмысленное_имя>`.
- Не расширять функциональность за пределы темы «поиск авиабилетов
  на Шри-Ланку». YAGNI.

## Переменные окружения

- `DATABASE_URL` — строка подключения к PostgreSQL.
- `OLLAMA_MODEL` — имя модели (`qwen3.5:cloud` для dev/prod).
- `OLLAMA_MODE` — `real` | `mock`. В CI всегда `mock`.
- `TRAVELPAYOUTS_TOKEN` — API-ключ (в CI — `mock`).
- `TRAVELPAYOUTS_MARKER` — партнёрский маркер.
- `TRAVELPAYOUTS_MODE` — `real` | `mock`.

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

## Key Constraints

- **Next.js 16** — APIs and conventions may differ from earlier versions.
  Read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- **Prisma 7** — URL подключения задаётся в `prisma.config.ts`, не в
  `schema.prisma`. В клиенте — через `new PrismaClient({ datasourceUrl })`.
- **Ollama** — для локального запуска сервер должен быть доступен на
  `localhost:11434`. В CI всегда используется mock-режим.