# Becoming

> Watch something become someone.

Becoming is a mobile-first, installable life-sim about a virtual creature that grows from a newly hatched being into a persistent individual with memory, personality, opinions, an emerging identity, and a relationship with the player.

The project is a polished vertical slice built around one principle: the player should understand the creature through behaviour, language, and shared history rather than a permanent meter dashboard.

**Play:** https://megabomb420.github.io/becoming/

## Core principles

- **Readable without raw stats.** Needs first appear through body language and a compact room signal; an optional care sheet names urgency and the helpful action without percentages or permanent bars. Bond, personality, and life paths remain behavioural.
- **Local-first.** The complete creature and conversation history live in IndexedDB on the device.
- **The outside world is interpreted, not displayed.** Optional Open-Meteo weather becomes light, soundless atmosphere, need pressure, behaviour, preference, and memory instead of a forecast dashboard.
- **One persistent individual.** Seeded temperament provides continuity while care and experience gradually change the creature.
- **No death from neglect.** Time away affects the relationship without punishing the player or deleting progress.
- **AI is optional infrastructure.** Higher-level conversation uses a private gateway. Room speech bubbles are DeepSeek text only; a failed call does not invent a local line.

## Stack

- React 18 and TypeScript
- Vite 8 and `vite-plugin-pwa`
- Tailwind CSS 3
- IndexedDB through `idb`
- HTML5 Canvas for the creature
- Open-Meteo Forecast and Geocoding APIs, without an API key
- Cloudflare Worker gateway for DeepSeek V4 Flash
- GitHub Pages deployment through GitHub Actions

## Local development

Requirements: Node.js 22.12 or newer and npm.

```bash
npm ci
npm run dev
```

The development server runs at `http://localhost:7100/becoming/`.

Create a local `.env` from `.env.example` when testing the remote conversation gateway. Never put provider credentials in a `VITE_*` variable or any browser bundle.

## Validation

```bash
npm test       # deterministic system checks and Worker security checks
npm run build  # TypeScript and production PWA build
npm run check  # complete pre-deploy verification
```

`npm run check` is the same verification gate used before GitHub Pages deployment.

## Architecture map

| Area | Main files |
|---|---|
| Application lifecycle and persistence | `src/App.tsx`, `src/systems/persistence.ts` |
| Creature data model | `src/types/index.ts` |
| Needs, solar time, weather, development, and relationship | `needsSystem.ts`, `timeSystem.ts`, `weatherService.ts`, `environmentSystem.ts`, `developmentSystem.ts`, `relationshipSystem.ts` |
| Conversation and local fallback | `conversationSystem.ts`, `languageSystem.ts`, `llmConversation.ts` |
| Memory and continuity | `memoryBook.ts`, `continuitySystem.ts`, `presenceSystem.ts` |
| Identity, interests, and life paths | `lifePathSystem.ts`, `innerLifeSystem.ts` |
| Objects, creations, and touch | `Room.tsx`, `creationSystem.ts`, `boundarySystem.ts` |
| Creature rendering | `CreatureCanvas.tsx`, `ObjectIcon.tsx` |
| Private AI gateway | `worker/src/index.js` |

The full implementation history, current feature inventory, architecture decisions, and roadmap live in [HANDOFF.md](HANDOFF.md). Worker deployment instructions live in [worker/README.md](worker/README.md).

## Privacy and backup

There is no account or automatic cloud sync. Weather is opt-in. Device coordinates are rounded to two decimal places before Open-Meteo receives them; a manually selected city and the last successful forecast are cached with the creature in IndexedDB. A validated JSON backup can include personal conversation content and the rounded weather location, so it should be treated as private.

## Deployment

Every push to `main` runs the system checks, Worker checks, TypeScript compilation, and production PWA build. GitHub Pages deploys only after that verification succeeds.
