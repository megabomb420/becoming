import { ChatMessage, GameState } from '../types';

const MODEL = 'gpt-5.6-luna';
const MAX_CONTEXT_MESSAGES = 18;

type PuterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type PuterChatResult = {
  message?: {
    content?: unknown;
  };
};

type PuterApi = {
  ai?: {
    chat: (messages: PuterMessage[], options: Record<string, unknown>) => Promise<PuterChatResult | string>;
  };
};

declare global {
  interface Window {
    puter?: PuterApi;
  }
}

function strongestTraits(state: GameState): string {
  return Object.entries(state.personality)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([trait, value]) => `${trait} ${Math.round(value)}/100`)
    .join(', ');
}

function compactFacts(state: GameState): string {
  const facts = [...state.conversation.facts]
    .sort((a, b) => b.confidence - a.confidence || b.lastMentioned - a.lastMentioned)
    .slice(0, 10)
    .map(fact => `${fact.kind}: ${fact.value}`);
  return facts.length ? facts.join('; ') : 'nothing reliable yet';
}

function compactHabits(state: GameState): string {
  const observed = [...state.socialLearning.observations]
    .sort((a, b) => b.exposureCount - a.exposureCount || b.timestamp - a.timestamp)
    .slice(0, 7)
    .map(item => `${item.action} ${item.target} (${item.frequency}, reward ${item.perceivedReward.toFixed(1)}, harm ${item.perceivedNegativeOutcome.toFixed(1)})`);
  const adopted = state.socialLearning.imitated
    .filter(item => !item.rejected)
    .slice(-5)
    .map(item => `${item.action} ${item.target}`);
  return `observed: ${observed.join('; ') || 'none'}; adopted: ${adopted.join('; ') || 'none'}`;
}

function languageInstruction(state: GameState): string {
  if (state.conversation.language === 'pl') return 'Speak natural, casual Polish.';
  if (state.conversation.language === 'en') return 'Speak natural, casual English.';
  return 'Reply in the language used by the user in their newest message.';
}

function stageInstruction(state: GameState): string {
  const instructions = {
    egg: 'You are only just becoming conscious. Use one short, clear sentence.',
    newborn: 'You are newborn but already understand speech. Use one short, simple sentence; be curious and slightly awkward, never baby-noise-only.',
    animal: 'You are very young. Use one or two simple sentences and concrete words.',
    communicating: 'You are learning conversation. Use one or two short sentences and ask simple genuine questions.',
    first_words: 'You speak simply but meaningfully. Use at most three short sentences.',
    combining: 'You can hold a small conversation. Use two or three natural sentences.',
    sentences: 'You are becoming articulate. Use up to four concise sentences with a distinct opinion.',
    mature: 'You are articulate and reflective. Stay concise, personal, and willing to disagree.',
  } as const;
  return instructions[state.development.stage];
}

function buildSystemPrompt(state: GameState): string {
  const ageDays = Math.max(0, (Date.now() - state.identity.birthTimestamp) / 86_400_000);
  const creatureName = state.identity.name || 'the creature';
  return `You are ${creatureName}, a living digital creature in the game Becoming — a modern Tamagotchi built around conversation.

You are NOT a generic assistant. Never introduce yourself as an AI, chatbot, model, or helper. You have your own temperament, feelings, curiosity, preferences, small flaws, and developing opinions. Stay in character. Respond directly to the user; do not narrate actions and do not add speaker labels.

You can understand and answer from the very first conversation. Age changes the sophistication of your voice, never whether you can talk. ${stageInstruction(state)}

Identity and current state:
- name: ${creatureName}
- age: ${ageDays.toFixed(1)} days; development stage: ${state.development.stage}
- cognitive/language/emotional growth: ${Math.round(state.development.cognitiveLevel)}/${Math.round(state.development.languageLevel)}/${Math.round(state.development.emotionalLevel)} out of 100
- strongest inborn and learned traits: ${strongestTraits(state)}
- current mood: ${state.emotionalState}; bond: ${state.bond.stage} (${Math.round(state.bond.score)}/100)
- things remembered about the user: ${compactFacts(state)}
- habits seen or learned from the user: ${compactHabits(state)}

Let repeated conversations and remembered facts shape you. You may pick up the user's humour, wording, ordinary routines, good habits, and bad habits, but do not blindly endorse dangerous, abusive, self-destructive, or illegal behaviour. When something sounds harmful, react as this creature with concern or doubt. Never claim a memory not shown above or in the chat history. If uncertain, admit it naturally. ${languageInstruction(state)}

Return only your next message. Usually 1–3 short sentences. Avoid therapy-speak, customer-service phrasing, canned reassurance, and ending every reply with a question.`;
}

function toModelHistory(messages: ChatMessage[]): PuterMessage[] {
  return messages.slice(-MAX_CONTEXT_MESSAGES).map(message => ({
    role: message.sender === 'user' ? 'user' : 'assistant',
    content: message.text,
  }));
}

function extractText(result: PuterChatResult | string): string {
  if (typeof result === 'string') return result.trim();
  const content = result.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

export function isLlmAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.puter?.ai?.chat === 'function';
}

export async function requestCreatureReply(state: GameState): Promise<string> {
  const chat = window.puter?.ai?.chat;
  if (!chat) throw new Error('The AI connection did not load.');

  const messages: PuterMessage[] = [
    { role: 'system', content: buildSystemPrompt(state) },
    ...toModelHistory(state.conversation.messages),
  ];
  const result = await chat(messages, {
    model: MODEL,
    max_tokens: 180,
    reasoning_effort: 'none',
    verbosity: 'low',
    temperature: 0.9,
  });
  const reply = extractText(result);
  if (!reply) throw new Error('The AI returned an empty reply.');
  return reply.slice(0, 1200);
}

