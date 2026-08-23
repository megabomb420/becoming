# Becoming — Handoff Document

> **Working Title:** Becoming  
> **Tagline:** Watch something become someone.  
> **Version:** 0.9.20
> **Last Updated:** 2026-08-23

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
| AI mind | DeepSeek V4 Flash behind a private Cloudflare Worker proxy |
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
│   │   ├── persistence.ts      # IndexedDB save/load + migration
│   │   ├── creatureFactory.ts  # Birth/egg generation, seeded traits
│   │   ├── needsSystem.ts      # Hidden hunger, energy, comfort, stimulation, social
│   │   ├── developmentSystem.ts # Stage progression, vocabulary acquisition
│   │   ├── languageSystem.ts   # Stage-constrained speech generation
│   │   ├── conversationSystem.ts # Persistent dialogue, user facts, growing mind
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
| Birth / hatching | ✅ | Tap-to-hatch egg, naming; `hatched` flag prevents regression |
| Creature rendering | ✅ | Canvas-based with breathing, blinking, expressive eyes/ears/tail, and distinct walking, observing, investigating, eating, playing, and settling body language |
| Hidden needs system | ✅ | 5 internal needs decay over time; no visible stats |
| Hidden personality | ✅ | Seeded traits that now evolve through care, play, touch, exploration, and conversation |
| Bond development | ✅ | Persistent tentative → familiar → close → bonded relationship arc with milestone memories, bond-aware idle behavior, and later-stage speech |
| Development stages | ✅ | `egg → newborn → animal → communicating → first_words → combining → sentences → mature`; stage regression prevented once hatched |
| Language development | ✅ | Stage-constrained vocabulary; proto-sounds → words → combinations → sentences |
| Object system | ✅ | Inventory tray (📦) with 9 object types; tap to place, drag to position, tap a placed object to call the creature, and `Tidy room` to reset the space |
| Object preferences | ✅ | Individual seeded tastes that evolve through experience; favorites, uncertainty, refusals, learned play, drawing, box hiding, and mirror recognition |
| Feeding | ✅ | Food placement calls the creature immediately; food is consumed and returned to the tray for repeated use |
| Creature movement | ✅ | Goal-driven state machine: idle → notice → look → approach → react; bounded shared floor coordinates and refresh-rate-independent canvas movement |
| Touch interactions | ✅ | Tap, stroke (drag), hold on creature canvas |
| Sleep / wake cycle | ✅ | Room dims; "z z z" animation; energy restored on wake via `sleepStartTimestamp` |
| Offline simulation | ✅ | Calculates what happened while app was closed; respects sleep state; models night spans |
| Persistent state | ✅ | IndexedDB survives refresh, restart, reopening; migration layer repairs old saves |
| Memory Book | ✅ | Emergent biography from significant memories |
| Mobile-first UX | ✅ | Tested at 390×844 and 320×568; safe-area offsets, 44 px primary targets, scrollable sheets, and non-overlapping controls |
| Social Learning & Imitation | ✅ | Behaviour parsing, observation tracking, imitation engine |
| Creature-initiated chat | ✅ | Creature can start conversations based on observations |
| Chat interface | ✅ | Full-screen conversation with constrained responses |
| Live AI mind | ✅ | DeepSeek replies through a private backend; the browser never receives the API key and gracefully falls back to local dialogue |
| Life paths | ✅ | 12 slowly forming lifestyles shaped by conversation, objects, repeated choices, consequences, and recovery |
| Crossbreeds | ✅ | Compatible dominant tendencies combine into named hybrid identities such as Fog Gamer, Chill Sage, or Gentle Anchor |
| Daily moments | ✅ | One authored dilemma per creature-day; choices alter the path and become persistent memories |
| Visual evolution | ✅ | Body shape, gaze, colour, aura, room tint, marks, and accessories change with the current path and hybrid |
| Becoming view | ✅ | Shows the current identity, visible clues, possible lives, recovery, skin stage, and turns in the road |
| Organic interests | ✅ | Conversation and object play grow curiosities into interests, passions, and obsessions without a manual skill tree |
| Own opinions | ✅ | Seeded views evolve slowly and can disagree with the user instead of mirroring every message |
| Dreams | ✅ | Meaningful sleep remixes real memories and preoccupations into persistent, shareable dream fragments |
| Private thoughts | ✅ | Personal thoughts form from interests and dreams but require the appropriate bond stage before disclosure |
| Conversation chapters | ✅ | Every eight user turns form a local relationship chapter; older low-value moments are compressed while important memories remain intact |
| Open loops & check-ins | ✅ | Goals, difficult feelings, promises, and unfinished stories can return hours later and close when the user reports an outcome |
| Mirror self-awareness | ✅ | Repeated mirror encounters form a permanent unaware → other → copying → recognized → reflective arc with milestone memories |
| Return presence | ✅ | Reopening after time away creates a gentle, time-aware greeting without guilt or punishment |
| Shared rituals | ✅ | Visit timing and consecutive-day rhythm are learned locally and can become a visible relationship ritual |
| Optional sound & haptics | ✅ | Synthesised interaction tones and restrained vibration can be controlled independently on-device |
| Creature creations | ✅ | Paper + pencil mastery grows from a first mark into shapes, pictures, and a deliberate message kept in the room and Memory Book |
| Private backup | ✅ | Export and restore the complete creature as a validated local JSON file with no login or cloud upload |
| Polish + English UI | ✅ | Device-aware default plus an explicit two-language switch keeps the room, settings, backup, chat shell, and AI language aligned |
| Visible PWA updates | ✅ | A bilingual update card replaces silently stale service-worker sessions and preserves all local creature state |
| Life while away | ✅ | Up to 12 absence episodes preserve sleep, exploration, quiet time, and room activity for greetings, memories, and later chat |
| Touch boundaries | ✅ | Caution, independence, bond, and rapid-touch pressure decide when the creature accepts holding or asks for space |
| Role protection | ✅ | Server-side jailbreak detection, role lock, poisoned-history redaction, task blocking, and output validation keep DeepSeek inside the creature role |
| Version display | ✅ | Discreetly shown in Memory Book footer |

### 🚧 Partial / Placeholder

| Feature | State | Gap |
|---|---|---|
| Notifications | 🚧 | Architecture prepared but no push notification logic. |

### ❌ Not Yet Implemented

- Multi-creature comparison / sharing
- Automatic cloud sync
- Voiced creature vocalizations
- True time-based developmental milestones (currently uses interaction-driven progression)
- Music creation by creature
- Object discovery stages (e.g. paper → scribble → draw → write)
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

---

## 6. Known Remaining Issues

### Build / TypeScript
- **None currently.** Build passes cleanly (`npm run build` → 0 errors).

### Logic / UX
- **Sound is intentionally minimal:** Current cues are short interaction tones rather than voiced creature vocalizations.
- **Needs decay may feel too slow or too fast:** Tuned for 1-minute intervals. Real-world testing on mobile is needed.
- **Object drag on mobile:** Pointer events should work on most mobile browsers, but long-press vs drag detection could conflict with browser gestures on some devices.
- **Offline simulation is simple:** Does not model complex chained activities.

### Architecture
- **AI depends on the private gateway:** If the Worker or model provider is unavailable, the conversation automatically falls back to the smaller local mind.
- **Public gateway protection is best-effort:** Role attacks and task abuse are filtered and rate-limited, but a determined hostile client can spoof browser headers. Durable Cloudflare rate limiting or Turnstile remains a future hardening option.
- **Coverage is targeted, not comprehensive:** Life-path, hybrid, daily-choice, recovery, worker, and TypeScript smoke checks exist; older systems still need broader automated coverage.

---

## 7. Recommended Next Steps

### Priority: High
1. **Balance paths on real saves** — tune signal speed, hybrid frequency, chapter cadence, daily moments, and return greetings after multi-day mobile play.
2. **Conversation chapter quality** — enrich local summaries over time without sending full history or adding another model call.
3. **Object mastery** — extend the new creation arc to music, boxes, keepsakes, and collaborative play.

### Priority: Medium
4. **Physical-device polish pass** — verify vibration and long-press drag behaviour on actual iOS Safari and Android Chrome; responsive browser checks now pass.
5. **Durable abuse controls** — move best-effort in-memory rate limiting to Cloudflare-native rules/KV and evaluate a low-friction Turnstile challenge if public abuse appears.
6. **Expand automated coverage** — add unit tests for conversation parsing, social learning, age floors, and needs decay.

### Priority: Low / Future
7. **Voice conversation** — add optional speech input and age-appropriate creature vocal output.
8. **Optional encrypted sync** — only if a future account-free design can preserve the current local-first privacy model.
9. **Notifications** — gentle, non-manipulative PWA notifications.

---

## 8. Architecture Decisions

- **No visible stats, ever.** All creature state is communicated through body language, expressions, movement, sounds, and eventually language. This is a non-negotiable design principle.
- **Local-first.** All core systems run in the browser. AI is reserved only for higher-level cognition and the app works fully offline.
- **Deterministic personality.** Each creature has a persistent seed. Same seed = same starting temperament. Randomness after birth is constrained and feels like "one persistent individual."
- **Language constrains the LLM.** When an LLM is added, the speech generation pipeline must pass through a vocabulary whitelist and sentence-complexity gate.
- **The LLM is not a hidden assistant.** The Worker rejects role replacement and generic work-product requests before inference, redacts poisoned history, and validates output before returning it.
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
| How paths, hybrids, choices, recovery, and skins work | `src/systems/lifePathSystem.ts` |
| How interests, opinions, dreams, and secrets work | `src/systems/innerLifeSystem.ts` |
| How chapters, open loops, and later check-ins work | `src/systems/continuitySystem.ts` |
| How returns and shared rituals work | `src/systems/presenceSystem.ts` |
| How optional tones and haptics work | `src/systems/sensorySystem.ts` |
| How the two-language shell chooses copy | `src/systems/uiLanguage.ts` |
| How paper-and-pencil creations evolve | `src/systems/creationSystem.ts` |
| How the creature is drawn | `src/components/CreatureCanvas.tsx` |
| The main game loop / room | `src/components/Room.tsx` |
| Persistence | `src/systems/persistence.ts` |
| Offline time | `src/systems/offlineSimulation.ts` |
