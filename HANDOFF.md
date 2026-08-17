# Becoming — Handoff Document

> **Working Title:** Becoming  
> **Tagline:** Watch something become someone.  
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

**Dev command:** `npm run dev` → `http://localhost:7100/`

---

## 3. Project Structure

```
becoming/
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
│   │   └── socialLearningSystem.ts  # SOCIAL LEARNING & IMITATION (new)
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
| Sleep / wake cycle | ✅ | Room dims; "z z z" animation |
| Idle movement | ✅ | Creature wanders, inspects objects, faces movement direction |
| 10 interactive objects | ✅ | Bowl, apple, broccoli, ball, blanket, paper, pencil, box, stone, mirror |
| Offline simulation | ✅ | Calculates what happened while app was closed |
| Persistent state | ✅ | IndexedDB survives refresh, restart, reopening |
| Memory Book | ✅ | Emergent biography from significant memories |
| Mobile-first UX | ✅ | Safe areas, touch-optimized, no tutorials |

### ✅ Recently Added (Social Learning & Imitation System)

| Feature | Status | Notes |
|---|---|---|
| Behaviour parsing | ✅ | 17 regex patterns extract structured observations from user statements |
| Observation tracking | ✅ | Tracks frequency, confidence, perceived reward/negative outcome |
| Imitation decision engine | ✅ | Weighted score based on personality, attachment, risk, frequency |
| Chat interface | ✅ | Full-screen conversation UI with constrained creature responses |
| Social speech integration | ✅ | Idle speech now includes rare references to user habits |
| **Creature-initiated chat** | ✅ | Creature can now start conversations based on observations |

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

## 5. Recent Changes (2026-08-17)

### Social Learning & Imitation System

**New file:** `src/systems/socialLearningSystem.ts` (~575 lines)

- **Behaviour parsing:** 17 regex patterns covering consumption, substance, activity, habit, work, social, emotional, and value behaviours. Extracts structured `ObservedBehaviour` records from user text.
- **Observation tracking:** Each parsed statement creates/updates an observation with frequency (once → sometimes → often → always), confidence, perceived reward, and perceived negative outcome.
- **Imitation engine:** `evaluateImitation()` computes a weighted score across 10+ factors (curiosity, attachment, caution, impulsiveness, frequency, perceived risk, cognitive maturity). Threshold: strength > 55 AND exposure ≥ 2.
- **Creature opinion:** When a creature imitates, it rolls for its own opinion (liked / neutral / disliked) based on optimism + observed reward. Rejected behaviours are remembered.
- **Language integration:** `generateSocialSpeech()` adds rare, contextually meaningful references to user habits in idle speech and chat.

**New file:** `src/components/ChatInterface.tsx`

- Full-screen chat overlay with user/creature message bubbles
- User messages are automatically parsed for behavioural observations
- Creature responses are **developmentally constrained** — same language stage system as idle speech
- Supports creature-initiated opening messages via `initialMessage` prop

**Modified:** `src/components/Room.tsx`

- Added 💬 chat button to bottom controls
- Integrated `ChatInterface` overlay
- Added subtle creature-initiated conversation prompt (dark bubble near creature + pulsing dot)
- Observed behaviours now appear in Memory Book

**Modified:** `src/types/index.ts`

- Added `ObservedBehaviour`, `ImitatedBehaviour`, `SocialLearningState`, `BehaviourType`, `ChatMessage`, `InitiatedTopic`
- Extended `GameState` with `socialLearning` field

**Modified:** `src/systems/languageSystem.ts`

- Integrated `generateSocialSpeech()` call before default speech generation

**Modified:** `src/systems/creatureFactory.ts`

- Initializes empty `socialLearning` state on creature creation

### Creature-Initiated Conversation

- `shouldInitiateConversation()` checks every 15–35 seconds
- Requires: awake, cognitiveLevel ≥ 25, 5-min cooldown, unmentioned observations ≥ 2 exposures
- Probabilistic check weighted by curiosity (40%), attachment (30%), sociability (20%), emotional state (10%)
- Picks highest-scored observation and generates stage-appropriate opening line
- Prompt appears as a subtle dark bubble near the creature — clickable, non-intrusive

---

## 6. Known Issues

### Build / TypeScript
- **None currently.** Build passes cleanly (`npm run build` → 0 errors).

### Logic / UX
- **ChatInterface initialMessage ref:** `initRef` ensures the initiated opening line only fires once, but if the component remounts (e.g. after a state reset), the ref resets. This is acceptable for the current flow but should be tied to state if chat persistence is added later.
- **No sound:** The creature is completely silent. Vocalizations should be added as an ambient layer.
- **Needs decay may feel too slow or too fast:** Tuned for 1-minute intervals. Real-world testing on mobile is needed.
- **Object drag on mobile:** Pointer events should work on most mobile browsers, but long-press vs drag detection could conflict with browser gestures on some devices.
- **Offline simulation is simple:** Does not model complex chained activities (e.g. "got bored → moved object → found paper → drew"). Currently picks one activity type.

### Architecture
- **Language system is template-based:** Adding an LLM later will require refactoring `generateCreatureSpeech()` and `generateSocialSpeech()` to call an external service, while maintaining the stage-constraint layer as a filter.
- **No test suite:** No unit tests for any system. The parsing logic in `socialLearningSystem.ts` is particularly vulnerable to regex edge cases.
- **Memory compression not implemented:** `compressed: boolean` exists on `Memory` but is never used. Low-importance memories should be summarized or pruned over time.

---

## 7. Recommended Next Steps

### Priority: High
1. **Add sound design** — subtle ambient vocalizations (proto-sounds, breath, blink) that play without requiring an API call. This is the single biggest missing sensory layer.
2. **Mobile polish pass** — test on actual iOS Safari and Android Chrome. Fix any drag/touch issues. Add `navigator.vibrate()` for touch interactions.
3. **Add more food/reaction types** — the current "drag apple → happy" loop is functional but shallow. The creature should sniff, reject, play with, or hide food based on personality.

### Priority: Medium
4. **Creature visual evolution** — implement gradual morphological changes (eye size, roundness, markings) that respond to age, personality, and habits. This is critical for the emotional arc.
5. **Interest system** — make interests emerge organically. If the creature plays with paper + pencil repeatedly, it should develop a "drawing" interest and eventually create simple scribbles.
6. **True time-based milestones** — currently development is interaction-driven. Add soft time gates so a creature cannot reach `sentences` in 10 minutes of frantic tapping.
7. **Test suite** — at minimum, unit tests for `socialLearningSystem.ts` parsing and `needsSystem.ts` decay math.

### Priority: Low / Future
8. **LLM integration** — design the `AIController` system. The constraint architecture (vocabulary whitelist, max sentence complexity, forbidden concepts) should be built before connecting any model.
9. **Dream generator** — remix recent memories into surreal proto-sentences after sleep.
10. **Mirror sequence** — special object interaction with multi-stage emotional arc (fear → curiosity → recognition).
11. **Cloud sync / export** — allow players to back up or share their creature's save state.
12. **Notifications** — gentle, non-manipulative PWA notifications ("Nib woke up.", "Something changed in the room.")

---

## 8. Architecture Decisions

- **No visible stats, ever.** All creature state is communicated through body language, expressions, movement, sounds, and eventually language. This is a non-negotiable design principle.
- **Local-first.** All core systems run in the browser. AI is reserved only for higher-level cognition and the app works fully offline.
- **Deterministic personality.** Each creature has a persistent seed. Same seed = same starting temperament. Randomness after birth is constrained and feels like "one persistent individual."
- **Language constrains the LLM.** When an LLM is added, the speech generation pipeline must pass through a vocabulary whitelist and sentence-complexity gate. The model should not be able to output vocabulary the creature hasn't learned.
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
