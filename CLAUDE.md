# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Next.js 16 application that integrates with [Ollama](https://ollama.com/) (local LLM inference) via the `ollama` npm package. Uses App Router, React 19, Tailwind CSS v4, and TypeScript.\
Создаем чат-бота поиска авиабилетов на Шри-Ланку с помощью Ollama.

## Стек
- Next.js 15 (App Router), TypeScript
- PostgreSQL + Prisma
- Tailwind CSS v4 + shadcn/ui
- Ollama (модель задаётся через env OLLAMA_MODEL)
- Travelpayouts API (через env TRAVELPAYOUTS_TOKEN, TRAVELPAYOUTS_MARKER)
- Vitest — юнит-тесты, Playwright — e2e

## Правила кода
- SOLID, DRY, KISS, YAGNI
- Repository pattern для доступа к данным
- Никаких `prisma` вызовов прямо в API-роутах
- Все внешние API (Ollama, Travelpayouts) за интерфейсами — для моков в тестах
- Каждый новый модуль — с тестами в том же коммите

## Структура
- `app/` — роуты и страницы Next.js
- `app/api/` — API endpoints
- `lib/db/` — Prisma client и репозитории
- `lib/ollama/` — клиент Ollama
- `lib/flights/` — клиент Travelpayouts
- `components/` — UI-компоненты (shadcn внутри `components/ui/`)
- `tests/` — unit и e2e тесты

## Что НЕ делать
- Не коммитить `.env`
- Не ставить новые зависимости без согласования в issue
- Не писать код без тестов
- Не использовать `any` в TypeScript

## Commands

- `npm run dev` — start dev server (localhost:3000)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint (flat config, Next.js core-web-vitals + TypeScript rules)

## Architecture

- **App Router** (`app/`) — single layout + page; no API routes yet
- **Styling** — Tailwind CSS v4 via `@tailwindcss/postcss`; Geist font loaded through `next/font/google`
- **Path alias** — `@/*` maps to project root
- **Ollama client** — `ollama` package (v0.6.x) for communicating with a local Ollama server

## Key Constraints

- Next.js **16** — APIs and conventions may differ from earlier versions. Read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Ollama server must be running locally for LLM features to work.
