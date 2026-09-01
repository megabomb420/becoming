import React, { useEffect, useMemo, useRef, useState } from 'react';
import { detectUiLanguage, uiText } from '../systems/uiLanguage';

interface EggHatchingProps {
  onHatch: () => void;
  onNameChosen: (name: string) => Promise<void>;
}

const EggHatching: React.FC<EggHatchingProps> = ({ onHatch, onNameChosen }) => {
  const [stage, setStage] = useState<'egg' | 'wobbling' | 'cracking' | 'hatched' | 'naming'>('egg');
  const [tapCount, setTapCount] = useState(0);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const submittedRef = useRef(false);
  const ui = useMemo(() => detectUiLanguage(), []);
  const t = (english: string, polish: string) => uiText(ui, english, polish);

  const motes = useMemo(() => Array.from({ length: 12 }).map((_, index) => ({
    id: index,
    size: 1 + Math.random() * 2.5,
    left: 10 + Math.random() * 80,
    top: 8 + Math.random() * 76,
    duration: 6 + Math.random() * 7,
    delay: Math.random() * 4,
  })), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (stage === 'egg') setStage('wobbling');
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const handleTap = () => {
    if (stage === 'egg') {
      setTapCount(previous => {
        const next = previous + 1;
        if (next >= 3) setStage('wobbling');
        return next;
      });
    } else if (stage === 'wobbling') {
      setTapCount(previous => {
        const next = previous + 1;
        if (next >= 6) setStage('cracking');
        return next;
      });
    } else if (stage === 'cracking') {
      setStage('hatched');
      window.setTimeout(() => setStage('naming'), 1900);
    }
  };

  const handleSubmitName = async () => {
    if (submittedRef.current) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    submittedRef.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      await onNameChosen(trimmed);
      onHatch();
    } catch (error) {
      console.warn('Becoming could not persist the newly hatched creature.', error);
      submittedRef.current = false;
      setSaveError(true);
      setSaving(false);
    }
  };

  const hint = stage === 'egg'
    ? t('Touch the shell', 'Dotknij skorupy')
    : stage === 'wobbling'
      ? t('Something is answering', 'Coś odpowiada')
      : t('One more touch', 'Jeszcze jeden dotyk');

  return (
    <main className="terrarium-shell flex h-full flex-col items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0" aria-hidden="true" style={{ background: 'radial-gradient(ellipse at 50% 43%, rgba(157,150,116,.2), transparent 25%), radial-gradient(ellipse at 50% 100%, rgba(74,84,61,.2), transparent 46%)' }} />
      <div className="absolute inset-0 ambient-grain" aria-hidden="true" />
      <div className="absolute inset-0 opacity-35 pointer-events-none" aria-hidden="true">
        {motes.map(mote => (
          <span
            key={mote.id}
            className="absolute rounded-full bg-[#d8d2bf]"
            style={{ width: mote.size, height: mote.size, left: `${mote.left}%`, top: `${mote.top}%`, animation: `float ${mote.duration}s ease-in-out infinite`, animationDelay: `${mote.delay}s` }}
          />
        ))}
      </div>

      {stage !== 'naming' ? (
        <div className="relative z-10 flex flex-col items-center">
          <p className="eyebrow text-[#8d987c]/70 mb-10">{t('Before a voice', 'Przed pierwszym głosem')}</p>
          <button
            type="button"
            aria-label={stage === 'cracking' ? t('Finish hatching', 'Dokończ wykluwanie') : t('Touch the egg to hatch', 'Dotknij jajka, aby je wykluć')}
            className="relative cursor-pointer select-none bg-transparent border-0 p-5 rounded-full"
            onClick={handleTap}
          >
            <span className={`absolute inset-[-48px] rounded-full transition-all duration-1000 ${stage === 'wobbling' ? 'animate-pulse' : ''}`} style={{ background: 'radial-gradient(circle, rgba(220,208,188,.34), rgba(200,180,150,.12) 42%, transparent 72%)' }} />
            {stage === 'hatched' ? (
              <span className="relative block w-28 h-36 animate-fade-in" aria-hidden="true">
                <span className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(236,232,218,.9), rgba(199,166,108,.25) 36%, transparent 70%)' }} />
                <svg className="absolute inset-0 w-full h-full text-[#ece8da]/70" viewBox="0 0 112 144" fill="none">
                  <path d="M56 103c-18-15-22-34-7-54 11 9 18 20 20 33 1 9-4 16-13 21Z" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M56 103c-1-16-1-31-7-54" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </span>
            ) : (
              <span className={`relative block transition-transform duration-700 ${stage === 'wobbling' ? 'animate-breathe' : ''} ${stage === 'cracking' ? 'scale-105' : ''}`} aria-hidden="true">
                <span className="block w-24 h-32 rounded-[51%_49%_45%_55%] border border-white/10" style={{ background: 'radial-gradient(ellipse at 32% 26%, #efe6d4, #d3c5ad 55%, #9b8a71)', boxShadow: '0 24px 55px rgba(0,0,0,.42), inset -8px -14px 26px rgba(42,40,33,.24)' }} />
                {stage === 'cracking' && (
                  <svg className="absolute inset-0 w-24 h-32 text-[#3a3b32]" viewBox="0 0 96 128" fill="none">
                    <path d="M45 34 51 50l-9 12 11 13-8 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            )}
          </button>
          {stage !== 'hatched' && (
            <div className="mt-7 text-center animate-fade-in">
              <p className="display-title text-lg text-[#ece8da]/76">{hint}</p>
              <p className="mt-2 text-[10px] text-[#d8d2bf]/58">{t('No two beginnings carry the same temperament.', 'Żadne dwa początki nie niosą tego samego temperamentu.')}</p>
            </div>
          )}
        </div>
      ) : (
        <section className="relative z-10 w-full max-w-xs animate-fade-in text-center">
          <p className="eyebrow text-[#8d987c]/70">{t('Something is here', 'Coś już tu jest')}</p>
          <h1 className="display-title text-[2rem] text-[#ece8da] mt-4 text-balance">{t('Give it a name it can grow into.', 'Daj mu imię, do którego może dorosnąć.')}</h1>
          <p className="text-[#d8d2bf]/45 text-xs font-serif leading-relaxed mt-3">{t('The rest of the person will appear slowly.', 'Reszta osoby pojawi się powoli.')}</p>
          <label className="sr-only" htmlFor="creature-name">{t('Creature name', 'Imię stworka')}</label>
          <input
            id="creature-name"
            type="text"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={t('Name', 'Imię')}
            maxLength={12}
            className="mt-7 min-h-12 w-full bg-[#252a20]/62 border border-white/10 rounded-2xl px-4 py-3 text-[#ece8da] text-center text-lg font-serif placeholder:text-[#d8d2bf]/48 focus:outline-none focus:border-[#c7a66c]/45"
            autoFocus
            disabled={saving}
            onKeyDown={event => event.key === 'Enter' && void handleSubmitName()}
          />
          {saveError && (
            <p className="mt-3 text-xs text-[#d9b7a6]">{t('This life could not be saved yet. Try again.', 'Nie udało się jeszcze zapisać tego życia. Spróbuj ponownie.')}</p>
          )}
          <button
            onClick={() => void handleSubmitName()}
            disabled={!name.trim() || saving}
            className="mt-3 min-h-12 w-full rounded-2xl bg-[#ece8da] text-[#171913] text-sm font-serif disabled:opacity-25 active:scale-[.98] transition-transform"
          >
            {saving ? t('Keeping this life…', 'Zapisuję to życie…') : t('Meet them', 'Poznajcie się')}
          </button>
        </section>
      )}
    </main>
  );
};

export default EggHatching;
