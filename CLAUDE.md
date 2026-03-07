# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"사주 vs 타로 — 운명의 대결" (Saju vs Tarot Battle) — an entertainment fortune-telling web service where Eastern saju (四柱) and Western tarot compete to interpret the user's fortune across 3 rounds.

## Tech Stack

- **Vanilla HTML/CSS/JS SPA** — no build tools, no framework, no bundler
- **OpenRouter API** with DeepSeek V3.2 model (`deepseek/deepseek-v3.2:floor`) for AI fortune interpretations
- **bkend.ai BaaS** for result storage and sharing
- **html2canvas** (CDN-loaded) for result image generation
- Serve with any static file server (e.g., `npx serve .` or VS Code Live Server)

## Running Locally

```bash
# 1. Create .env file with OpenRouter API key
echo "OPENROUTER_API_KEY=your_key_here" > .env

# 2. Serve statically (config.js fetches .env at runtime)
npx serve .
```

No install, no build step. The `.env` file is fetched via `fetch('.env')` in `config.js` at runtime.

## Architecture

### Module Pattern
All JS modules use the **IIFE revealing module pattern** — each file exposes a global object (e.g., `SajuEngine`, `TarotEngine`). No ES modules, no imports. Script load order in `index.html` matters.

### Script Load Order (index.html)
```
config.js → saju.js → lunar.js → tarot.js → ai-interpreter.js → battle.js → bkend-client.js → share.js → loading-messages.js → app.js
```
`app.js` is the entry point that orchestrates everything. It awaits `window.__CONFIG_READY__` before initializing.

### Key Modules

| File | Global | Role |
|------|--------|------|
| `config.js` | `window.__CONFIG__` | Loads `.env`, sets API keys and model config |
| `js/saju.js` | `SajuEngine` | Saju (四柱) calculation — pillars, hidden stems, clashes, combinations, major luck cycles, 12 stages |
| `js/tarot.js` | `TarotEngine` | 78-card tarot deck — shuffle, draw, spreads, elemental dignity, pattern analysis |
| `js/lunar.js` | `LunarConverter` | Lunar-to-solar date conversion (1900-2050), no external API |
| `js/ai-interpreter.js` | `AIInterpreter` | OpenRouter API caller with retry/backoff. Generates saju & tarot readings |
| `js/battle.js` | `BattleEngine` | 3-round battle orchestrator (연애운→재물운→종합운세) |
| `js/bkend-client.js` | `BkendClient` | bkend.ai REST wrapper for saving/loading results |
| `js/share.js` | `ShareManager` | Result image generation + SNS sharing (Kakao, Twitter, URL copy) |
| `js/app.js` | (async IIFE) | Main controller — DOM binding, section transitions, rendering |

### Page Flow
Intro → Input (birthdate/gender/question) → 3-Round Battle → Final Result → Share

### API Call Pattern
7 OpenRouter API calls per session:
- 2 per round (saju reading + tarot reading) × 3 rounds = 6
- 1 final judgment call
- Rate limit mitigation: 5s cooldown between rounds, 2s between API calls, exponential backoff on 429

### Scoring
User vote (60%) + AI judgment (40%) determines the winner of each round.

### Data Files
- `data/cheongan.json`, `data/jiji.json`, `data/sipsung.json` — Saju reference data (천간, 지지, 십성)
- `data/tarot-major.json` (22 cards), `data/tarot-minor.json` (56 cards) — Tarot card definitions
- `images/tarot/` — 78 tarot card images (JPG)

## DOM Safety
`app.js` uses `createEl()` helper and `escapeHtml()` for all dynamic DOM creation — no direct `innerHTML` with user data.

## PDCA Documentation
Feature documentation follows bkit PDCA methodology in `docs/`:
- `docs/01-plan/features/` — Plan documents
- `docs/02-design/features/` — Design documents
- `docs/03-analysis/` — Gap analysis reports
- `docs/04-report/` — Completion reports

Completed features: `saju-vs-tarot-battle`, `tarot-card-images`, `engine-upgrade`, `ux-upgrade`
