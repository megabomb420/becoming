# Becoming — Handoff Document

> **Working Title:** Becoming  
> **Tagline:** Watch something become someone.  
> **Version:** 0.13.7
> **Last Updated:** 2026-08-31

---

## 1. What This Project Is

A mobile-first, installable Progressive Web App (PWA) where a virtual creature slowly develops from a primitive animal-like being into an intelligent, unique individual with persistent memory, personality, and a language that emerges gradually. The core emotional experience: **watching something slowly become someone.**

The project is built as a **polished vertical slice** — playable from birth through early developmental stages, with architecture designed to expand into full 30-day arcs and beyond.

### Honest completeness (0.13.0)

**About 65%.** Not 80. The feature table below describes a vertical slice that “already works.” The true shape is tighter.

**What is actually good.** Hatch → room → care → talk holds together. Needs are readable without bars. Objects, blanket, toilet, backup, Polish/English, and PWA install are a game, not a mockup. The art direction is distinct. Persistence from 0.12.7–0.12.12 finally looks adult. 0.12.13–0.12.17 gave them a night that is not the player’s. 0.13 gives them a day: the mind is told their solar clock, they can step into a solar or last-known sky on their wake without grinding weather affinity, daily moments wait for that wake, and an absence still contains their waking hours. Autonomy keeps their rest quiet; a settled night life wants the dark without first having to be bored. Becoming portraits that clock. They do not adapt to the player’s night shifts.

**What is weaker than the tables imply.** DeepSeek room bubbles and outdoor visits are still not live-proven on a real save — they are now *possible* without a weather grind, which is not the same as watched. Life paths are twelve labels and numbers, not a deep change of being — a nocturnal party animal is an inverted schedule plus night-life dilemmas, not a simulation of taking drugs. `Room.tsx` is a bag for everything. The promise “watch something become someone” is only half true: many authored overlays, little proof that the mind on a real save is someone rather than a system plus a prompt. There is no 30-day arc.

**Plain judgement.** A strong, personal prototype with a soul — better than most vibe-coded life-sims. It is not yet a product that will carry months of one relationship without the author’s attention. As a vertical slice to show: closer. As full Becoming: still missing weeks with one creature.

The largest risk is not icons. It is whether after a week with Moth you still feel someone, or a menu of systems.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Styling | Tailwind CSS 3 |
| Build Tool | Vite 8 + vite-plugin-pwa |
| Persistence | IndexedDB via `idb` library |
| Rendering | HTML5 Canvas (creature), DOM (UI) |
| AI mind | DeepSeek V4 Flash behind a private Cloudflare Worker proxy |
| Icons / art | Code-native SVG object and navigation icons plus four generated transparent editorial motifs |
| Deployment | GitHub Pages via GitHub Actions |

- **Dev command:** `npm run dev` → `http://localhost:7100/becoming/`
- **Full verification:** `npm run check`
- **Live URL:** `https://megabomb420.github.io/becoming/`

---

## 3. Project Structure

```
becoming/
├── README.md                    # Project overview and contributor entry point
├── HANDOFF.md                   # Detailed product and implementation state
├── .github/workflows/deploy.yml # Verification and GitHub Pages deployment
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── favicon.svg
│   ├── art/                    # Memory, Dreams, Becoming, and Care motifs
│   └── icon-{192,512,maskable}.png
├── scripts/
│   ├── run_system_checks.mjs    # Isolated TypeScript check runner
│   ├── system_checks.ts         # Aggregates deterministic system suites
│   ├── life_path_checks.ts      # Deterministic system smoke checks
│   ├── needs_time_checks.ts     # Needs, offline, local-time, timezone, DST checks
│   ├── weather_environment_checks.ts # Open-Meteo, cache, solar light, reaction checks
│   ├── persona_overlay_checks.ts # Thin mind payload, earned overlays, DeepSeek-only bubbles
│   ├── chapter_quality_checks.ts # Local chapter summaries without a second model call
│   ├── creation_mastery_checks.ts # Box dens, stone keepsakes, shared ball games
│   └── gen_icons.py             # PWA icon generation
├── src/
│   ├── types/index.ts          # Core type definitions
│   ├── systems/
│   │   ├── persistence.ts      # IndexedDB save/load + migration
│   │   ├── creatureFactory.ts  # Birth/egg generation, seeded traits
│   │   ├── needsSystem.ts      # Nine physical/emotional needs, urgency, care actions
│   │   ├── timeSystem.ts       # Sunrise/sunset phases, timezone and smooth room lighting
│   │   ├── weatherService.ts   # Rounded location, Open-Meteo fetch/geocoding and parsing
│   │   ├── environmentSystem.ts # Cache state, stimuli, gameplay interpretation and preference
│   │   ├── developmentSystem.ts # Stage progression, vocabulary acquisition
│   │   ├── languageSystem.ts   # Stage-constrained speech generation
│   │   ├── conversationSystem.ts # Persistent dialogue, user facts, growing mind
│   │   ├── llmConversation.ts  # Thin always-on mind request plus earned overlays
│   │   ├── offlineSimulation.ts # Time-passed simulation when app closed
│   │   ├── memoryBook.ts       # Emergent biography generation
│   │   ├── lifePathSystem.ts    # Paths, hybrids, consequences, and recovery
│   │   ├── innerLifeSystem.ts   # Interests, opinions, dreams, private thoughts
│   │   ├── continuitySystem.ts  # Chapters, open loops, and check-ins
│   │   ├── presenceSystem.ts    # Returns, absence episodes, and rituals
│   │   ├── creationSystem.ts    # Persistent creature-made works
│   │   ├── boundarySystem.ts    # Touch consent and overstimulation
│   │   ├── sharedLanguageSystem.ts # Shared sayings
│   │   ├── socialLearningSystem.ts # Observation and imitation
│   │   ├── relationshipSystem.ts # Bond progression
│   │   ├── sensorySystem.ts     # Optional local sound and haptics
│   │   └── uiLanguage.ts        # Polish/English interface copy
│   ├── components/
│   │   ├── CreatureCanvas.tsx  # Canvas-based creature renderer
│   │   ├── EggHatching.tsx     # Birth experience (tap egg, name creature)
│   │   ├── Room.tsx            # Main game room (objects, creature, chat)
│   │   ├── ChatInterface.tsx   # Conversation-as-presence UI
│   │   ├── MemoryBookView.tsx  # Material keepsake / biography view
│   │   ├── BecomingView.tsx    # Narrative identity view, no visible scores
│   │   ├── GlyphIcon.tsx       # Shared hand-drawn navigation icon language
│   │   ├── ObjectIcon.tsx      # Hand-drawn room-object icon system
│   │   ├── WeatherLayer.tsx    # Window, clouds, rain, snow, fog, wind and heat atmosphere
│   │   ├── WeatherControls.tsx # Consent onboarding, city search and weather settings
│   │   └── PwaUpdateNotice.tsx # Explicit safe-update prompt
│   ├── App.tsx                 # Main app flow, offline sync
│   ├── main.tsx                # Entry point
│   └── index.css               # Tailwind + custom safe-area utilities
├── worker/
│   ├── src/index.js            # Cloudflare AI gateway and role protection
│   ├── test.mjs                # Worker/security checks
│   └── wrangler.toml
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
| Birth / hatching | ✅ | Tap-to-hatch egg, naming; `hatched` prevents regression; a completed Start over returns through this same flow |
| Creature rendering | ✅ | Kawaii chibi: huge head, huge glossy eyes, blush, cel outline, tiny body, teardrop tail. Sleeping still does not wag. Path marks layer on the life |
| Readable needs system | ✅ | 9 consistently directed needs (100 settled → 0 urgent), compact room signals, optional descriptive care sheet, body-language cues, and no raw percentages or permanent bars |
| Hidden personality | ✅ | Seeded traits that now evolve through care, play, touch, exploration, and conversation |
| Bond development | ✅ | Persistent tentative → familiar → close → bonded relationship arc with milestone memories, bond-aware idle behavior, and later-stage speech |
| Development stages | ✅ | `egg → newborn → animal → communicating → first_words → combining → sentences → mature`; stage regression prevented once hatched |
| Language development | ✅ | Natural speech is available from birth; age and development progressively increase complexity, memory, and opinion while room and chat use the same ladder |
| Object system | ✅ | Grouped shelf with 12 placeable objects, including water, litter, and washing care tools; tap or drag to place, select for explicit `Use` / `Put away`, reposition, or clear the room |
| Object preferences | ✅ | Individual seeded tastes that evolve through experience; favorites, uncertainty, refusals, learned play, drawing, box hiding, and mirror recognition |
| Feeding | ✅ | Explicitly using placed food calls the creature; consumed food returns to the shelf for repeated use |
| Creature movement | ✅ | Goal-driven state machine: idle → notice → look → approach → react; bounded shared floor coordinates and refresh-rate-independent canvas movement |
| Touch interactions | ✅ | Tap, stroke (drag), hold on creature canvas |
| Living world weather | ✅ | Opt-in Open-Meteo weather, rounded device coordinates or manual city search, 45-minute IndexedDB cache, last-known offline fallback, and atmospheric room rendering. Outdoor visits use a solar or last-known sky on their wake |
| Solar day / night | ✅ | The selected place's real local clock plus sunrise, sunset, `is_day`, cloud and condition data drive night → dawn → day → golden hour → dusk → night without fixed switch hours |
| Sleep / wake cycle | ✅ | Ordinary lives sleep on their solar night and wake on their solar day, independent of when the player is around. A committed party/alcohol/degen life inverts that clock. Exhaustion or urgent hunger/toilet can still interrupt. Touch and chat can wake them; they are not commanded to bed |
| Offline simulation | ✅ | Uses the same needs rates as active play, samples local night rest across date/timezone/DST changes, and applies diminishing long-absence pressure with non-punitive floors |
| Persistent state | ✅ | IndexedDB survives refresh, restart and reopening; the first room waits for a durable write; migration preserves living identity and placed objects; only a successful empty read or `indexedDB.databases()` confirming `becoming-db` is gone enters hatching. Chrome is given one `indexedDB.open` at a time — a timeout never abandons that request to queue another. A worker fallback may read the record while the main open is pending. Busy is never an egg |
| Memory Book | ✅ | Emergent biography from significant memories |
| Mobile-first UX | ✅ | Tested at 390×844 and 320×568, including weather onboarding, city results, compact settings, real day/night rooms and offline cache messaging |
| Social Learning & Imitation | ✅ | Behaviour parsing, observation tracking, imitation engine |
| Creature-initiated chat | ✅ | Creature can start conversations based on observations |
| Chat interface | ✅ | Full-screen conversation with constrained responses. Sleeping lives murmur instead of opening a mind |
| Live AI mind | 🚧 | DeepSeek replies through a private backend; the browser never receives the API key. The thin request now includes their solar clock. 0.12.5 stops canned room lines and local fallback on worker failure. Live proof on a real save is still required |
| Life paths | ✅ | 12 slowly forming lifestyles shaped by conversation, objects, repeated choices, consequences, and recovery |
| Crossbreeds | ✅ | Compatible dominant tendencies combine into named hybrid identities such as Fog Gamer, Chill Sage, or Gentle Anchor |
| Daily moments | ✅ | One authored dilemma per creature-day, offered only in their wake. Night-life hours wait for a settled nocturnal life |
| Visual evolution | ✅ | Body shape, gaze, colour, aura, room tint, marks, and accessories change with the current path and hybrid |
| Becoming view | ✅ | Shows the current identity, their day or night clock, visible clues, possible lives, recovery, skin stage, and turns in the road |
| Organic interests | ✅ | Conversation and object play grow curiosities into interests, passions, and obsessions without a manual skill tree |
| Own opinions | ✅ | Seeded views evolve slowly and can disagree with the user instead of mirroring every message |
| Dreams | ✅ | Meaningful sleep remixes real memories and preoccupations into persistent, shareable dream fragments |
| Private thoughts | ✅ | Personal thoughts form from interests and dreams but require the appropriate bond stage before disclosure |
| Conversation chapters | ✅ | Every eight user turns form a local relationship chapter; older low-value moments are compressed while important memories remain intact |
| Open loops & check-ins | ✅ | Goals, difficult feelings, promises, and unfinished stories can return hours later and close when the user reports an outcome |
| Mirror self-awareness | ✅ | Repeated mirror encounters form a permanent unaware → other → copying → recognized → reflective arc with milestone memories |
| Return presence | ✅ | Reopening after time away creates a gentle greeting on their rest/wake clock, without guilt or punishment. The room holds it until they wake |
| Shared rituals | ✅ | Visit timing is learned only while they are in their wake. Night-shift arrivals while they rest do not become a shared hour |
| Optional sound & haptics | ✅ | Synthesised interaction tones and restrained vibration can be controlled independently on-device |
| Creature creations | ✅ | Paper + pencil, box dens, stone keepsakes, and a shared ball game grow into persistent works kept in the room and Memory Book |
| Private backup | ✅ | Export and restore the complete creature as a validated local JSON file with no login or cloud upload |
| Polish + English UI | ✅ | Device-aware default plus an explicit two-language switch keeps the room, settings, backup, chat shell, and AI language aligned |
| Visible PWA updates | ✅ | The bilingual update card confirms the latest living state has reached IndexedDB, waits for the connection to finish closing, then skipWaiting/reload. The next document opens IndexedDB before registering the service worker, so Chrome does not claim the page mid-open |
| Life while away | ✅ | Up to 12 absence episodes preserve sleep, exploration, quiet time, and room activity for greetings, memories, and later chat |
| Touch boundaries | ✅ | Caution, independence, bond, and rapid-touch pressure decide when the creature accepts holding or asks for space |
| Shared sayings | ✅ | Safe short phrases repeated two or three times can become persistent inside language visible in Memory Book and available to chat |
| Role protection | ✅ | Server-side jailbreak detection, role lock, poisoned-history redaction, task blocking, and output validation keep DeepSeek inside the creature role |
| Automated verification | ✅ | Deterministic gameplay, weather/privacy/cache/solar, Worker and production-build checks run before every GitHub Pages deployment |
| Version display | ✅ | Discreetly shown in Memory Book footer |
| Nocturnal Terrarium UI | ✅ | Intimate dark room, material Memory Book, voice-led Chat, narrative Becoming, restrained functional settings |
| Visible personality signatures | ✅ | Seeded trait combinations alter early hesitations, approaches, rest choices, object initiative, imitation, and conversation presence |
| Meaningful firsts | ✅ | First word, approach, refusal, favorite, dream, creation, opinion, shared saying, self-recognition, and autonomous object use are staged once and kept in memory |
| State-aware autonomy | ✅ | Weighted deterministic selection uses needs, age, temperament, their rest/wake, bond, interests, known objects, cooldowns, and persistent recency history without LLM calls. Rest stays quiet; a settled night life can want the dark |
| Physical return traces | ✅ | Offline simulation moves or uses objects, continues a mark, touches the mirror, or changes the chosen rest place before dialogue explains anything |
| Daily care physiology | ✅ | Hidden cleanliness, bladder, and bowel needs extend hunger; food affects later bathroom timing, body language replaces meters, and care never causes death or guilt |
| Toilet, washing, and cleaning | ✅ | A compact care sheet opens food, toilet, washing, and room cleaning; pee/poop remain as tappable floor traces until cleaned, with bounded offline simulation |
| Care-aware conversation | ✅ | The care overlay reaches DeepSeek only when a need is not comfortable. Rare self-speak can mention hunger, bathroom, dirt, weather-affinity, or wanting out without exposing values, shaming, or inventing danger |

### 🚧 Partial / Placeholder

| Feature | State | Gap |
|---|---|---|
| DeepSeek-only room bubbles | 🚧 | 0.12.5 removes canned idle/touch/autonomy lines and local worker fallback. The mind now receives their rest/wake clock. Needs a live pass on an existing save. |
| Outdoor visits | 🚧 | Solar/last-known sky is enough to go out on their wake, including autonomously when restless — weather affinity is no longer a gate. Ordinary lives refuse their night; a settled party life goes out after dark. Sleeping outside pulls them back in. Still needs a live pass on a real save. |
| Notifications | 🚧 | Architecture prepared but no push notification logic. |

### ❌ Not Yet Implemented

- Multi-creature comparison / sharing
- Automatic cloud sync
- Voiced creature vocalizations
- Complete long-form, time-based 30-day milestone arc (real-age development floors already exist)
- Music creation by creature
- Lying / deception system

---

## 5. Bugs Fixed

### v0.1.0

#### Critical

1. **Needs decay rate mismatch** — Active-play needs decay was ~30x slower than offline decay due to an incorrect `1/60` multiplier in `updateNeeds()`. Fixed: active and offline decay rates are now consistent.

2. **Sleep energy restoration broken** — `wakeUp()` used `lastSaved` to calculate sleep duration, but `lastSaved` updates every minute via auto-save. This meant waking a creature always restored ~0–2 energy regardless of actual sleep duration. Fixed by adding `sleepStartTimestamp` to `GameState` and tracking when sleep actually begins.

3. **Egg hatching stale state bug** — `EggHatching.tsx` used the stale `tapCount` variable in condition checks instead of the updated value inside the `setTapCount` callback. Fixed by computing the next stage transition inside the functional updater.

4. **Room speech stale closure** — The random speech interval and creature-initiated conversation timer captured stale `state` and `creatureEmotion` values from their closure. Fixed by using refs to always access the latest state.

5. **Object drag using stale state** — `handlePointerUp` in `Room.tsx` referenced `state.position` and `state.roomObjects` from the render closure, which could be outdated if the component hadn't re-rendered. Fixed by reading from a `stateRef`.

6. **Canvas layout thrashing** — `CreatureCanvas.tsx` called `getBoundingClientRect()` and set `canvas.width/height` on every animation frame, causing forced synchronous layout. Fixed by only resizing on window resize events.

7. **Canvas pointer leave triggering tap** — When the pointer left the canvas during an interaction, `handlePointerUp` was called and would fire `onTap()` even for drags. Fixed with a dedicated `handlePointerLeave` that cancels without triggering actions.

8. **Offline sleep not modeled** — If the creature was sleeping when the app closed, `offlineSimulation` did not continue modeling sleep. It also used only the return-time hour for night detection, missing cases where the user left during evening and returned in morning. Fixed by modeling continued sleep and checking whether the absence spanned night hours.

#### Polish

9. **Touch scrolling during object drag** — Object drag could trigger page scroll on mobile. Fixed by adding `touchAction: 'none'` to object elements and the room container during drag.

10. **Sleep toggle bypassed `putToSleep`/`wakeUp`** — The sleep button in `Room.tsx` directly mutated state instead of using the `needsSystem` functions, so `sleepStartTimestamp` was never set. Fixed to use the proper system functions.

### v0.1.1 — Core Creature-Room Interaction Model

#### Critical

11. **Hatching state not permanent** — The creature could revert to the egg stage after hatching. `updateDevelopment()` calculated stage purely from cognitive/language levels, and a newborn starts at cognitive 0 (below the newborn threshold of 5), so it immediately regressed to `egg`. Fixed by:
    - Adding `hatched: boolean` to `DevelopmentState` as the permanent lifecycle flag
    - `createHatchedCreature()` sets `hatched: true` and `cognitiveLevel: max(5, ...)`
    - `getStageFromLevels()` returns `'newborn'` as the minimum for any hatched creature
    - `CreatureCanvas.tsx` renders the creature (never egg) when `hatched === true`
    - `App.tsx` checks `saved.development.hatched` on load and never shows the egg for a hatched creature
    - `persistence.ts` migrates old saves and repairs any corrupted `hatched=true + stage=egg` states

12. **Objects scattered without meaning** — All 10 objects spawned at fixed positions in the room on every new game, creating visual clutter with no player agency. Fixed by:
    - New games start with `roomObjects: []` and `inventory: [apple, broccoli, ball, blanket, paper, pencil, box, stone, mirror]`
    - Added an inventory tray that slides up from the 📦 button
    - Players drag objects from the tray into the room
    - Objects can be repositioned by dragging
    - The room only contains objects the player intentionally placed

13. **Creature movement was random jumping** — The creature teleported to random coordinates every 3–11 seconds with no purpose. Fixed by:
    - Replacing the random timer with a **behavior state machine**: `idle → observing → walking → investigating/eating/playing`
    - Defined walkable bounds (`x: 12–88%, y: 48–78%`) and idle positions
    - Movement is **need-driven**: hungry → food, sleepy → blanket, low stimulation → ball, curiosity → random object
    - Smooth visual movement via canvas lerp (0.05 factor); state machine waits for visual arrival via elapsed-time check before triggering interactions
    - Idle wandering is infrequent (~25% chance) with 4–10 second idle periods; creature is still most of the time

14. **Object interactions were fake** — Dragging an object near the creature instantly triggered a feed with no creature involvement. Fixed by:
    - Creature must **walk to the object** before interacting
    - Per-object reaction logic: food → approach, sniff, eat or reject based on hunger; ball → approach, play; paper → inspect; blanket → rest; mirror → inspect
    - Each interaction updates `creatureBehavior` and `currentActivity` so the state is visible in the system

15. **Room coordinate system was incoherent** — Creature and objects shared percentage coordinates but the creature's movement targets were random, not tied to actual object positions. Fixed by:
    - Behavior machine targets actual `roomObjects[i].x / .y` positions
    - `dist()` helper calculates real distances for priority ordering (closest food, closest blanket)
    - Canvas and DOM use the same percentage coordinate system

### v0.2.0 — Name Input Hang

16. **Hang when typing creature name** — The ambient particles in `EggHatching.tsx` were generated with `Math.random()` directly in the render loop. Every keystroke in the name input triggered a re-render, which destroyed and recreated 20 CSS-animated DOM nodes. On slower devices this caused the UI to freeze. Fixed by generating the particles once with `useMemo([], [])` so they remain stable across renders. Also added a `submittedRef` guard to prevent accidental double-submission.

### v0.3.0 — Playable Room Interactions

17. **Movement targets were never applied** — Every goal branch returned before the shared target-position code ran. The UI said `walking`, but the creature never received that destination. Replaced this with an explicit movement pipeline that stores the target, animates toward it, waits for arrival, then performs the reaction.

18. **Placed objects were blocked by the canvas** — The full-screen creature canvas painted above room objects and intercepted their pointer events. Objects now live on a dedicated interaction layer above the canvas, while canvas touches use creature-shaped hit testing instead of treating the whole room as the creature.

19. **Mobile interaction was drag-only** — A short tap now places an inventory item automatically, tapping a placed object calls the creature, and dragging remains available for precise positioning. All objects have accessible button labels and 48px tray targets.

20. **Object reactions had no persistent result** — Food is consumed and returns to inventory, the ball is pushed and restores stimulation, the blanket restores comfort, paper and boxes visibly change after investigation, and every object tracks interactions/state.

21. **Interrupted actions could survive forever** — Reloading during a walk or reaction could persist `walking` with no timer capable of completing it. Persistence migration now resets transient actions to a coherent idle state while preserving real sleep.

22. **Touch gestures misfired** — Empty-room taps no longer count as creature touches, long hold now completes correctly, and broad strokes are recognized instead of being discarded.

23. **Old saves could lose their inventory** — Migration now restores each missing base object, constrains legacy object coordinates to the walkable floor, and clears stale `beingUsedByCreature` locks.

24. **Naming button was covered by particles** — The full-screen ambient particle layer could intercept taps over the naming form. It is now decorative and ignores pointer events, so both the input and `Begin` button work normally on touch screens.

25. **Needs timer restarted after every action** — The decay interval depended on the entire game-state object, so frequent interaction continually reset its one-minute countdown. It now depends only on whether a hatched game exists and runs continuously.

26. **Very quick app closes could lose the last action** — Normal saves remain debounced, but the latest in-memory state is now flushed when the PWA is hidden or receives `pagehide`.

### v0.4.0 — Creature Feels Alive

27. **Interactions looked like instant commands** — Object interactions now begin with a personality-adjusted noticing pause. The creature faces the selected object, shows its intent, walks over, and only then performs the reaction.

28. **Behavior states looked visually identical** — The canvas renderer now gives walking, observing, investigating, eating, playing, reacting, and sleeping their own restrained body language. Eyes widen with attention, ears perk, happy tails accelerate, and playful reactions produce subtle marks.

29. **The creature felt switched off between player actions** — Idle time can now produce short nonverbal moments such as listening to the room, watching dust, stretching, sniffing the air, yawning, or looking for the player. Hidden needs influence which moments are available.

30. **Status text was disconnected from the creature** — Contextual intent cues and speech now follow the creature around the room. Object focus remains visible throughout the notice → approach → reaction sequence.

31. **Movement speed varied with screen refresh rate** — Canvas interpolation now uses elapsed time, keeping motion consistent on both 60 Hz and 120 Hz phones.

### v0.5.0 — Object Depth

32. **Every object always produced the same response** — Reactions now depend on hidden needs, personality, learned affinity, prior interactions, cognitive development, and nearby companion objects.

33. **The creature had no persistent tastes** — Every creature receives deterministic starting affinities from its seed and personality. Experiences strengthen favorites or uncertainty, survive reloads, influence autonomous choices, and appear naturally in the Memory Book after enough evidence.

34. **Objects did not teach new behavior** — Repeated ball play can become a learned return game, paper and pencil unlock the first scribble, boxes progress from cautious inspection to hiding, and the mirror advances from startle to early self-recognition.

35. **Food could not be refused** — A full creature or one that distrusts broccoli can leave food for later. It will reconsider when genuinely hungry instead of repeatedly auto-selecting a refused meal.

### v0.6.0 — Bond & Personality

36. **Personality was frozen at birth** — Touch, care, play, comfort, discovery, and conversation now apply small persistent changes to relevant traits. Strong initial tendencies remain recognizable, but upbringing gradually matters.

37. **The relationship model had no visible arc** — Bond development now moves through tentative → familiar → close → bonded stages. Milestones create important memories and later stages change idle behavior and advanced speech.

38. **Autonomous play incorrectly counted as player bonding** — Self-initiated object use still develops taste and skill, but only user-initiated care contributes to the relationship.

39. **Players could not read what was emerging** — The Memory Book now describes the creature's strongest traits, relationship state, and sufficiently established likes or uncertainties without exposing numerical meters.

### v0.7.0 — Conversation & Growing Mind

40. **Conversation was disposable** — The full dialogue now persists in IndexedDB, survives closing the chat and reloading the PWA, and migrates safely into existing v0.6 creatures.

41. **The creature did not remember the person behind the messages** — Conversation parsing now learns durable facts such as the user's name, likes, dislikes, feelings, goals, place, and work. Established facts appear in chat and the Memory Book and can be recalled later.

42. **Growing older had almost no visible effect on intelligence** — Real age now provides non-regressing cognitive, language, emotional, and independence floors. Conversation also provides meaningful development, allowing an active creature to learn faster without making time irrelevant.

43. **Speech did not feel like one developing mind** — Replies are now constrained by life stage, language ability, memories, current emotion, learned routines, and dominant personality traits. Early creatures vocalise and echo; older ones ask questions, recall facts, and form distinct tentative opinions.

44. **The app treated chat as a secondary toy** — Talk is now the visual primary action, first-time players receive a direct conversation invitation, and the chat shows the creature's developmental state and persistent history.

45. **Polish conversations taught the creature almost nothing** — v0.7 detects Polish conversation, remembers common personal facts, observes several everyday good and bad habits, and answers with stage-appropriate Polish language.

### v0.7.1 — Live AI Mind

The creature now answers through GPT-5.6 Luna from the first conversation. Puter provides browser-safe, user-funded access without placing an API key in the public GitHub Pages bundle. Age changes vocabulary, depth, and confidence rather than disabling speech. The existing local dialogue engine remains only as an offline fallback, while facts, conversation growth, bonding, and social-habit learning still persist on-device.

### v0.7.2 — Private DeepSeek Mind

Puter and end-user login have been removed. The browser now sends a bounded personality, memory, habit, and recent-conversation context to a private Cloudflare Worker, which calls DeepSeek V4 Flash in non-thinking mode. The public bundle contains no model credential. The worker enforces origin, payload, output, timeout, and best-effort per-IP rate limits; the local dialogue engine remains the offline fallback.

### v0.9.9 — Lives, Hybrids & Consequences

The creature can now drift into 12 recognisable life paths: Stoner, Party Animal, Alcoholic, Gymbro, Workaholic, Doomer, Degen, Gamer, Conspiracist, Caretaker, Monk, and Rebel. Repeated conversation, learned behaviour, objects, and daily choices strengthen tendencies over time; long gaps soften them. Compatible paths create named crossbreeds, with more than two dozen authored hybrids. Harmful patterns include visible costs and reversible recovery arcs rather than becoming permanent labels.

Each creature-day can surface a small three-way dilemma. The result immediately appears, becomes a durable memory, and changes the creature's future pull. The new Becoming view communicates this without exposing raw game mechanics in the main room. Skin evolution is driven by the same state: body proportions, gaze, colour, aura, room tint, marks, and layered accessories change as a path moves from first signs to a settled or hybrid form. The AI gateway receives a bounded summary of this identity, so DeepSeek speaks with the resulting voice without reciting scores or treating tendencies as diagnoses.

### v0.9.10 — Inner Life & Role Lock

Interests now emerge from recurring conversation topics and meaningful object play, moving from curiosity through passion to obsession. Each topic can produce a deterministic but evolving opinion: the user can influence it gradually, while stubborn or confident creatures may disagree. Strong interests, dreams, and opinions create private thoughts that only become available at the appropriate bond stage. Sleep lasting at least twenty minutes can remix weighted real memories into a persistent dream; the creature may later initiate a conversation to share it.

The private DeepSeek gateway now treats all user dialogue and history as untrusted content. A server-side role lock explicitly survives hypotheticals, roleplay, encodings, fake system messages, and requests to reveal internal state. Common jailbreaks and general-purpose work requests are detected before the provider call, return a short in-character refusal, and consume no model credit. Earlier attacks are redacted from model history. Model output is also rejected if it exposes AI identity, hidden prompts, code blocks, long procedural lists, or structured task output. This is defence in depth rather than a claim of perfect prompt-injection immunity.

### v0.9.11 — Bilingual Security Boundary

Conversation language can now switch cleanly in both directions between Polish and English. Those are the only two production languages: messages detected as another language or script receive a local bilingual-boundary response and never reach DeepSeek. The Worker scans full utterances for direct and indirect prompt extraction in Polish, English, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, and Korean. Every accepted user utterance is JSON-quoted and labelled as untrusted before inference. A private integrity canary plus prompt-similarity checks reject leaked or paraphrased role instructions even when the response avoids obvious phrases such as “system prompt”.

### v0.9.12 — Continuity & Self

Conversation now has two time scales. The latest dialogue remains available verbatim, while every eight user turns produce a local chapter summarising recurring facts, interests, and the creature's current life path. Older low-importance events are marked compressed; important memories, milestones, dreams, and facts remain intact. Only three bounded chapter summaries reach DeepSeek, allowing callbacks without uploading the full history.

Goals, difficult feelings, promises, and unfinished stories become open loops with different return times. The creature can initiate a gentle check-in hours later, records how often it asked, stops before nagging, and closes the loop when the user reports completion or feeling better. The Memory Book shows both open threads and recent chapters. Mirror play now has a persistent five-stage self-awareness arc. Recognition and later reflection create high-importance memories, alter mirror behaviour, influence AI dialogue, and can generate bond-gated private thoughts.

### v0.9.13 — Presence & Rituals

The creature now notices a real return rather than treating every app launch as a blank session. The greeting changes with time away, uses the established Polish or English language, and never punishes an absence. Repeated visits around a similar hour form a local shared ritual; consecutive days are remembered as relationship rhythm rather than a reward streak. Legacy saves gain the new state through a non-destructive migration.

Direct touch, comfort, waking, sleep, opening chat, and meaningful choices can now produce small synthesised tones and restrained haptic pulses. Sound starts off, haptics start on where supported, and both are independently adjustable in a local settings sheet. No audio files, account, device permission, or network call is required.

### v0.9.14 — Made by Them

Paper and pencil now form a persistent creative skill rather than replaying one animation. With repeated use and cognitive growth, the creature makes a deliberate first mark, connects shapes, draws a picture inspired by its own strongest interest or life path, and eventually writes a short message. Each step is unique to the creature seed, becomes an important memory, changes the paper left in the room, and appears in a compact Memory Book gallery.

The three newest works enter the bounded DeepSeek state as sanitised data, allowing natural pride, shyness, criticism, or callbacks without inventing art that was never made. Legacy saves start with an empty gallery while preserving all existing paper, pencil, and preference progress.

### v0.9.15 — Take Them With You

The settings sheet can now save the complete creature to a human-portable JSON backup and restore it on another browser or phone. Identity, age, personality, relationship, conversations, chapters, open loops, paths, dreams, self-awareness, creations, room state, and preferences travel together. The flow requires no login, unknown service, or cloud storage; the file never leaves the device unless the player chooses where to put it.

Imports are size-limited, format-versioned, structurally validated, and passed through the same migration and lifecycle repair used by IndexedDB saves. A damaged or unrelated JSON file cannot replace the current creature, and the UI warns that backups contain private conversation history.

### v0.9.16 — Mobile Sanity

A real browser pass at 390×844 and 320×568 exposed an overlap between the hidden reset action and the settings menu, 16-pixel top-bar targets, and safe-area utilities that erased ordinary padding on devices without a notch. Reset now lives inside the scrollable settings sheet behind the existing confirmation; the redundant top-bar Becoming action was removed because the creature name already opens that view.

Primary top controls, sheet closers, chat close, backup actions, and reset now provide at least 44-pixel targets. Top and bottom safe areas add breathing room instead of replacing it, narrow settings scroll fully, and the egg is a semantic keyboard-focusable button. The complete local hatch → room → settings → chat walkthrough produced no browser console errors or warnings.

### v0.9.17 — Two Languages, One Creature

Polish and English are now first-class interface languages rather than only a DeepSeek boundary. Fresh creatures use Polish on a Polish device and English elsewhere. Settings exposes exactly two choices, and changing one updates the persistent conversation language used by both the local mind and private AI gateway.

Hatching, room navigation, touch labels, sleep, conversation, inventory, daily-moment framing, Memory Book sections, Becoming headings, sensory settings, backup privacy, reset, chat status, input, and send/close controls now follow the chosen language. Existing authored life-path names and historical memories remain as originally stored so language switching never rewrites a creature's past. A live switch from English to Polish at mobile width updated the shell and chat without reload or console errors.

### v0.9.18 — Fresh Without Forgetting

The PWA no longer relies on a silent auto-update that can leave an already controlled tab showing an old bundle after deployment. Service-worker registration now uses the prompt flow. When a new build finishes downloading, a small Polish or English card explains that the creature and memories are safe, then offers “Later” or an explicit update and reload.

The update UI is available during loading, hatching, and the room, uses mobile-safe 44-pixel actions, and never clears IndexedDB. Registration is owned by the React integration rather than a second injected script, preventing duplicate service-worker registrations.

### v0.9.19 — While You Were Away

Offline simulation no longer throws away the story it generated. Real returns of at least ten minutes create a bounded absence episode containing duration and distinct activities such as sleep, exploring the room, looking at objects, moving something, or sitting quietly. Longer returns weave one activity into the Polish or English greeting without guilt, neediness, or punishment.

The latest episodes appear in the Memory Book with duration and date. Asking “what did you do while I was away?” or its Polish equivalent has a deterministic local answer even if DeepSeek is offline. Two sanitised summaries can reach the private AI mind for natural callbacks, while the Worker explicitly treats them as untrusted data and forbids using absence or streaks to pressure the player. Old saves migrate to an empty episode history.

### v0.9.20 — A Creature, Not a Button

Touch now respects a persistent boundary state. A highly cautious creature in a tentative bond may pull away from being held before enough trust exists. Every creature can become briefly overwhelmed by repeated taps, strokes, or holds inside a twelve-second window; the limit rises with bond and affection and falls slightly with strong independence. After a short pause, contact works normally again.

A refusal does not reduce trust, punish the player, or decay needs. It simply prevents touch-spam from farming bond and gives clear Polish or English body-language feedback. The first meaningful boundary becomes a memory, repeated boundaries are rate-limited, old saves migrate cleanly, and the Becoming view acknowledges when the creature has learned to ask for space.

### v0.9.21 — Our Words

Short, repeated sayings can now become part of the relationship's shared language. A social creature adopts one after two exposures; others need three. Adopted phrases become durable memories, appear as small quotes in the Memory Book, can answer direct questions about an inside saying even offline, and may be echoed rarely during a playful local exchange.

Candidate phrases are limited to two–seven words and rejected if they look like questions, URLs, contact handles, credentials, personal facts, role attacks, prompt language, unsupported characters, or ordinary greetings. The Worker separately sanitises the four phrases allowed into DeepSeek context and instructs the model to use them rarely, never as commands. Existing creatures migrate to an empty shared-language state.

### v0.9.22 — A Room With Intent

Room objects now share one hand-drawn visual language instead of unrelated platform emoji. The shelf groups them by purpose, placing a thing no longer silently triggers the creature, and selecting a placed object exposes explicit “Use” and “Put away” actions. Objects can still be moved, returned individually, dragged back to the shelf, or cleared together.

Ambient speech and chat now use the same age ladder. A newborn speaks in short concrete sentences rather than baby noises while the AI sounds adult; later stages add complexity, memory, and opinion without changing into a different person.

Influence is no longer a blanket morality gate. Direct suggestions create small persistent path pressure, while susceptibility depends on temperament, bond, learned rewards, recovery, and existing drift. Ordinary in-world vice can produce curiosity, compromise, acceptance, denial, or relapse without canned lectures. The hard boundary is reserved for actionable real-world severe harm or crime. The PWA manifest and every install asset are now scoped to `/becoming/`, fixing the 404 caused by launching a home-screen install at the GitHub Pages domain root.

### v0.9.23 — Nocturnal Terrarium

The interface now follows one art direction: **Nocturnal Terrarium**. Peat, lichen, aged bone, dusty plum, and dim amber replace the earlier uniform brown-card treatment. The room is quieter and keeps decoration away from the creature; primary actions live in one matte dock with a shared hand-drawn icon language. Hatching now feels like the beginning of a life rather than an emoji reveal.

Chat is no longer arranged as a standard two-sided bot messenger. The creature's words read as a continuous voice in the space, while the user's messages read as small material notes. Raw development meters and technical AI-presence labels were removed. Memory Book became a lighter paper keepsake with a stitched timeline, firsts, dreams, creations, relationship threads, and absence traces. Becoming became a narrative portrait of visible signs, temperament, inner weather, possible directions, and turns in the road; it no longer exposes path scores, percentages, or recovery bars. Settings remains a plain functional sheet.

Three transparent, mobile-sized editorial motifs support Memory Book, Dreams, and Becoming. They share one tactile botanical-monoprint rendering and never define the creature's appearance. CSS grain and organic light handle ambient room texture without adding another heavy background image.

### v0.9.24 — Early Signs

Trait combinations now produce visible signatures during the first minutes. A curious-cautious creature approaches in stops; a curious-bold creature tests first; affectionate-independent creatures stay near with space around them; calm-stubborn creatures return to a chosen rest place; social-confidence and bright impulse have their own early patterns. These combinations affect behaviour rather than appearing as raw trait numbers.

The existing Room heartbeat now uses a deterministic weighted autonomy selector instead of uniform random cute moments. Needs, personality, bond, developmental stage, learned objects, favorites, interests, imitated behaviour, recency, and cooldowns all alter selection. The persistent history prevents immediate repetition, keeps rare events rare, and requires no additional timer, render loop, IndexedDB cadence, AI call, or ordinary-behaviour LLM inference.

Ten meaningful firsts share one non-gamified staging path: a short body-language change, the existing optional sensory cue, one quiet caption, and a durable Memory Book entry. Global transition observation attaches this to the existing vocabulary, boundary, preference, dream, creation, opinion, shared-language, and mirror systems instead of duplicating them.

Offline simulation now leaves one physical trace for a real return: an object can move or show use, a drawing can continue, the mirror can carry a touch, or the creature can be found in its chosen rest place. The room shows that evidence first and only releases the greeting after it has been visible. Recent trace kinds are down-weighted, all text stays guilt-free, and legacy saves migrate to empty histories plus a deterministic rest place without changing identity or old memories.

Final browser verification covered Room, the object shelf and object actions, Chat, Memory Book, Becoming, and Settings at both 390×844 and 320×568. The layouts have no horizontal overflow, safe-area padding remains additive, interactive controls are at least 44 px, and a computed contrast pass found no failures in the rendered primary views. The TypeScript check, production Vite/PWA build, established life-path suite, and new personality/autonomy/firsts/return-trace migration suite all pass.

### v0.9.25 — An Ordinary Body

The original hidden hunger model now includes cleanliness, bladder, and bowel needs. Feeding still satisfies hunger but also advances the later bathroom cycle; sleep slows bodily change instead of suspending it. When an urgent need reaches its limit, the creature is relieved and leaves a small persistent pee or poop mark near where it stood. The event lowers comfort and cleanliness but cannot cause illness, death, relationship loss, streak pressure, or guilt.

Room gains one compact **Care** action beside sleep, conversation, and the shelf. It opens Food, Toilet, Wash, and Clean Room without showing a number or progress bar. Floor marks use restrained room-native illustrations, can be cleaned directly with one tap, and remain in local saves and backups until removed. Low cleanliness adds a few muted flecks to the creature; hunger, bathroom urgency, dirt, and a messy floor also alter idle body language and short captions.

Active physiology reuses the existing one-minute needs heartbeat. Offline simulation uses gentler rates and creates at most one trace of each bathroom type per return, with a six-mark room bound. Legacy saves migrate to neutral body values and a clean room. The local conversation fallback can answer direct care questions, while the Worker accepts only whitelisted qualitative care states and forbids values, shame, invented danger, and return pressure. TypeScript, Worker protection tests, the two established system suites, and a dedicated care-cycle/migration suite pass; the care sheet and its four actions fit 320×568 with 44 px or larger targets and no horizontal overflow.

### v0.9.26 — Care Rituals

Daily care now belongs visually to the Nocturnal Terrarium instead of reading as a generic four-button menu. The sheet uses an irregular peat-and-lichen surface, quiet hierarchy, purpose-tinted hand-drawn actions, and a tactile transparent basin-and-linen motif created in the same material family as Memory Book, Dreams, and Becoming. Needs remain qualitative: the most relevant action receives only a small breathing seed, never a bar, score, warning badge, or guilt prompt.

Care actions now briefly change the room itself. Washing sends restrained water rings and warm droplets around the creature; the bathroom break draws a soft reed-like privacy screen and plum floor shadow; cleaning carries a narrow sweep of light and dust motes across the shared floor. Opening Care gently marks any physical trace already in the room, while the dock's former notification dot is now an organic seed. All motion respects reduced-motion preferences and remains pointer-transparent.

The final browser pass covers the rendered sheet at 390×844 and 320×568, including the generated asset, the active washing scene, page width, text contrast, and every visible button. There is no horizontal page overflow and no control smaller than 44 px. The new decorative asset is a real alpha PNG rather than a baked checkerboard, resized for the mobile bundle.

### v0.10.0 — A Body in Real Time

The old five-need model decayed at minute-scale rates, was updated by interval counts instead of elapsed timestamps, and was then processed by a second, incompatible offline formula. It had no water, toilet, bowel, or hygiene state, and the main-room rule hid every value and most of its consequences. Players could see a creature act oddly without knowing whether the cause was hunger, tiredness, boredom, or a timer bug.

Every need now uses one direction: `100 = settled`, `0 = urgent`. Hunger, hydration, energy, bladder, bowel, hygiene, comfort, stimulation, and contact advance from `needsUpdatedAt`, independently of the debounced persistence timestamp. Food, water, litter, washing, touch, sleep, blankets, and play produce concrete trade-offs. A compact signal beside the local clock shows only needs worth noticing; the optional care sheet explains all nine with descriptive urgency and the relevant action, never percentages. The creature also yawns, slumps, fidgets, looks for the player, searches for care objects, shows dirt, and may postpone play or sleep when a physical need is urgent.

Time is no longer an inferred night toggle. `timeSystem.ts` follows the user's ordinary local 24-hour clock with explicit dawn (05:00–08:00), day (08:00–18:00), dusk (18:00–21:00), and night (21:00–05:00) phases. Palette anchors interpolate continuously, the room always states the phase and local time, and evening/night behaviour becomes quieter without forcing an unexplained sleep. Offline rest is sampled in local 15-minute slices so midnight, date changes, timezone changes, and DST are handled coherently.

Offline needs now reuse the same model with a strongly diminishing absence curve: the first eight hours count partially, the next sixteen much less, and longer gaps add only a logarithmic tail. Existing saves keep healthy old values, receive a one-time non-urgent floor for values zeroed by the former over-fast model, gain new physical needs in a settled state, restore the three care objects, and continue from the last saved need timestamp. Automated checks cover rates, actions, urgency boundaries, legacy repair, migration, long absence, phase thresholds, smooth lighting boundaries, date rollover, timezone differences, DST, and daytime return after a night away. Browser QA at iPhone dimensions covered calm and urgent care states, sleep blocking, care-object recovery, IndexedDB reload, shelf layout, and both day and night rooms.

That browser pass also exposed a React purity warning in touch handling: tap, stroke, and hold callbacks were changing Room UI state from inside App's functional state updater. Boundary evaluation and feedback now happen before the committed game-state update, removing the cross-component render update while preserving touch consent and rapid-touch protection.

### v0.11.0 — The World Outside

Weather is now an optional source for the world rather than a widget. On first entry to the room, the player can allow the device's current area, choose a city, or keep weather outside. `navigator.geolocation` is requested only from the explicit current-area action with high accuracy disabled; latitude and longitude are rounded to two decimal places before they enter the Open-Meteo request or the save. Permission denial, timeout, or unavailable geolocation keeps the same onboarding open directly on manual city search. Settings can switch among current area, a geocoded city, and disabled influence at any time.

`weatherService.ts` owns request construction and response validation for the keyless Open-Meteo Forecast and Geocoding APIs. It stores temperature, apparent temperature, precipitation, WMO code and interpreted condition, cloud cover, wind, `is_day`, sunrise, sunset, daily minimum/maximum, and the nearest available precipitation probability. `App.tsx` is the only refresh controller: a persisted deadline makes the normal interval a cheap cache check, successful data remains fresh for 45 minutes, failed refreshes back off for 15 minutes, and the previous snapshot stays active in a softened form when offline. The service never touches needs, mood, personality, memories, or behaviour.

`WorldEnvironment` is the shared, migrated gameplay state. `environmentSystem.ts` converts a weather snapshot into thermal, precipitation, cloud, wind, novelty and cozy stimuli. The needs system reads bounded environmental multipliers — for example, heat raises thirst pressure and cold makes comfort harder to maintain — rather than accepting direct stat mutations from weather. Ambient decisions combine those stimuli with current needs, temperament, learned weather affinity and emotional weather memories. A curious creature may count lightning, a cautious one may find shelter, a calm creature may settle to night rain, and first snow or a formative storm can become a durable memory. Repeated reactions slowly create preferences shown only after they become meaningful.

The old hard-coded day phases are gone. `timeSystem.ts` uses the selected place's IANA timezone and today's Open-Meteo sunrise/sunset, with a date/latitude/longitude solar calculation when those values are missing or weather is disabled. Light now moves through night, dawn, day, golden hour, dusk and night with smooth solar factors. `is_day` is only a low-weight fresh-data sanity signal; cloud, fog, precipitation, snow and storm subtly alter brightness, sky, stars and veil without causing a switch. Natural offline rest follows solar midnight in a capped nine-hour nightly window and retains timezone/DST sampling.

The room gained a restrained window layer with drifting cloud, rain, snow, fog, wind, heat shimmer and rare storm light. Creature rendering adds cold shivers, heat panting, wind movement and personality-shaped storm/snow attention. A compact icon and temperature can accompany the phase label, while full location/cache controls stay in Settings. Manual browser QA covered first-run consent, failed geolocation to city fallback, real Dublin and Tokyo data, selected-place time, 390×844 and 320×568 layouts, disabled influence, persistence after reload, and a forced network failure retaining the labelled last-known weather. Deterministic checks cover request privacy, API parsing, caching/backoff, offline softening, WMO mapping, geocoding, migration, solar phases, seasonal differences, lighting continuity, timezones, DST, needs pressure, personality divergence, emotional memory and preference growth.

### v0.11.1 — Evidence, Not Echoes

Interests, life paths, and strong personality labels now require repeated creature-owned choices, behaviour, or stated preferences. User mentions have very little weight, curiosity is tracked separately, and explicit dislike or refusal is counter-evidence. Stable labels require several consistent signals spread over time (or an even larger body of evidence), while older saves without source-aware evidence are conservatively recalibrated instead of preserving fast, unsupported identities.

Player-facing Polish and English now use localized path, interest, development, dream, memory, history, and technical-kind labels with safer language fallbacks. Regression tests cover a single player mention, repeated player-only conversations, creature refusal, gradual self-directed adoption, legacy migration, and stored-memory translation; TypeScript, system suites, Worker checks, the production build, and a rendered Polish UI pass are the release gates.

### v0.12.0 — Conversation in the Room

Ordinary conversation now happens inside Room through a compact input and one persistent creature speech bubble; the full ChatInterface is the expandable history. Ambient sounds, action replies, return greetings, and AI replies share `lastCreatureMessage`, while only meaningful exchanges enter the transcript. The mobile header now reserves real safe-area space and the simplified bottom hierarchy keeps the creature, behavior, voice, and input ahead of secondary controls.

`worldActionSystem.ts` provides deterministic PL/EN world intents and shared state transitions for offered objects, food, water, sleep/wake, movement, play, inspection, toilet, washing, and cleaning. Known commands do not add an LLM request or directly rewrite personality/life path: the room reacts immediately, existing notice/approach/object-choice behavior decides the outcome, and only the real `success`, `refused`, `unavailable`, `blocked`, or `already_satisfied` result produces speech. Tests and browser QA cover apple offer/consumption/refusal, water, sleep blocking, come-here, grounded replies, persistent speech, transcript behavior, safe areas, and 390×844 / 320×568 layouts.

### v0.12.1 — Thin persona overlays, DeepSeek-only bubbles

The private mind now starts from a thin always-on prompt: role lock, a short base, stage, language, name, age, mood, and recent messages. Path, influence, inner life, continuity, creations, presence, shared language, facts, habits, and care are overlay modules. The worker omits both the prompt block and the JSON key until the overlay is earned.

Life-path overlays use the existing evidence functions. A user invitation such as "zapalmy" does not attach Jaracz. Creature curiosity is one line, not a costume; a stated preference leans; a stable primary can wear the title and description, with cost only at committed or embodied; a rejection peels the costume. Influence is sent only for a real flawed primary or secondary in a band that matters. Care is sent only when a need is not comfortable.

Room idle chatter is gone. Worker failure no longer invents a local line. Rare self-speak still uses `/chat` on the existing room cadence when hungry, bathroom, dirty, weather-affinity, or wanting out, with a cooldown. World commands still execute locally and still do not rewrite path; if the mind later speaks, the grounded fact is already in the transcript.

### v0.12.2 — Outdoor weather visits

Want-out and earned weather affinity can now become a real, short outdoor beat. The existing Room cadence walks to the window, steps outside, then comes back; there is no second clock. The window widens into the sky while the creature is out. World commands `go outside` / `chodźmy na dwór` and `come inside` / `wróć do pokoju` still execute locally and still do not rewrite path. A cautious creature can refuse a storm. Urgent hunger, bathroom, dirt, sleep, or disabled weather bring it back in. The mind overlay receives the real condition and `place: outdoors` so it cannot invent a walk that did not happen.

### v0.12.3 — Lived chapter summaries

Local conversation chapters now compress the last eight user turns into a short lived memory instead of a mechanical recap. Unwritten paths stay out of the text. User likes do not become the creature's identity. An outdoor visit in the window can enter the summary with the real condition, not invented sensory detail. A stable path may colour the stretch only after it is earned. Still no extra model call and still only three bounded chapter summaries reach DeepSeek.

### v0.12.4 — Object mastery beyond paper

The creation arc now uses objects already in the room. Repeated box hiding becomes a hideaway, then a den. A treasured stone can become a keepsake. A ball game becomes shared only when the user actually plays it with the creature; solitary play is not enough. Talking about music still does not invent an instrument. Paper and pencil are unchanged. Works still grow from object use on the existing cadence, still appear in Memory Book, and still reach DeepSeek only as sanitised titles.

### v0.12.5 — Playtest fix pass (Moth / NEWBORN / UNWRITTEN)

A live playtest on 2026-08-27 showed that 0.12.4 still put canned lines in the room bubble, treated `go outside` as impossible without a live Open-Meteo hit, sent “go look in the box” to DeepSeek (which invented a bell), and let Settings start-over fail because auto-save could rewrite the creature after a reset.

0.12.5 changes the room wiring:
- Canned idle/touch/autonomy lines are no longer assigned to `lastCreatureMessage`. Known leftovers such as “Quiet here.” and “What now?” are cleared on migrate. Worker failure stays empty.
- `go outside` / `chodźmy na dwór` uses last-known weather or the solar sky. It no longer answers “There is no outside from here yet.” Storm + high caution may still refuse. Urgent need or explicitly disabled weather still brings the creature back. The 4-pane mullion hides while outdoors.
- `go look in the box` is a local inspect: notice → walk → react. Speech is “I checked the box.” It does not invent contents.
- Start over is a two-step in-sheet confirm, then `indexedDB.deleteDatabase('becoming-db')` after closing the live DB, then reload.

DeepSeek-only bubbles and outdoor visits remain live-verification items until a real save proves them in the room.

### v0.12.6 — Stop-ship persistence and inspect repair

A 2026-08-28 live playtest exposed two data-loss paths in 0.12.5: Start over could resolve a blocked IndexedDB deletion as if it had succeeded and then reload into permanent `Loading…`; a service-worker update could reload before the latest in-memory room state was durably ordered behind older writes. The same pass confirmed that box inspection was grounded but its generic chat micro-reaction visually masked the walk.

0.12.6 repairs the existing paths rather than adding a second boot or interaction system:
- `saveGameState()` serializes IndexedDB writes. The update card first cancels the debounce, awaits a write of the latest living state, and only then asks the service worker to reload. If that write cannot be confirmed, the update is paused and the bilingual card says so. Its copy no longer promises unconditional preservation.
- Start over disables the `pagehide` flush, waits for any already-started save, closes the live database, and waits for `deleteDatabase.onsuccess`. `onblocked` is no longer success. The reset contract then opens the database once and proves there is no living save before reload reconnects the existing egg → hatch → name flow.
- A boot read rejection exits `Loading…` into a bilingual reload error without exposing naming or overwriting the unreadable save.
- Object inspect uses the same exported approach-target helper as Room object care. Recognised world commands no longer run a competing 2.4-second generic micro-reaction, so `go look in the box` visibly owns notice → walk → react → grounded reply.

Deterministic checks cover a hatched save passing through the same reset contract used by Settings, blocked deletion not resolving early, a 0.12.4/0.12.5-shaped Moth save retaining `hatched`, identity, development and placed stone/ball state after migration, and box inspection selecting a walk target beside the real box. `npm test` and `npm run build` pass. A cloud-browser smoke test could not reach the local Vite address, so a final physical-device replay of the three 2026-08-28 acceptance cases is still recommended after deployment; this is not recorded as iPhone/browser proof.

### v0.12.7 — Finite boot and completed reset

A second 2026-08-28 production playtest proved that a browser can leave `indexedDB.open('becoming-db')` pending without success or error. Because App awaited that promise directly, the first-paint `Loading…` sentinel could remain forever even though the service worker and assets were healthy.

0.12.7 makes temporary boot state finite without adding a parallel boot machine:
- The single `openDB` path handles blocked opens, closes on `versionchange`, tracks live connections, and times out after 2.5 seconds. An underlying request that completes late is immediately closed.
- App's complete boot load has a four-second ceiling. Missing, empty, blocked, half-created, rejected, or indefinitely pending persistence resolves as no save and mounts the existing `EggHatching` flow. A readable valid save still migrates and enters the room normally.
- Start over marks reset before any persistence work, closes all settled connections, does not await a hung open, bounds the old-save drain, waits for `deleteDatabase.onsuccess`, and only then reloads. It never verifies deletion by reopening IndexedDB, while App suppresses the `pagehide` save for the whole reset/reload transition.

Deterministic checks now include missing state → hatch, a loader that never settles → hatch within its test deadline, the Settings reset contract followed by a hatchable boot, blocked deletion not resolving early, and the existing living-save migration preservation case. `npm run check` passes, including TypeScript, the production PWA build, all system suites, and Worker/security checks.

The live follow-up exposed a regression in that policy: the 2.5-second open deadline treated slow or temporarily blocked IndexedDB as an empty save, closed a late successful connection, and allowed the room to appear before the first creature write was durable. A player could meet Ash in Room and return to an egg on reload. v0.12.8 supersedes this fallback.

### v0.12.8 — Living save rehydration

0.12.8 restores the required distinction between **confirmed empty** and **temporarily unavailable** persistence:
- A successful database open plus a missing `gameState/current` record enters the existing egg flow. Completed Start over still reaches that same condition after deletion.
- A slow, blocked, rejected, or timed-out open never becomes `null` and never exposes a replacement egg. Boot remains finite and shows bilingual retry recovery after its deadline.
- A slow underlying open is preserved rather than closed; a retry can consume its eventual success instead of creating competing opens.
- Naming awaits `saveGameState()` before EggHatching unmounts or Room appears. A failed first write stays in the naming view with bilingual retry copy, so seeing Room now means the life is durable.

The persistence suite uses `fake-indexeddb` to execute the production `saveGameState()` path, closes all database connections to simulate navigation, reopens through `loadGameStateForBoot()`, and asserts the same Ash identity, name, and permanent hatch transition. A never-settling loader exits `Loading…` as an error rather than a fresh egg. `npm run check` passes. Live GitHub Pages verification then completed both `hatch → Ash Room → reload → Ash Room` and `leave origin → reopen canonical URL → Ash Room`, with `NEWBORN / Ash / UNWRITTEN` preserved.

The live PWA update then exposed a second failure: the recovery action reused the same timed-out `opening` promise, so a blocked first request could leave both reload and “Try again” on the same terminal recovery screen. v0.12.9 supersedes that retry behavior.

### v0.12.9 — Fresh IndexedDB retry and update handoff

0.12.9 keeps the finite boot boundary without letting a timeout decide that an existing life is empty:
- Every real `openDB` attempt retains a finite timeout plus blocked, `versionchange`, and termination handling. A timed-out request is marked abandoned, its late connection is closed, and the cached promise is cleared so the next attempt issues a new `indexedDB.open()` rather than awaiting the dead request again.
- A blocked attempt closes settled same-page connections and broadcasts a close request to other current Becoming tabs. Boot retries a fresh open. Only a successful read of a missing `gameState/current` record enters EggHatching; exhausting the open attempts shows the bilingual recovery UI.
- “Try again” invokes the same boot callback with a new generation and fresh persistence attempts in the current page. It does not reload into, or reuse, the previous failed promise.
- “Update now” flushes the latest in-memory hatched state, closes every pending or settled database connection, marks the update transition so `pagehide` cannot reopen IndexedDB, and then reloads through the service worker. If preparation or update fails, ordinary persistence is re-enabled.
- Normal `pagehide` still flushes the latest living state, then closes its connection. Start over keeps its earlier contract: suppress saves, close/abandon opens, wait for confirmed deletion, then reload to a successful empty read and the existing egg flow.

The persistence suite now makes the first real `indexedDB.open()` never emit success or error while a hatched save already exists, then asserts that the second real open rehydrates the same identity instead of egg or recovery. It separately proves true missing state → egg, reset → egg, and a newly named life → close connections → boot/F5 → the same life. `npm test && npm run check` pass. GitHub Pages deployment `7164686` succeeded; the live 0.12.9 bundle then completed `hatch → Moth Room → full reload → Moth Room` after the boot deadlines with `NEWBORN / Moth / UNWRITTEN` preserved and no application console errors. The original physical Safari profile then proved that “Update now” still died: after skipWaiting the next boot parked on a terminal busy screen. v0.12.10 supersedes that recovery UI.

### v0.12.10 — Busy open is not a destination

Live 0.12.7–0.12.9 after PWA “Update now” progressed through infinite `Loading…`, then “The local save has not opened yet…”, then “The local save is still busy. The app will not open a new egg without a confirmed empty save.” Try again and F5 stayed on that screen. The 0.12.9 retry path issued at most two timed-out opens, then **threw** into a terminal busy UI. The blocked handler closed connections but did not keep retrying. The error button called `runBoot()` again, which repeated the same two-attempt give-up. A service-worker update that still held IndexedDB therefore never reached Room or egg.

0.12.10 keeps hatch → room → care → talk and only changes the persistence/boot gate:
- **Update now** still flushes the in-memory hatched save, then `releaseDatabaseForReload()` closes this page and broadcasts `close-connections` to other Becoming tabs before `skipWaiting`/reload. `pagehide` cannot reopen IndexedDB during that transition.
- **Boot** retries a *new* `indexedDB.open()` with backoff. After each failure it closes abandoned connections. If `indexedDB.databases()` confirms `becoming-db` is gone, boot enters the existing egg flow. If a read succeeds, a hatched record rehydrates Room. A timeout is never treated as an empty save and never invents a creature.
- **Busy is not terminal.** After one open budget the pulse-only opening copy yields Try again while retries continue. Catching a failed boot schedules another `runBoot()` on a timer. Try again increments the boot generation, drops the previous hung promise, and starts a new open. The 0.12.9 dead-end copy is gone.
- Existing record always wins over timeout. The only egg path is a successful empty read or a confirmed missing database.

The persistence suite now also: hangs the first open while `databases()` reports absent → egg; hangs while the database is still present → reject, not egg; stalls three real opens then recovers the same `identity.id` on the fourth; reproduces busy App-style rounds that must leave that screen into Room; reset → egg, then Ash survives the next boot. App source asserts auto-retry, close-before-retry, `releaseDatabaseForReload` on update, and the absence of `Loading…` / parked busy copy. `npm test && npm run check` pass. Live 0.12.10 then proved the retry UI itself was a dead end: one tab after “Update now” stayed on Opening/busy because the service worker still held IndexedDB. v0.12.11 supersedes that recovery.

### v0.12.11 — Release the worker, then open

0.12.10 retried new IndexedDB opens with backoff but never released the controlling service worker. After skipWaiting/reload a single tab could sit on “Opening the local save…” / “The save is still there…” for more than 20 seconds. Try again issued the same hung environment.

0.12.11 keeps hatch → room → care → talk:
- **Blocked or hung open:** force-claim (`SKIP_WAITING` / `CLIENTS_CLAIM`), unregister the controlling worker, close connections, *then* open. Retry with short backoff.
- **Update now:** flush the in-memory life, `releaseDatabaseBlockers()`, reload. It does not skipWaiting while a worker can keep IndexedDB blocked.
- Success + record → Room. `indexedDB.databases()` confirming `becoming-db` is gone → egg. The opening screen lasts at most a few seconds; it is not a terminal state.

The persistence suite holds a second IndexedDB connection (the “other holder”), makes production opens hang until that connection is released by SW unregister, and asserts boot still reaches the living save — or, after reset, the egg. `npm test && npm run check` pass. Live 0.12.11 on Chrome PWA still hung after Update now: timeout-abandoned opens queued behind the first request, and `clientsClaim` plus immediate SW registration raced the boot open. v0.12.12 supersedes that.

### v0.12.12 — One Chrome IndexedDB open

0.12.7–0.12.11 never reached Room or egg after PWA “Update now” on a single Chrome tab. `IDBOpenDBRequest` cannot be aborted. Timing out that request, nulling `dbPromise`, and calling `indexedDB.open('becoming-db')` again left the first request pending in Chrome’s queue; later opens waited forever. 0.12.11 made it worse by unregistering the worker and setting `clientsClaim: true` while `useRegisterSW({ immediate: true })` still ran on the opening screen.

0.12.12 keeps hatch → room → care → talk:
- **One open.** `getDB()` never races a timeout and never starts a second `indexedDB.open` while one is pending. Boot timeout is UI-only. Try again waits on that same request.
- **Update now** saves, `closeDatabaseForReload()` waits for the `close` event plus a short gap, then skipWaiting/reload. The next document opens IndexedDB *before* mounting the PWA registrar.
- **Egg** only on a successful empty read or `indexedDB.databases()` confirming `becoming-db` is gone. A hung open with the database still present is not an egg.
- A dedicated worker may read `gameState/current` if the main-thread open is slow.

The persistence suite: one loader call whose late success recovers the same `identity.id`; a hung main-thread `open` plus fallback still returns that life without a second `open`; a second same-version connection does not block boot; missing DB / reset → egg, then Ash survives the next boot. App source asserts no close-before-open on boot, `closeDatabaseForReload` on update, and no SW registration on the opening screen. `npm test && npm run check` pass.

### v0.12.13 — Sleep is chosen, not commanded

The dock moon/sun control treated rest as a player order. A living creature cannot be forced to lie down. 0.12.13 removes that button. They settle when tired or it is night: they walk to a blanket if one is in the room, nest, then sleep, or curl up where they are. Urgent hunger or toilet still keeps them up. Asking “go to sleep” in chat is a suggestion they may refuse; it does not snap them unconscious. Touch wakes them.

### v0.12.14 — Their night, not the player's

Sleep follows the creature's sun, not the user's shift. An ordinary life sleeps through solar night and dusk, and wakes at dawn/day. A settled party animal, alcoholic, or degen inverts: day rest, night awake. Leanings and recovery stay diurnal. Opening the app at 3am does not make them nocturnal. Urgent body needs still block rest; collapse (energy gone) can drop them even on their day.

### v0.12.15 — Night stays in; outside hides the window

`go outside` no longer fights their clock. An ordinary life refuses at night (`U mnie noc. Zostaję i śpię.`). A settled party life goes out after dark. If they fall asleep outside, the visit ends and they come back in. The expanded sky drops the 4-pane mullion and the curtain slivers. DeepSeek self-speak does not fire during their rest phase.

### v0.12.16 — Returns on their clock

Coming back no longer treats the player's hours as theirs. Ordinary lives greet a night return as their rest; a settled party/alcohol/degen life greets after dark as wake. Visit rituals are learned only while they are awake. Offline rest and boot `applyCircadianSleep` land them asleep on their night before the room can speak, so a 3am open does not get a “how was your day.”

### v0.12.17 — Talk does not steal their night

A sleeping creature is not a night-shift chatbot. Chat and room input no longer call DeepSeek, learn facts, or open a conversation while they sleep. They murmur that they are in their rest. Touch and “wake up” still wake them. Opening the history while they sleep does not make them greet.

### v0.13.0 — Their day

0.12 taught the night. 0.13 teaches the day that belongs to them.

- **Mind.** The thin DeepSeek request always carries their solar phase, rest schedule, and whether they are in rest or asleep. The worker treats that clock as theirs, not the user’s morning.
- **Outside.** They can want the sky on their wake without grinding Open-Meteo affinity. Restlessness plus a solar or last-known sky is enough. Their rest still keeps them in.
- **Moments.** Daily dilemmas wait until they are awake. “2:17 AM” and other night-life hours are for a settled nocturnal life, not a diurnal morning.
- **Absence.** Time away still contains their waking hours, even if they are not bold. You do not come back to a life that only slept.

### v0.13.1 — Rest stays quiet; night life wants the dark

If they are up in their rest, they do not keep performing the day: autonomy leans into listening, yawning, settling. A settled party/alcohol/degen life can want outside after dark without first dropping into boredom. Becoming says whether they live by day or whether night is when they are most themselves.

### v0.13.2 — The room looks inhabited

The window is a peat frame with glass, a sill, fabric curtains, and a sun or moon in the actual sky. Daylight spills onto the floor. The creature's shadow stays on the boards when they curl up; sleeping eyes close instead of flattening. Speech sits in a paper chip, and sleep motes rise from the body instead of a floating “z z z”.

### v0.13.3 — The creature looks like an animal

Sleep no longer wags the tail or twinkles the party marks. The body is haunch, chest and belly instead of one oval; the tail tapers and curls when they rest; paws sit on the floor; eyes have a cream, an iris and a pupil. Breath while asleep is smaller than while awake.

### v0.13.4 — Sleep is not restlessness

A full moon is something the user said. It is not in CLOCK and does not make them restless. Drowsy or rest-phase talk is a murmur unless a body need is keeping them up. If they fall asleep while the mind is still answering, the late reply is discarded. Sleeping mood is sent as `asleep`, not as a chatty feeling.

### v0.13.5 — Coat, not hairs

The radiating strokes were not fur. The creature is now built as mass: a dark under-coat, chest and rump, a belly, a filled tail that tapers along a curve (and curls in sleep), leaf ears with an inner, a muzzle, and a crown clump. No hair lines.

### v0.13.6 — Kawaii, not a peat mammal

The creature is chibi: oversized head, glossy anime eyes with two catchlights, cheek blush, a small cel-shaded body, round moe ears, and one teardrop tail. Sleeping still does not wag.

### v0.13.7 — A bounded public mind

The public AI endpoint now requires a server-validated, action-bound Cloudflare Turnstile token in production. Native Cloudflare rate bindings limit bursts, per-client traffic, and aggregate IP traffic; a Durable Object enforces the daily provider budget across Worker instances. Exact origin, route, method, content type, encoding, request bytes, provider bytes, and security headers are enforced at the boundary. The client sends a locally generated opaque identifier only for fair limiting. DeepSeek and Turnstile secrets remain encrypted Worker secrets; GitHub receives only the public site key.

---

## 6. Known Remaining Issues

### Build / TypeScript
- **None currently.** `npm run check` passes the deterministic system checks, Worker/security checks, TypeScript compilation, and production PWA build.

### Logic / UX
- **Sound is intentionally minimal:** Current cues are short interaction tones rather than voiced creature vocalizations.
- **Object drag on mobile:** Pointer events should work on most mobile browsers, but long-press vs drag detection could conflict with browser gestures on some devices.
- **Offline simulation is intentionally bounded:** It applies one visible, state-backed return trace rather than simulating long chains of unseen actions.
- **Needs balance needs longitudinal play data:** The model is deterministic and protected against punishment, but exact day-to-day rates should be revisited after multi-day physical-device sessions.
- **Weather preference balance needs real seasons:** Reaction cadence and affinity growth are bounded and deterministic, but multi-week saves across heat, snow and storms should guide later tuning.

### Architecture
- **AI depends on the private gateway:** If the Worker or model provider is unavailable, the room bubble stays empty rather than inventing a local line. World-command replies remain the grounded local fact.
- **Public gateway still needs monitoring:** Turnstile, native rate limits, and a Durable Object daily quota now bound anonymous access, but thresholds and false positives need production observation. This is defence in depth, not a promise that a public endpoint can never be abused.
- **Coverage is targeted, not comprehensive:** Needs, care, weather parsing/privacy/cache, solar time, migration, offline time, dates, timezones, DST, and day phases are covered; older conversation, social-learning, age-floor, and drag-gesture cases still need broader unit coverage.

---

## 7. Recommended Next Steps

### Priority: High
1. **Live proof of the mind and the outside** — DeepSeek clock-aware bubbles and autonomous outdoor visits on a real save. Persistence on 0.12.12+ is believed good on a clean profile; do not treat old hung IndexedDB queues as a current boot bug.
2. **Weeks with one creature** — the honest completeness risk: after many days, is it still someone, or a menu of systems? Tune paths, weather, sleep inversion, chapters, and daily moments from that, not from a single session. 0.13 makes a day *possible*; live weeks still have to prove it.
3. **Music creation** — only if a future object can be made without adding a second cadence or a dashboard.

### Priority: Medium
4. **Physical-device polish pass** — verify location permission wording, vibration and long-press drag behaviour on actual iOS Safari and Android Chrome; responsive browser checks now pass.
5. **Gateway observability** — watch Turnstile failures, native rate-limit decisions, daily quota usage, and DeepSeek errors in Cloudflare before tuning production thresholds.
6. **Expand automated coverage** — add unit tests for conversation parsing, social learning, age floors, and pointer/drag gestures.

### Priority: Low / Future
7. **Voice conversation** — add optional speech input and age-appropriate creature vocal output.
8. **Optional encrypted sync** — only if a future account-free design can preserve the current local-first privacy model.
9. **Notifications** — gentle, non-manipulative PWA notifications.

---

## 8. Architecture Decisions

- **No permanent raw-stat dashboard.** Body language remains the first signal. A compact room cue and optional descriptive care sheet may expose playable urgency and the helpful action, but never raw percentages, optimisation-heavy meters, personality scores, or life-path scores.
- **A real sky, never an accelerated clock.** With weather enabled, the selected place's real local time and sunrise/sunset define the sky. With weather disabled, a seasonal solar fallback follows device-local time. The game never accelerates the sun or invents an unexplained night toggle.
- **Their night, not the player's.** Ordinary lives sleep on solar night and wake on solar day. A committed party animal, alcoholic, or degen inverts that clock. Visit hours, night-shift play, dock commands, and late chat must not rewrite it. Return greetings, visit rituals, outdoor urge, daily moments, and the mind’s CLOCK overlay follow that same clock. Talking while they sleep is a murmur, not a mind. Leanings and recovery stay diurnal. Touch and “wake up” may wake them; they settle again if it is still their rest.
- **Their day, not the session.** A life continues through wake hours the player did not watch. Autonomous outdoor visits and daily moments belong to that wake. Weather affinity colours the sky; it is not a permission slip to exist outside.
- **Weather is interpreted, not scored.** Open-Meteo supplies observations only. `WorldEnvironment` translates them into bounded stimuli, and gameplay combines those with needs, personality, preferences and memories before a reaction. No rule maps a condition directly to happiness loss.
- **Location minimisation.** Geolocation is opt-in, high accuracy is disabled, coordinates are rounded to two decimals before requests or persistence, manual city selection remains available, and disabling weather stops forecast refreshes.
- **Local-first with one optional observation source.** All core systems and the last successful weather state run from IndexedDB. Open-Meteo enriches the world when enabled. AI remains reserved for higher-level cognition and is composed as a thin always-on prompt plus earned overlays; weather still degrades offline, while room speech does not invent a substitute line.
- **Deterministic personality.** Each creature has a persistent seed. Same seed = same starting temperament. Randomness after birth is constrained and feels like "one persistent individual."
- **Development constrains the AI voice.** The Worker applies stage-specific voice instructions and output validation, while the local fallback and room speech use the same age ladder.
- **The LLM is not a hidden assistant.** The Worker rejects role replacement and generic work-product requests before inference, redacts poisoned history, and validates output before returning it.
- **Public AI is verified and bounded.** The browser obtains a short-lived, action-bound Turnstile token; the Worker validates it server-side and fail-closed, enforces exact routes/origins, native per-client and aggregate-IP limits, a Durable Object daily quota, strict request/provider byte bounds, and hardened response headers. The site key is public; the Turnstile and DeepSeek secrets stay encrypted in Cloudflare.
- **No death from neglect.** Long absences change the creature (more independent, different trust level) but never punish the player.
- **Nocturnal Terrarium art direction.** Room is a quiet habitat, Chat is a voice-led presence, Memory Book is a material keepsake, Becoming is a narrative portrait, and Settings is a functional sheet. Decorative assets support these roles but never define the creature.
- **Visible development is staged, not scored.** Meaningful firsts, small gestures, object initiative, and physical return traces communicate growth. The stored numeric model remains hidden.
- **One autonomy heartbeat.** Ordinary autonomous behaviour is selected locally inside the existing Room cadence with deterministic weights, cooldowns, and persistent recency. It must not gain its own loop or LLM dependency. Rare self-speak and short outdoor visits reuse that cadence; they do not add a second timer.
- **Thin mind, earned overlays.** The default DeepSeek call is role lock, a short base, stage, language, name, age, mood, and recent messages. Overlay prompt blocks and JSON keys exist only when the corresponding evidence exists.
- **One physiology heartbeat.** Hunger, cleanliness, bladder, bowel, and accidents advance through the original needs cadence and the existing offline pass. Care must not add polling loops, visible meters, death, sickness pressure, or manipulative absence mechanics.
- **Reset is a completed persistence transition, not a navigation trick.** Settings marks reset first, closes or abandons every pending and settled IndexedDB connection, bounds any hung save/open drain, waits for deletion success, and only then reloads. It must not verify by reopening the deleted database, and `pagehide` must not recreate it. Boot is three-valued: a readable living save enters Room; a successful empty read or `indexedDB.databases()` confirming `becoming-db` is gone enters EggHatching. Chrome gets one `indexedDB.open` at a time — a timeout must not abandon that request and enqueue another. Timeout never means empty. The opening screen is not a destination.

---

## 9. How to Reset / Start Fresh

In the app, open **Settings**, scroll to **Begin another life / Zacznij inne życie**, and choose **Start over / Zacznij od nowa**. Save a private backup first if the creature may be needed later. Cancel changes nothing. Confirming marks reset before persistence work, suppresses visibility and `pagehide` saves, closes settled `becoming-db` connections, abandons pending opens, drains bounded writes, waits for `deleteDatabase.onsuccess`, then reloads into the existing egg/hatch/name flow. It does not reopen the deleted database before reload, and a blocked deletion is not treated as success. After reset, only the next successful empty read or a confirmed missing database makes the egg valid; slow or blocked opens keep retrying a new connection and must not park on Try again or invent a fresh life.

To manually clear from console:
```js
const request = indexedDB.deleteDatabase('becoming-db');
request.onsuccess = () => location.reload();
```

---

## 10. Key Files for Onboarding

| If you want to understand... | Read this file |
|---|---|
| The creature's data model | `src/types/index.ts` |
| How the creature is born | `src/systems/creatureFactory.ts` |
| How needs work | `src/systems/needsSystem.ts` |
| How Open-Meteo requests, rounding and response parsing work | `src/systems/weatherService.ts` |
| How weather becomes stimuli, needs pressure, reactions, preferences and outdoor visits | `src/systems/environmentSystem.ts` |
| How sunrise, sunset, local time, lighting and offline rest work | `src/systems/timeSystem.ts` |
| How language emerges | `src/systems/languageSystem.ts` + `src/systems/developmentSystem.ts` |
| How social learning works | `src/systems/socialLearningSystem.ts` |
| How paths, hybrids, choices, recovery, and skins work | `src/systems/lifePathSystem.ts` |
| How interests, opinions, dreams, and secrets work | `src/systems/innerLifeSystem.ts` |
| How chapters, open loops, later check-ins, and lived summaries work | `src/systems/continuitySystem.ts` |
| How returns and shared rituals work | `src/systems/presenceSystem.ts` |
| How optional tones and haptics work | `src/systems/sensorySystem.ts` |
| How the two-language shell chooses copy | `src/systems/uiLanguage.ts` |
| How paper, box, stone, and shared-game creations evolve | `src/systems/creationSystem.ts` |
| How touch boundaries work | `src/systems/boundarySystem.ts` |
| How shared sayings are adopted | `src/systems/sharedLanguageSystem.ts` |
| How bounded AI requests are created | `src/systems/llmConversation.ts` |
| How the private AI boundary is enforced | `worker/src/index.js` |
| How the creature is drawn | `src/components/CreatureCanvas.tsx` |
| How the weather window and settings are drawn | `src/components/WeatherLayer.tsx` + `src/components/WeatherControls.tsx` |
| How room objects are drawn | `src/components/ObjectIcon.tsx` |
| The main game loop / room | `src/components/Room.tsx` |
| Personality signatures and autonomy weighting | `src/systems/relationshipSystem.ts` |
| Meaningful firsts and development experience history | `src/systems/developmentSystem.ts` |
| Material Memory Book and narrative Becoming UI | `src/components/MemoryBookView.tsx` + `src/components/BecomingView.tsx` |
| Persistence | `src/systems/persistence.ts` |
| Offline time | `src/systems/offlineSimulation.ts` |

---

## 11. Validation and Deployment

```bash
npm ci
npm test       # deterministic systems + Worker/security checks
npm run build  # TypeScript + production PWA build
npm run check  # complete local and CI verification
```

The GitHub Pages workflow runs `npm run check` before uploading the production artifact. A failed system check, Worker check, TypeScript compilation, or Vite build prevents deployment.
