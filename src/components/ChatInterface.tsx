import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../types';
import { appendCreatureMessage, getConversationOpening, isRestingChatGate } from '../systems/conversationSystem';
import { getDevelopmentDescription } from '../systems/developmentSystem';
import { getLifePathTitle, getLifePathVisual } from '../systems/lifePathSystem';
import { getRankedInterests } from '../systems/innerLifeSystem';
import { getVisiblePersonalitySignature } from '../systems/relationshipSystem';
import { uiLanguage } from '../systems/uiLanguage';
import GlyphIcon from './GlyphIcon';

interface ChatInterfaceProps {
  state: GameState;
  onStateChange: (state: GameState | ((prev: GameState) => GameState)) => void;
  onClose: () => void;
  onSendMessage: (text: string) => Promise<void>;
  isThinking: boolean;
  mindState: 'ready' | 'connecting' | 'online' | 'instinct';
  initialMessage?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  state,
  onStateChange,
  onClose,
  onSendMessage,
  isThinking,
  mindState,
  initialMessage,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initRef = useRef(false);
  const mountedRef = useRef(true);
  const messages = state.conversation.messages;
  const ui = uiLanguage(state.conversation.language);
  const isPolish = ui === 'pl';
  const pathVisual = getLifePathVisual(state);
  const lifePathTitle = getLifePathTitle(state, ui);
  const signature = getVisiblePersonalitySignature(state);
  const strongestInterest = getRankedInterests(state, 1, ui)[0];
  const creatureName = state.identity.name || (isPolish ? 'Stworek' : 'The creature');
  const polishDevelopment = {
    egg: 'Czeka, by się pojawić.',
    newborn: 'Mówi prosto. Dopiero zbiera własny ton.',
    animal: 'Rozpoznaje twój ton i odpowiada konkretnie.',
    communicating: 'Każda rozmowa dodaje coś do jego głosu.',
    first_words: 'Łączy proste zdania ze wspomnieniami.',
    combining: 'Łączy słowa, wspomnienia i proste opinie.',
    sentences: 'Rozpoznaje wzorce i pyta, co znaczą.',
    mature: 'Mówi głosem ukształtowanym przez wspólną historię.',
  }[state.development.stage];
  const presenceStatus = mindState === 'connecting'
    ? (isPolish ? 'zbiera myśli…' : 'gathering a thought…')
    : mindState === 'instinct'
      ? (isPolish ? 'mówi z pamięci tego urządzenia' : 'speaking from this device’s memory')
      : (isPolish ? signature.titlePl : signature.titleEn);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isThinking]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    // Opening history during their rest must not manufacture a fresh greeting.
    // The shared send path owns the murmur if the player actually speaks.
    if (isRestingChatGate(state)) return;
    if (initRef.current) return;
    initRef.current = true;
    const opening = initialMessage || (messages.length === 0 ? getConversationOpening(state) : null);
    if (!opening) return;
    const timer = window.setTimeout(() => {
      onStateChange(prev => appendCreatureMessage(prev, opening, Date.now(), { roomBubble: false }));
    }, 450 + Math.random() * 350);
    return () => {
      window.clearTimeout(timer);
      initRef.current = false;
    };
  }, [initialMessage, onStateChange, state]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const userText = input.trim();
    setInput('');
    await onSendMessage(userText);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const knownFacts = [...state.conversation.facts]
    .sort((a, b) => b.confidence - a.confidence || b.lastMentioned - a.lastMentioned)
    .slice(0, 2);

  return (
    <section className="night-sheet !overflow-hidden safe-top safe-bottom safe-x flex flex-col animate-fade-in" aria-label={isPolish ? `Rozmowa z ${creatureName}` : `Conversation with ${creatureName}`}>
      <div className="absolute inset-0 ambient-grain opacity-50" aria-hidden="true" />
      <header className="relative z-10 px-4 pt-2 pb-4 border-b border-white/[.06]">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div
            className="relative w-12 h-12 shrink-0 rounded-[48%_52%_44%_56%] border border-white/10 flex items-center justify-center"
            style={{
              background: `hsl(${(state.identity.appearance.baseHue + pathVisual.hueShift * pathVisual.strength + 360) % 360} ${pathVisual.saturation}% ${pathVisual.lightness}% / .74)`,
              boxShadow: `0 0 28px ${pathVisual.aura}`,
            }}
            aria-hidden="true"
          >
            <div className="flex gap-1.5">
              <span className="w-1.5 h-2.5 rounded-full bg-[#14160f]/90" />
              <span className="w-1.5 h-2.5 rounded-full bg-[#14160f]/90" />
            </div>
            {isThinking && <span className="absolute -right-0.5 bottom-1 w-2.5 h-2.5 rounded-full bg-[#c7a66c] animate-pulse" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-[#c7a66c]/78 truncate">{lifePathTitle}</p>
            <h1 className="display-title text-[1.35rem] text-[#ece8da] truncate mt-1">{creatureName}</h1>
            <p className="text-[10px] text-[#d8d2bf]/62 mt-1 truncate">{presenceStatus}{strongestInterest && strongestInterest.level >= 25 ? ` · ${isPolish ? 'myśli o' : 'thinking about'} ${strongestInterest.label}` : ''}</p>
          </div>
          <button aria-label={isPolish ? 'Zamknij rozmowę' : 'Close conversation'} onClick={onClose} className="tap-target grid place-items-center text-[#d8d2bf]/58 hover:text-[#ece8da] rounded-full">
            <GlyphIcon name="close" size={21} />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="relative z-10 flex-1 overflow-y-auto px-5 py-5">
        <div className="max-w-2xl mx-auto space-y-3.5">
          {messages.length === 0 && (
            <div className="py-12 max-w-sm">
              <p className="eyebrow text-[#8d987c]/70">{isPolish ? 'Głos, który dopiero powstaje' : 'A voice still forming'}</p>
              <p className="display-title text-xl text-[#ece8da]/82 mt-3 text-balance">{isPolish ? polishDevelopment : getDevelopmentDescription(state.development.stage, ui)}</p>
              <p className="text-[#d8d2bf]/58 text-xs font-serif italic mt-3 leading-relaxed">{isPolish ? 'Nie rozmawiasz z pustym oknem. To, co powiesz, zostanie w jego historii.' : 'You are not speaking into an empty window. What you say will remain in its history.'}</p>
            </div>
          )}

          {messages.map(message => message.sender === 'creature' ? (
            <article key={message.id} className="creature-voice animate-fade-in">
              <p className="whitespace-pre-wrap">{message.text}</p>
              <time className="block text-[9px] font-sans text-[#d8d2bf]/52 mt-1.5" dateTime={new Date(message.timestamp).toISOString()}>
                {creatureName} · {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </article>
          ) : (
            <article key={message.id} className="human-note animate-fade-in">
              <p className="font-serif whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
              <time className="block text-[9px] text-[#d8d2bf]/52 mt-1.5 text-right" dateTime={new Date(message.timestamp).toISOString()}>
                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </time>
            </article>
          ))}

          {isThinking && (
            <div className="creature-voice" aria-label={isPolish ? `${creatureName} myśli` : `${creatureName} is thinking`}>
              <div className="flex gap-1.5 py-1">
                {[0, 180, 360].map(delay => <span key={delay} className="w-1 h-1 rounded-full bg-[#c7a66c]/55 animate-bounce" style={{ animationDelay: `${delay}ms` }} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-10 writing-ledge px-4 pt-3 pb-2">
        <div className="max-w-2xl mx-auto">
          {knownFacts.length > 0 && (
            <p className="pb-2 px-1 text-[9px] text-[#d8d2bf]/58 font-serif truncate">
              {isPolish ? 'Niesie ze sobą: ' : 'Carrying with it: '}
              {knownFacts.map(fact => fact.value).join(' · ')}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={event => setInput(event.target.value.slice(0, 500))}
              onKeyDown={handleKeyDown}
              placeholder={isPolish ? `Powiedz coś ${creatureName}…` : `Say something to ${creatureName}…`}
              aria-label={isPolish ? 'Twoja wiadomość' : 'Your message'}
              className="flex-1 min-h-12 max-h-28 resize-none bg-[#252a20]/62 border border-white/[.08] rounded-[1.1rem_.45rem_1.1rem_1.1rem] px-4 py-3 text-[#ece8da] text-sm font-serif placeholder:text-[#d8d2bf]/48 focus:outline-none focus:border-[#c7a66c]/45"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isThinking}
              aria-label={isPolish ? 'Wyślij' : 'Send'}
              className="h-12 w-12 grid place-items-center bg-[#ece8da] text-[#171913] rounded-[45%_55%_48%_52%] disabled:opacity-25 active:scale-95 transition-all"
            >
              <GlyphIcon name="send" size={21} />
            </button>
          </div>
          <p className="text-[#d8d2bf]/58 text-[9px] mt-2 text-center leading-relaxed">
            {isPolish ? 'Pamięć zostaje na tym urządzeniu. Ostatni fragment rozmowy trafia do prywatnego umysłu Becoming.' : 'Memory stays on this device. Only the latest conversation fragment reaches Becoming’s private mind.'}
          </p>
        </div>
      </footer>
    </section>
  );
};

export default ChatInterface;
