import { GameState } from '../types';

// A mature mind says what it is about to do with its own body. These are
// locally authored one-liners, not mind speech: they never touch DeepSeek,
// never enter conversation history, and never run while the creature sleeps.
// English is the canonical copy; Polish is the bundled translation.

export type SelfCareKind = 'pee' | 'poop' | 'wash' | 'eat' | 'drink' | 'sleep';

type SelfCareTone = 'blunt' | 'plain' | 'soft';

interface SelfCareLine {
  en: string;
  pl: string;
}

const SELF_CARE_LINES: Record<SelfCareKind, Record<SelfCareTone, SelfCareLine[]>> = {
  pee: {
    blunt: [
      { en: 'Gotta take a piss.', pl: 'Muszę się odlać.' },
      { en: 'Back in a sec — piss break.', pl: 'Zaraz wracam — siku.' },
    ],
    plain: [
      { en: 'Gonna pee.', pl: 'Idę siusiu.' },
      { en: 'Quick pee, be right back.', pl: 'Szybkie siusiu, zaraz wracam.' },
    ],
    soft: [
      { en: 'Excuse me, just a quick bathroom trip.', pl: 'Przepraszam na chwilę, muszę do kąta.' },
      { en: 'One moment — nature calls.', pl: 'Chwileczkę — natura woła.' },
    ],
  },
  poop: {
    blunt: [
      { en: 'Gonna take a shit.', pl: 'Idę się wysrać.' },
      { en: 'Big business. Do not wait up.', pl: 'Wielkie sprawy. Nie czekaj na mnie.' },
    ],
    plain: [
      { en: 'Gotta poop.', pl: 'Idę kupę.' },
      { en: 'Off to poop, brb.', pl: 'Idę kupę, zaraz wracam.' },
    ],
    soft: [
      { en: 'I need the quiet corner for a minute.', pl: 'Potrzebuję na chwilę spokojnego kąta.' },
      { en: 'Give me a little privacy, please.', pl: 'Daj mi chwilę prywatności, proszę.' },
    ],
  },
  wash: {
    blunt: [
      { en: 'I stink. Bath time.', pl: 'Śmierdzę. Idę się umyć.' },
      { en: 'This fur needs water, now.', pl: 'To futro potrzebuje wody, teraz.' },
    ],
    plain: [
      { en: 'Getting washed.', pl: 'Idę się umyć.' },
      { en: 'Quick wash, back soon.', pl: 'Szybkie mycie, niedługo wracam.' },
    ],
    soft: [
      { en: 'A little warm water will do me good.', pl: 'Trochę ciepłej wody mi zrobi dobrze.' },
      { en: 'Time to get clean, gently.', pl: 'Pora się umyć, spokojnie.' },
    ],
  },
  eat: {
    blunt: [
      { en: 'Food. Now.', pl: 'Jedzenie. Teraz.' },
      { en: 'I am eating this, end of story.', pl: 'Jem to, koniec tematu.' },
    ],
    plain: [
      { en: 'Getting a snack.', pl: 'Idę coś zjeść.' },
      { en: 'Hungry — grabbing a bite.', pl: 'Głodno mi — coś przekąszę.' },
    ],
    soft: [
      { en: 'A small bite would be lovely.', pl: 'Mały kęs będzie miły.' },
      { en: 'I will eat a little, if that is fine.', pl: 'Zjem trochę, jeśli wolno.' },
    ],
  },
  drink: {
    blunt: [
      { en: 'Need water, bad.', pl: 'Muszę się napić, i to mocno.' },
      { en: 'Water first, everything else later.', pl: 'Najpierw woda, reszta później.' },
    ],
    plain: [
      { en: 'Getting a drink.', pl: 'Idę się napić.' },
      { en: 'Thirsty — water break.', pl: 'Chce mi się pić — przerwa na wodę.' },
    ],
    soft: [
      { en: 'Just a small sip of water.', pl: 'Tylko mały łyk wody.' },
      { en: 'I will have a little water.', pl: 'Napiję się trochę wody.' },
    ],
  },
  sleep: {
    blunt: [
      { en: 'I am crashing. Night.', pl: 'Idę się wyłączyć. Nocka.' },
      { en: 'Done for today. Shutting down.', pl: 'Na dziś koniec. Wyłączam się.' },
    ],
    plain: [
      { en: 'Turning in.', pl: 'Idę spać.' },
      { en: 'Sleep time for me.', pl: 'Pora na mój sen.' },
    ],
    soft: [
      { en: 'Time for me to rest. Goodnight.', pl: 'Pora na mój odpoczynek. Dobranoc.' },
      { en: 'I will curl up for a while. Sleep well.', pl: 'Zwinę się na chwilę. Śpij dobrze.' },
    ],
  },
};

const KIND_ORDER: SelfCareKind[] = ['pee', 'poop', 'wash', 'eat', 'drink', 'sleep'];

function pickTone(state: GameState): SelfCareTone {
  const path = state.lifePath.primary;
  if (path === 'degen' || path === 'stoner' || path === 'gamer' || path === 'rebel' || path === 'party_animal' || path === 'alcoholic') {
    return 'blunt';
  }
  if (path === 'monk' || path === 'caretaker') return 'soft';
  const personality = state.personality;
  if (personality.impulsiveness >= 62 || personality.confidence >= 70) return 'blunt';
  if (personality.calmness >= 62 || personality.affection >= 70) return 'soft';
  return 'plain';
}

// Only a mature mind narrates its own body. Younger creatures still act —
// they just do not have the words yet.
export function getSelfCareLine(state: GameState, kind: SelfCareKind, now: number): string | null {
  if (state.development.stage !== 'mature') return null;
  if (state.sleepState === 'sleeping') return null;
  const tone = pickTone(state);
  const variants = SELF_CARE_LINES[kind][tone];
  const index = (Math.floor(now / 60_000) + KIND_ORDER.indexOf(kind)) % variants.length;
  const line = variants[index];
  return state.conversation.language === 'pl' ? line.pl : line.en;
}
