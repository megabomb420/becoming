import React, { useState, useRef, useEffect } from 'react';
import { GameState, ChatMessage } from '../types';
import { generateCreatureSpeech, shouldSpeak } from '../systems/languageSystem';
import { recordObservation, generateSocialSpeech, shouldSpeakSocially } from '../systems/socialLearningSystem';
import { updateDevelopment, learnWord } from '../systems/developmentSystem';
import { recordBondEvent } from '../systems/relationshipSystem';

interface ChatInterfaceProps {
  state: GameState;
  onStateChange: (state: GameState | ((prev: GameState) => GameState)) => void;
  onClose: () => void;
  initialMessage?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ state, onStateChange, onClose, initialMessage }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (initialMessage && !initRef.current) {
      initRef.current = true;
      const delay = 600 + Math.random() * 800;
      setTimeout(() => {
        const creatureMsg: ChatMessage = {
          id: `msg-${Date.now()}-creature-init`,
          sender: 'creature',
          text: initialMessage,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, creatureMsg]);
      }, delay);
    }
  }, [initialMessage]);

  const generateResponse = (userText: string): string => {
    const { development, vocabulary, socialLearning } = state;
    if (development.stage === 'egg' || development.stage === 'newborn') {
      const sounds = ['mip', 'naa', 'ka', 'brr'];
      return sounds[Math.floor(Math.random() * sounds.length)];
    }
    if (development.stage === 'animal') {
      if (Math.random() < 0.3) {
        return generateSocialSpeech(state, { aboutUser: true, askingWhy: false, expressingOpinion: false }) || 'mip';
      }
      return 'mip';
    }
    if (shouldSpeakSocially(state)) {
      const social = generateSocialSpeech(state, {
        aboutUser: true,
        askingWhy: development.languageLevel > 30,
        expressingOpinion: development.languageLevel > 40,
      });
      if (social) return social;
    }
    const stage = development.stage;
    const words = vocabulary.map(v => v.word);
    const hasObservations = socialLearning.observations.length > 0;
    if (stage === 'communicating') {
      if (hasObservations && Math.random() < 0.3) {
        const obs = socialLearning.observations[0];
        return `${obs.target}?`;
      }
      const available = words.length > 0 ? words : ['you', 'food', 'no', 'more'];
      return available[Math.floor(Math.random() * available.length)];
    }
    if (stage === 'first_words') {
      if (hasObservations && Math.random() < 0.25) {
        const obs = socialLearning.observations[Math.floor(Math.random() * socialLearning.observations.length)];
        const templates = [`you ${obs.action} ${obs.target}`, `${obs.target}?`, `why ${obs.action}?`];
        return templates[Math.floor(Math.random() * templates.length)];
      }
      const w = words.length > 0 ? words : ['you', 'food', 'no', 'more', 'sleep'];
      return w[Math.floor(Math.random() * w.length)];
    }
    if (stage === 'combining') {
      if (hasObservations && Math.random() < 0.35) {
        const obs = socialLearning.observations[Math.floor(Math.random() * socialLearning.observations.length)];
        const templates = [
          `you always ${obs.action} ${obs.target}`,
          `why you ${obs.action} ${obs.target}?`,
          `you like ${obs.target}?`,
          `${obs.target} again?`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      }
      if (words.length < 2) return words[0] || 'mip';
      const templates = [
        `${words[Math.floor(Math.random() * words.length)]}?`,
        `more ${words[Math.floor(Math.random() * words.length)]}`,
        `no ${words[Math.floor(Math.random() * words.length)]}`,
        `${words[Math.floor(Math.random() * words.length)]} ${words[Math.floor(Math.random() * words.length)]}`,
      ];
      return templates[Math.floor(Math.random() * templates.length)];
    }
    if (stage === 'sentences' || stage === 'mature') {
      if (hasObservations && Math.random() < 0.4) {
        const obs = socialLearning.observations[Math.floor(Math.random() * socialLearning.observations.length)];
        const templates = [
          `why do you ${obs.action} ${obs.target}?`,
          `you said ${obs.target} helps`,
          `I noticed you ${obs.action} ${obs.target}`,
          `is ${obs.target} good?`,
          `you always ${obs.action} ${obs.target}`,
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      }
      const complexTemplates = [
        `where you go?`, `don't want that`, `give back`, `why you leave?`,
        `you usually come now`, `I made something`, `do you like it?`, `what is that?`, `tell me`,
      ];
      return complexTemplates[Math.floor(Math.random() * complexTemplates.length)];
    }
    return 'mip';
  };

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    const userText = input.trim();
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: userText,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);
    onStateChange(prevState => {
      let updated = recordObservation(prevState, userText);
      updated = updateDevelopment(updated, 2);
      const userWords = userText.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      for (const word of userWords.slice(0, 3)) {
        if (Math.random() < 0.1) {
          updated = learnWord(updated, word, 'chat');
        }
      }
      return recordBondEvent(updated, 'conversation');
    });
    const thinkDelay = 800 + Math.random() * 1500;
    setTimeout(() => {
      const response = generateResponse(userText);
      const creatureMsg: ChatMessage = {
        id: `msg-${Date.now()}-creature`,
        sender: 'creature',
        text: response,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, creatureMsg]);
      setIsThinking(false);
    }, thinkDelay);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="absolute inset-0 bg-room-dark/98 backdrop-blur-lg z-50 flex flex-col safe-top safe-bottom safe-x animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-warm-300/50 animate-pulse" />
          <span className="text-warm-100 text-sm font-serif">{state.identity.name || 'The creature'}</span>
        </div>
        <button onClick={onClose} className="text-warm-200/50 hover:text-warm-100 text-sm transition-colors">Close</button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-warm-200/30 text-xs font-serif italic">
              {state.development.stage === 'egg' || state.development.stage === 'newborn'
                ? 'The creature cannot speak yet...'
                : state.development.stage === 'animal'
                ? 'The creature makes sounds but does not understand words...'
                : 'Talk to the creature. It is listening.'}
            </p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
              msg.sender === 'user' ? 'bg-warm-300/20 text-warm-100 rounded-br-md' : 'bg-room-mid text-warm-200 rounded-bl-md'
            }`}>
              <p className="font-serif">{msg.text}</p>
              <p className="text-[10px] opacity-40 mt-1 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-room-mid px-4 py-2.5 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-warm-200/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-warm-200/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-warm-200/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="px-4 py-3 border-t border-warm-200/10">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              state.development.stage === 'egg' || state.development.stage === 'newborn'
                ? 'The creature cannot understand yet...'
                : 'Say something...'
            }
            className="flex-1 bg-room-mid/50 border border-warm-200/10 rounded-xl px-4 py-2.5 text-warm-100 text-sm font-serif placeholder:text-warm-200/20 focus:outline-none focus:border-warm-300/30"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="px-4 py-2.5 bg-warm-300/15 text-warm-100 rounded-xl text-sm font-serif disabled:opacity-30 active:scale-95 transition-transform"
          >
            Send
          </button>
        </div>
        <p className="text-warm-200/20 text-[10px] mt-2 text-center font-serif">
          The creature learns from what you say. It does not understand everything.
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
