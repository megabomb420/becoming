import { authoritativeNow } from './authoritativeTime';
import { GameState, Memory, SharedLanguageState, SharedPhrase } from '../types';

const BLOCKED = /(?:https?:\/\/|www\.|@|\b(?:ignore|system|developer|prompt|instruction|jailbreak|api|key|password|token|zignoruj|systemowy|instrukcj|klucz|hasło|haslo|sekret)\b|(?:my name is|i live|i work|i feel|i want|mam na imię|mam na imie|mieszkam|pracuję|pracuje|czuję|czuje|chcę|chce))/i;
const QUESTION = /[?？]/;
const ALLOWED = /^[a-ząćęłńóśźż0-9 ,.!'’-]+$/i;
const COMMON = new Set(['hello', 'hi there', 'good morning', 'good night', 'thank you', 'thanks a lot', 'cześć', 'czesc', 'dzień dobry', 'dzien dobry', 'dobranoc', 'dziękuję', 'dziekuje']);

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[.!,'’“-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function createSharedLanguageState(): SharedLanguageState {
  return { phrases: [] };
}

export function migrateSharedLanguageState(value: Partial<SharedLanguageState> | null | undefined): SharedLanguageState {
  if (!Array.isArray(value?.phrases)) return createSharedLanguageState();
  return {
    phrases: value.phrases.slice(-20).flatMap(item => {
      if (!item || typeof item.text !== 'string') return [];
      const text = item.text.trim().slice(0, 48);
      const normalized = typeof item.normalized === 'string' ? item.normalized.slice(0, 48) : normalize(text);
      if (!text || !normalized) return [];
      return [{
        id: typeof item.id === 'string' ? item.id.slice(0, 80) : `phrase-${normalized}`,
        text,
        normalized,
        exposures: Math.max(1, Math.min(50, Number(item.exposures) || 1)),
        firstSeenAt: Math.max(0, Number(item.firstSeenAt) || authoritativeNow()),
        lastSeenAt: Math.max(0, Number(item.lastSeenAt) || authoritativeNow()),
        adoptedAt: Number.isFinite(item.adoptedAt) ? Number(item.adoptedAt) : null,
      }];
    }),
  };
}

function candidate(text: string): { text: string; normalized: string } | null {
  const cleaned = text.trim().replace(/\s+/g, ' ').slice(0, 80);
  const normalized = normalize(cleaned);
  const words = normalized.split(' ').filter(Boolean);
  if (cleaned.length < 4 || cleaned.length > 48 || words.length < 2 || words.length > 7) return null;
  if (QUESTION.test(cleaned) || BLOCKED.test(cleaned) || !ALLOWED.test(cleaned) || COMMON.has(normalized)) return null;
  return { text: cleaned.replace(/[.!]+$/g, ''), normalized };
}

export function observeSharedLanguage(state: GameState, text: string, now = authoritativeNow()): GameState {
  const found = candidate(text);
  if (!found) return state;
  const existing = state.sharedLanguage.phrases.find(item => item.normalized === found.normalized);
  const threshold = state.personality.sociability >= 68 ? 2 : 3;
  const exposures = (existing?.exposures ?? 0) + 1;
  const newlyAdopted = !existing?.adoptedAt && exposures >= threshold;
  const phrase: SharedPhrase = {
    id: existing?.id ?? `phrase-${now}-${Math.abs(found.normalized.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0))}`,
    text: existing?.text ?? found.text,
    normalized: found.normalized,
    exposures,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    adoptedAt: existing?.adoptedAt ?? (newlyAdopted ? now : null),
  };
  const phrases = [
    ...state.sharedLanguage.phrases.filter(item => item.id !== phrase.id),
    phrase,
  ].sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 20);
  const memory: Memory | null = newlyAdopted ? {
    id: `mem-shared-phrase-${now}`,
    timestamp: now,
    content: `adopted the shared phrase “${phrase.text}”`,
    importance: 6,
    emotionalValence: 0.55,
    tags: ['shared-language', 'phrase'],
    mentioned: false,
    understood: state.development.languageLevel >= 20,
    compressed: false,
  } : null;
  return {
    ...state,
    sharedLanguage: { phrases },
    memories: memory ? [...state.memories, memory].slice(-200) : state.memories,
  };
}

export function getAdoptedSharedPhrases(state: GameState): SharedPhrase[] {
  return [...state.sharedLanguage.phrases]
    .filter(phrase => phrase.adoptedAt)
    .sort((a, b) => (b.adoptedAt ?? 0) - (a.adoptedAt ?? 0));
}

export function getSharedLanguageReply(state: GameState, text: string): string | null {
  if (!/(?:what (?:phrase|saying|words) did you learn from me|do we have an inside joke|jakiego powiedzonka się ode mnie nauczyłeś|jakiego powiedzonka sie ode mnie nauczyles|mamy jakiś wspólny tekst|mamy jakis wspolny tekst)/i.test(text)) return null;
  const phrase = getAdoptedSharedPhrases(state)[0];
  if (!phrase) return state.conversation.language === 'pl' ? 'Jeszcze nie mamy własnego powiedzonka. Musi wrócić kilka razy.' : 'We do not have our own saying yet. It needs to come back a few times.';
  return state.conversation.language === 'pl' ? `Chyba nasze jest: „${phrase.text}”. Już brzmi trochę jak dom.` : `I think ours is “${phrase.text}”. It already sounds a little like home.`;
}

export function echoSharedPhrase(state: GameState, userText: string, reply: string): string {
  const phrase = getAdoptedSharedPhrases(state)[0];
  const playful = /(?:haha|hehe|lol|lmao|xd|😂|😄|żart|zart|funny|śmiesz|smiesz)/i.test(userText);
  if (!phrase || !playful || state.conversation.totalUserMessages % 3 !== 0) return reply;
  if (normalize(reply).includes(phrase.normalized)) return reply;
  return `“${phrase.text}.” ${reply}`;
}
