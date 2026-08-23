import { ConversationLanguage, OpenConversationLoop, UserFactKind } from '../types';

export type SupportedUiLanguage = 'en' | 'pl';

export function detectUiLanguage(): SupportedUiLanguage {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('pl')) return 'pl';
  return 'en';
}

export function uiLanguage(language: ConversationLanguage): SupportedUiLanguage {
  return language === 'pl' ? 'pl' : language === 'en' ? 'en' : detectUiLanguage();
}

export function uiText(language: SupportedUiLanguage, english: string, polish: string): string {
  return language === 'pl' ? polish : english;
}

export function getFactKindLabel(kind: UserFactKind, language: SupportedUiLanguage): string {
  const labels: Record<UserFactKind, { en: string; pl: string }> = {
    name: { en: 'you', pl: 'ty' },
    like: { en: 'likes', pl: 'lubi' },
    dislike: { en: 'dislikes', pl: 'nie lubi' },
    feeling: { en: 'feeling', pl: 'samopoczucie' },
    goal: { en: 'goal', pl: 'cel' },
    place: { en: 'place', pl: 'miejsce' },
    work: { en: 'work', pl: 'praca' },
    other: { en: 'detail', pl: 'szczegół' },
  };
  return labels[kind][language];
}

export function getOpenLoopKindLabel(kind: OpenConversationLoop['kind'], language: SupportedUiLanguage): string {
  const labels: Record<OpenConversationLoop['kind'], { en: string; pl: string }> = {
    goal: { en: 'goal', pl: 'cel' },
    feeling: { en: 'feeling', pl: 'samopoczucie' },
    promise: { en: 'promise', pl: 'obietnica' },
    story: { en: 'story', pl: 'historia' },
  };
  return labels[kind][language];
}

const ACTION_LABELS: Record<string, { en: string; pl: string }> = {
  drink: { en: 'drink', pl: 'pije' },
  smoke: { en: 'smoke', pl: 'pali' },
  exercise: { en: 'exercise', pl: 'ćwiczy' },
  do: { en: 'do', pl: 'wykonuje' },
  play: { en: 'play', pl: 'gra' },
  overwork: { en: 'overwork', pl: 'przepracowuje się' },
  gamble: { en: 'gamble', pl: 'uprawia hazard' },
  meditate: { en: 'meditate', pl: 'medytuje' },
  get: { en: 'become', pl: 'staje się' },
  sleep: { en: 'sleep', pl: 'śpi' },
  'stay up': { en: 'stay up', pl: 'zarywa noc' },
  avoid: { en: 'avoid', pl: 'unika' },
  skip: { en: 'skip', pl: 'opuszcza' },
  help: { en: 'help', pl: 'pomaga' },
  'speak kindly': { en: 'speak kindly', pl: 'mówi życzliwie' },
  clean: { en: 'clean', pl: 'sprząta' },
  buy: { en: 'buy', pl: 'kupuje' },
  try: { en: 'try', pl: 'próbuje' },
  swear: { en: 'swear', pl: 'przeklina' },
  read: { en: 'read', pl: 'czyta' },
  'spend time with': { en: 'spend time with', pl: 'spędza czas z' },
  lie: { en: 'lie to', pl: 'okłamuje' },
  apologise: { en: 'apologise', pl: 'przeprasza' },
};

const TARGET_LABELS: Record<string, string> = {
  weed: 'marihuanę',
  cannabis: 'marihuanę',
  pot: 'marihuanę',
  blunt: 'blanta',
  joint: 'jointa',
  drunk: 'pijany',
  beer: 'piwo',
  wine: 'wino',
  alcohol: 'alkohol',
  game: 'grę',
  games: 'gry',
  someone: 'komuś',
  work: 'pracę',
  school: 'szkołę',
  class: 'zajęcia',
  meeting: 'spotkanie',
};

export function formatLearnedBehaviour(action: string, target: string, language: SupportedUiLanguage): string {
  const actionLabel = ACTION_LABELS[action]?.[language] ?? action.replace(/_/g, ' ');
  const targetLabel = language === 'pl' ? TARGET_LABELS[target.toLocaleLowerCase()] ?? target : target;
  return `${actionLabel}${targetLabel ? ` ${targetLabel}` : ''}`.trim();
}

function formatPolishBehaviourFragment(fragment: string): string {
  const normalized = fragment.trim();
  const actions = Object.keys(ACTION_LABELS).sort((a, b) => b.length - a.length);
  for (const action of actions) {
    const variants = [`${action}ing `, `${action}ed `, `${action}s `, `${action} `];
    const variant = variants.find(candidate => normalized.toLocaleLowerCase().startsWith(candidate));
    if (variant) return formatLearnedBehaviour(action, normalized.slice(variant.length), 'pl');
  }
  return normalized;
}

function polishCount(value: number, one: string, few: string, many: string): string {
  const lastTwo = value % 100;
  const last = value % 10;
  if (value === 1) return one;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

const STORED_MEMORY_TRANSLATIONS: Record<string, string> = {
  'A word became its own': 'Słowo stało się jego',
  'It came closer by itself': 'Samo podeszło bliżej',
  'A small no': 'Małe „nie”',
  'Something became a favorite': 'Coś stało się ulubione',
  'The first dream': 'Pierwszy sen',
  'The first deliberate mark': 'Pierwszy zamierzony ślad',
  'An opinion of its own': 'Własne zdanie',
  'A phrase became ours': 'Zdanie stało się nasze',
  'It recognized itself': 'Rozpoznało siebie',
  'It chose what to do': 'Samo wybrało, co zrobić',
};

export function formatStoredMemory(content: string, language: SupportedUiLanguage): string {
  if (language === 'en') return content;
  const translated = STORED_MEMORY_TRANSLATIONS[content.trim()];
  if (translated) return translated;
  let match = content.match(/^learned word [“"](.+)[”"]$/i);
  if (match) return `Nauczył się słowa „${match[1]}”.`;
  match = content.match(/^made [“"](.+)[”"] with paper and pencil$/i);
  if (match) return `Stworzył „${match[1]}” za pomocą papieru i ołówka.`;
  match = content.match(/^tried (.+), did not like it$/i);
  if (match) return `Spróbował: ${formatPolishBehaviourFragment(match[1])}, ale tego nie polubił.`;
  match = content.match(/^tried (.+), liked it$/i);
  if (match) return `Spróbował: ${formatPolishBehaviourFragment(match[1])} i to polubił.`;
  match = content.match(/^tried (.+)$/i);
  if (match) return `Spróbował: ${formatPolishBehaviourFragment(match[1])}.`;
  match = content.match(/^(?:user|player) was (?:gone|away) for (\d+) (minute|minutes|hour|hours|day|days)\.?$/i);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2].toLocaleLowerCase();
    const label = unit.startsWith('minute')
      ? polishCount(amount, 'minutę', 'minuty', 'minut')
      : unit.startsWith('hour')
        ? polishCount(amount, 'godzinę', 'godziny', 'godzin')
        : polishCount(amount, 'dzień', 'dni', 'dni');
    return `Nie było cię przez ${amount} ${label}.`;
  }
  match = content.match(/^the room had (\d+) quiet hours? of its own\.?$/i);
  if (match) {
    const amount = Number(match[1]);
    return `Pokój był cichy przez ${amount} ${polishCount(amount, 'godzinę', 'godziny', 'godzin')}.`;
  }
  match = content.match(/^user (?:once|sometimes|often|always) (.+)$/i);
  if (match) return `Gracz ${formatPolishBehaviourFragment(match[1])}.`;
  match = content.match(/^user (.+)$/i);
  if (match) return `Gracz ${formatPolishBehaviourFragment(match[1])}.`;
  if (/^dreamed:/i.test(content)) return content.replace(/^dreamed:/i, 'Śniło mu się:');
  return content;
}
