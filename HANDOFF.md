# Becoming — Handoff Document

> **Working Title:** Becoming  
> **Tagline:** Watch something become someone.  
> **Version:** 0.1.0  
> **Last Updated:** 2026-08-17

---

## 1. What This Project Is

A mobile-first, installable Progressive Web App (PWA) where a virtual creature slowly develops from a primitive animal-like being into an intelligent, unique individual with persistent memory, personality, and a language that emerges gradually. The core emotional experience: **watching something slowly become someone.**

The project is built as a **polished vertical slice** — playable from birth through early developmental stages, with architecture designed to expand into full 30-day arcs and beyond.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Styling | Tailwind CSS 3 |
| Build Tool | Vite 5 + vite-plugin-pwa |
| Persistence | IndexedDB via `idb` library |
| Rendering | HTML5 Canvas (creature), DOM (UI) |
| Icons | Generated via PIL (Python) |
| Deployment | GitHub Pages via GitHub Actions |

**Dev command:** `npm run dev` → `http://localhost:7100/`  
**Live URL:** `https://megabomb420.github.io/becoming/`

---

## 3. Project Structure

```
becoming/
├── .github/workflows/deploy.yml # GitHub Pages deployment
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── favicon.svg
│   └── icon-{192,512,maskable}.png
├── src/
│   ├── types/index.ts          # Core type definitions
│   ├── systems/
│   │   ├── persistence.ts      # IndexedDB save/load
│   │   ├── creatureFactory.ts  # Birth/egg generation, seeded traits
│   │   ├── needsSystem.ts      # Hidden hunger, energy, comfort, stimulation, social
│   │   ├── developmentSystem.ts # Stage progression, vocabulary acquisition
│   │   ├── languageSystem.ts   # Stage-constrained speech generation
│   │   ├── offlineSimulation.ts # Time-passed simulation when app closed
│   │   ├── memoryBook.ts       # Emergent biography generation
│   │   └── socialLearningSystem.ts  # SOCIAL LEARNING & IMITATION
│   ├── components/
│   │   ├── CreatureCanvas.tsx  # Canvas-based creature renderer
│   │   ├── EggHatching.tsx     # Birth experience (tap egg, name creature)
│   │   ├── Room.tsx            # Main game room (objects, creature, chat)
│   │   └── ChatInterface.tsx   # Conversation UI
│   ├── App.tsx                 # Main app flow, offline sync
│   ├── main.tsx                # Entry point
│   └── index.css               # Tailwind + custom safe-area utilities
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## 4. Current Implementation State

### ✅ Fully Working

| Feature | Status | Notes |
|---|---|---|
| PWA installability | ✅ | Manifest, service worker, offline shell, icons |
| Birth / hatching | ✅ | Tap-to-hatch egg, naming |
| Creature rendering | ✅ | Canvas-based with breathing, blinking, tail wag, expressions |
| Hidden needs system | ✅ | 5 internal needs decay over time; no visible stats |
| Hidden personality | ✅ | Seeded traits (curiosity, caution, affection, independence, etc.) |
| Development stages | ✅ | `egg → newborn → animal → communicating → first_words → combining → sentences → mature` |
| Language development | ✅ | Stage-constrained vocabulary; proto-sounds → words → combinations → sentences |
| Feeding | ✅ | Drag apple/broccoli to creature |
| Touch interactions | ✅ | Tap, stroke (drag), hold |
| Sleep / wake cycle | ✅ | Room dims; "z z z" animation; energy restored on wake |
| Idle movement | ✅ | Creature wanders, inspects objects, faces movement direction |
| 10 interactive objects | ✅ | Bowl, apple, broccoli, ball, blanket, paper, pencil, box, stone, mirror |
| Offline simulation | ✅ | Calculates what happened while app was closed; respects sleep state |
| Persistent state | ✅ | IndexedDB survives refresh, restart, reopening |
| Memory Book | ✅ | Emergent biography from significant memories |
| Mobile-first UX | ✅ | Safe areas, touch-optimized, no tutorials |
| Social Learning & Imitation | ✅ | Behaviour parsing, observation tracking, imitation engine |
| Creature-initiated chat | ✅ | Creature can start conversations based on observations |
| Chat interface | ✅ | Full-screen conversation with constrained responses |
| Version display | ✅ | Discreetly shown in Memory Book footer |

### 🚧 Partial / Placeholder

| Feature | State | Gap |
|---|---|---|
| AI language generation | 🚧 | All speech is template/keyword-based. No LLM integration yet. Architecture supports adding an `AIController` later. |
| Creature visual evolution | 🚧 | Appearance is seeded but does not change over time yet. Morphological variation system exists in types only. |
| Interest system | 🚧 | Types defined but interests do not emerge organically from play yet. |
| Dreams | 🚧 | Type exists but dream generator not implemented. |
| Notifications | 🚧 | Architecture prepared but no push notification logic. |
| Haptics | 🚧 | Touch actions do not trigger device vibration yet. |

### ❌ Not Yet Implemented

- AI/LLM backend integration
- Creature visual evolution over time (eye size, posture, markings)
- Multi-creature comparison / sharing
- Cloud sync
- Sound effects / creature vocalizations
- True time-based developmental milestones (currently uses interaction-driven progression)
- Drawing/music creation by creature
- Object discovery stages (e.g. paper → scribble → draw → write)
- Mirror self-recognition sequence
- Lying / deception system
- Dreams generator

---

## 5. Bugs Fixed in v0.1.0

### Critical

1. **Needs decay rate mismatch** — Active-play needs decay was ~30x slower than offline decay due to an incorrect `1/60` multiplier in `updateNeeds()`. Fixed: active and offline decay rates are now consistent.

2. **Sleep energy restoration broken** — `wakeUp()` used `lastSaved` to calculate sleep duration, but `lastSaved` updates every minute via auto-save. This meant waking a creature always restored ~0–2 energy regardless of actual sleep duration. Fixed by adding `sleepStartTimestamp` to `GameState` and tracking when sleep actually begins.

3. **Egg hatching stale state bug** — `EggHatching.tsx` used the stale `tapCount` variable in condition checks instead of the updated value inside the `setTapCount` callback. Fixed by computing the next stage transition inside the functional updater.

4. **Room speech stale closure** — The random speech interval and creature-initiated conversation timer captured stale `state` and `creatureEmotion` values from their closure. Fixed by using refs to always access the latest state.

5. **Object drag using stale state** — `handlePointerUp` in `Room.tsx` referenced `state.position` and `state.roomObjects` from the render closure, which could be outdated if the component hadn't re-rendered. Fixed by reading from a `stateRef`.

6. **Canvas layout thrashing** — `CreatureCanvas.tsx` called `getBoundingClientRect()` and set `canvas.width/height` on every animation frame, causing forced synchronous layout. Fixed by only resizing on window resize events.

7. **Canvas pointer leave triggering tap** — When the pointer left the canvas during an interaction, `handlePointerUp` was called and would fire `onTap()` even for drags. Fixed with a dedicated `handlePointerLeave` that cancels without triggering actions.

8. **Offline sleep not modeled** — If the creature was sleeping when the app closed, `offlineSimulation` did not continue modeling sleep. It also used only the return-time hour for night detection, missing cases where the user left during evening and returned in morning. Fixed by modeling continued sleep and checking whether the absence spanned night hours.

### Polish

9. **Touch scrolling during object drag** — Object drag could trigger page scroll on mobile. Fixed by adding `touchAction: 'none'` to object elements and the room container during drag.

10. **Sleep toggle bypassed `putToSleep`/`wakeUp`** — The sleep button in `Room.tsx` directly mutated state instead of using the `needsSystem` functions, so `sleepStartTimestamp` was never set. Fixed to use the proper system functions.

---

## 6. Known Remaining Issues

### Build / TypeScript
- **None currently.** Build passes cleanly (`npm run build` → 0 errors).

### Logic / UX
- **ChatInterface initialMessage ref:** `initRef` ensures the initiated opening line only fires once, but if the component remounts, the ref resets. Acceptable for current flow.
- **No sound:** The creature is completely silent. Vocalizations should be added as an ambient layer.
- **Needs decay may feel too slow or too fast:** Tuned for 1-minute intervals. Real-world testing on mobile is needed.
- **Object drag on mobile:** Pointer events should work on most mobile browsers, but long-press vs drag detection could conflict with browser gestures on some devices.
- **Offline simulation is simple:** Does not model complex chained activities.

### Architecture
- **Language system is template-based:** Adding an LLM later will require refactoring `generateCreatureSpeech()` and `generateSocialSpeech()` while maintaining stage constraints.
- **No test suite:** No unit tests for any system.
- **Memory compression not implemented:** `compressed: boolean` exists on `Memory` but is never used.

---

## 7. Recommended Next Steps

### Priority: High
1. **Add sound design** — subtle ambient vocalizations (proto-sounds, breath, blink) that play without requiring an API call. This is the single biggest missing sensory layer.
2. **Mobile polish pass** — test on actual iOS Safari and Android Chrome. Fix any drag/touch issues. Add `navigator.vibrate()` for touch interactions.
3. **Add more food/reaction types** — the current "drag apple → happy" loop is functional but shallow. The creature should sniff, reject, play with, or hide food based on personality.

### Priority: Medium
4. **Creature visual evolution** — implement gradual morphological changes (eye size, roundness, markings) that respond to age, personality, and habits.
5. **Interest system** — make interests emerge organically.
6. **True time-based milestones** — currently development is interaction-driven. Add soft time gates.
7. **Test suite** — at minimum, unit tests for `socialLearningSystem.ts` parsing and `needsSystem.ts` decay math.

### Priority: Low / Future
8. **LLM integration** — design the `AIController` system.
9. **Dream generator** — remix recent memories into surreal proto-sentences after sleep.
10. **Mirror sequence** — special object interaction with multi-stage emotional arc.
11. **Cloud sync / export** — allow players to back up or share their creature's save state.
12. **Notifications** — gentle, non-manipulative PWA notifications.

---

## 8. Architecture Decisions

- **No visible stats, ever.** All creature state is communicated through body language, expressions, movement, sounds, and eventually language. This is a non-negotiable design principle.
- **Local-first.** All core systems run in the browser. AI is reserved only for higher-level cognition and the app works fully offline.
- **Deterministic personality.** Each creature has a persistent seed. Same seed = same starting temperament. Randomness after birth is constrained and feels like "one persistent individual."
- **Language constrains the LLM.** When an LLM is added, the speech generation pipeline must pass through a vocabulary whitelist and sentence-complexity gate.
- **No death from neglect.** Long absences change the creature (more independent, different trust level) but never punish the player.

---

## 9. How to Reset / Start Fresh

In the app, tap the small **"Reset"** text in the top-right corner. This clears IndexedDB and reloads the page.

To manually clear from console:
```js
indexedDB.deleteDatabase('becoming-db');
location.reload();
```

---

## 10. Key Files for Onboarding

| If you want to understand... | Read this file |
|---|---|
| The creature's data model | `src/types/index.ts` |
| How the creature is born | `src/systems/creatureFactory.ts` |
| How needs work | `src/systems/needsSystem.ts` |
| How language emerges | `src/systems/languageSystem.ts` + `src/systems/developmentSystem.ts` |
| How social learning works | `src/systems/socialLearningSystem.ts` |
| How the creature is drawn | `src/components/CreatureCanvas.tsx` |
| The main game loop / room | `src/components/Room.tsx` |
| Persistence | `src/systems/persistence.ts` |
| Offline time | `src/systems/offlineSimulation.ts` |
