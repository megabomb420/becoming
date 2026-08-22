import React, { useEffect, useRef, useState } from 'react';
import { GameState } from '../types';
import {
  appendCreatureMessage,
  beginConversationTurn,
  getConversationOpening,
  getMindStatus,
} from '../systems/conversationSystem';
import { getDevelopmentDescription } from '../systems/developmentSystem';
import { isLlmAvailable, requestCreatureReply } from '../systems/llmConversation';

interface ChatInterfaceProps {
  state: GameState;
  onStateChange: (state: GameState | ((prev: GameState) => GameState)) => void;
  onClose: () => void;
  initialMessage?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ state, onStateChange, onClose, initialMessage }) => {
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [mindState, setMindState] = useState<'ready' | 'connecting' | 'online' | 'instinct'>('ready');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initRef = useRef(false);
  const mountedRef = useRef(true);
  const messages = state.conversation.messages;
  const isPolish = state.conversation.language === 'pl';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isThinking]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const opening = initialMessage || (messages.length === 0 ? getConversationOpening(state) : null);
    if (!opening) return;
    const timer = window.setTimeout(() => {
      onStateChange(prev => appendCreatureMessage(prev, opening));
    }, 450 + Math.random() * 350);
    return () => {
      window.clearTimeout(timer);
      // React StrictMode intentionally mounts effects twice in development.
      // Resetting the guard lets the committed mount schedule the greeting.
      initRef.current = false;
    };
  }, [initialMessage, onStateChange]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const userText = input.trim();
    const turn = beginConversationTurn(state, userText);
    setInput('');
    setIsThinking(true);
    setMindState('connecting');
    onStateChange(turn.state);
    try {
      const reply = await requestCreatureReply(turn.state);
      onStateChange(prev => appendCreatureMessage(prev, reply));
      if (mountedRef.current) setMindState('online');
    } catch (error) {
      console.warn('AI reply unavailable; using the creature\'s local instincts.', error);
      onStateChange(prev => appendCreatureMessage(prev, turn.reply));
      if (mountedRef.current) setMindState('instinct');
    } finally {
      if (mountedRef.current) setIsThinking(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const progress = Math.round((state.development.cognitiveLevel + state.development.languageLevel) / 2);
  const knownFacts = [...state.conversation.facts]
    .sort((a, b) => b.confidence - a.confidence || b.lastMentioned - a.lastMentioned)
    .slice(0, 3);

  return (
    <div className="absolute inset-0 bg-room-dark/98 backdrop-blur-xl z-50 flex flex-col safe-top safe-bottom safe-x animate-fade-in">
      <header className="px-4 pt-3 pb-3 border-b border-warm-200/10 bg-room-dark/80">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div
            className="relative w-11 h-11 rounded-full border border-warm-200/20 shadow-lg flex items-center justify-center shrink-0"
            style={{ background: `hsl(${state.identity.appearance.baseHue} 25% 45% / 0.75)` }}
            aria-hidden="true"
          >
            <div className="flex gap-1">
              <span className="w-1.5 h-2 rounded-full bg-room-dark/90" />
              <span className="w-1.5 h-2 rounded-full bg-room-dark/90" />
            </div>
            {isThinking && <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-warm-300 animate-pulse border-2 border-room-dark" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className="text-warm-100 text-base font-serif truncate">{state.identity.name || 'The creature'}</h1>
              <span className="text-warm-300/55 text-[10px] uppercase tracking-widest">growing</span>
            </div>
            <p className="text-warm-200/45 text-[11px] font-serif">
              {getMindStatus(state)} · {mindState === 'connecting' ? 'connecting mind…' : mindState === 'online' ? 'AI mind online' : mindState === 'instinct' ? 'local instinct' : isLlmAvailable() ? 'AI mind ready' : 'local instinct'}
            </p>
            <div className="h-0.5 mt-1.5 bg-room-mid rounded-full overflow-hidden max-w-48">
              <div className="h-full bg-warm-300/45 transition-all duration-700" style={{ width: `${Math.max(4, progress)}%` }} />
            </div>
          </div>
          <button aria-label="Close conversation" onClick={onClose} className="text-warm-200/55 hover:text-warm-100 text-sm px-2 py-2 transition-colors">
            Close
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12 max-w-sm mx-auto">
              <p className="text-warm-100/65 text-sm font-serif">{getDevelopmentDescription(state.development.stage)}</p>
              <p className="text-warm-200/30 text-xs font-serif italic mt-2">Every message becomes part of how it grows.</p>
            </div>
          )}

          {messages.map(message => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[84%] sm:max-w-[72%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                message.sender === 'user'
                  ? 'bg-warm-300/20 border border-warm-300/10 text-warm-100 rounded-br-md'
                  : 'bg-room-mid/85 border border-warm-200/5 text-warm-200 rounded-bl-md'
              }`}>
                <p className="font-serif whitespace-pre-wrap leading-relaxed">{message.text}</p>
                <p className="text-[9px] opacity-30 mt-1.5 text-right">
                  {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start" aria-label={`${state.identity.name || 'The creature'} is thinking`}>
              <div className="bg-room-mid/85 px-4 py-3 rounded-2xl rounded-bl-md border border-warm-200/5">
                <div className="flex gap-1">
                  {[0, 150, 300].map(delay => (
                    <span key={delay} className="w-1.5 h-1.5 rounded-full bg-warm-200/40 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="px-4 pt-3 pb-3 border-t border-warm-200/10 bg-room-dark/90 backdrop-blur-md">
        <div className="max-w-2xl mx-auto">
          {knownFacts.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2" aria-label="Things remembered about you">
              {knownFacts.map(fact => (
                <span key={fact.id} className="shrink-0 rounded-full bg-room-mid/70 border border-warm-200/10 px-2.5 py-1 text-[10px] text-warm-200/50 font-serif">
                  {fact.kind === 'name' ? 'you' : fact.kind}: {fact.value}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={event => setInput(event.target.value.slice(0, 500))}
              onKeyDown={handleKeyDown}
              placeholder={isPolish ? 'Powiedz coś — słucha i zapamiętuje...' : 'Say something — it listens and remembers...'}
              className="flex-1 min-h-11 max-h-28 resize-none bg-room-mid/55 border border-warm-200/10 rounded-xl px-4 py-3 text-warm-100 text-sm font-serif placeholder:text-warm-200/20 focus:outline-none focus:border-warm-300/35"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="h-11 px-4 bg-warm-300/20 border border-warm-300/15 text-warm-100 rounded-xl text-sm font-serif disabled:opacity-30 active:scale-95 transition-all"
            >
              Send
            </button>
          </div>
          <p className="text-warm-200/20 text-[9px] mt-2 text-center font-serif">
              {isPolish
                ? 'Pamięć zostaje na tym urządzeniu. Ostatnie wiadomości są wysyłane do AI przez Puter.'
                : 'Memory stays on this device. Recent messages are sent to AI through Puter.'}
            </p>
        </div>
      </footer>
    </div>
  );
};

export default ChatInterface;
