# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

Next.js 16 application that integrates with [Ollama](https://ollama.com/) (local LLM inference) via the `ollama` npm package. Uses App Router, React 19, Tailwind CSS v4, and TypeScript.

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
