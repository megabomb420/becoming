import React, { useState, useEffect } from 'react';

interface EggHatchingProps {
  onHatch: () => void;
  onNameChosen: (name: string) => void;
}

const EggHatching: React.FC<EggHatchingProps> = ({ onHatch, onNameChosen }) => {
  const [stage, setStage] = useState<'egg' | 'wobbling' | 'cracking' | 'hatched' | 'naming'>('egg');
  const [tapCount, setTapCount] = useState(0);
  const [name, setName] = useState('');

  useEffect(() => {
    // Auto-wobble after a few seconds
    const timer = setTimeout(() => {
      if (stage === 'egg') setStage('wobbling');
    }, 3000);
    return () => clearTimeout(timer);
  }, [stage]);

  const handleTap = () => {
    if (stage === 'egg') {
      setTapCount(prev => {
        const next = prev + 1;
        if (next >= 3) setStage('wobbling');
        return next;
      });
    } else if (stage === 'wobbling') {
      setTapCount(prev => {
        const next = prev + 1;
        if (next >= 6) setStage('cracking');
        return next;
      });
    } else if (stage === 'cracking') {
      setStage('hatched');
      setTimeout(() => setStage('naming'), 2000);
    }
  };

  const handleSubmitName = () => {
    if (name.trim()) {
      onNameChosen(name.trim());
      onHatch();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-room-dark relative overflow-hidden">
      {/* Ambient particles */}
      <div className="absolute inset-0 opacity-20">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-warm-200"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${4 + Math.random() * 6}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {stage !== 'naming' && (
        <div 
          className="relative cursor-pointer select-none"
          onClick={handleTap}
        >
          {/* Glow */}
          <div 
            className={`absolute inset-0 rounded-full transition-all duration-1000 ${
              stage === 'wobbling' ? 'animate-pulse' : ''
            }`}
            style={{
              background: 'radial-gradient(circle, rgba(200,180,150,0.2) 0%, transparent 70%)',
              transform: 'scale(2)',
            }}
          />
          
          {/* Egg / Creature */}
          <div 
            className={`relative transition-all duration-700 ${
              stage === 'wobbling' ? 'animate-breathe' : ''
            } ${stage === 'cracking' ? 'scale-110' : ''}`}
          >
            {stage === 'hatched' ? (
              <div className="text-6xl animate-fade-in">✨</div>
            ) : (
              <div className="relative">
                <div 
                  className="w-24 h-32 rounded-[50%] bg-room-light shadow-2xl"
                  style={{
                    background: 'radial-gradient(ellipse at 30% 30%, #e8ddd0, #a08b70)',
                    boxShadow: '0 0 60px rgba(200,180,150,0.2), inset 0 -10px 30px rgba(0,0,0,0.2)',
                  }}
                />
                {stage === 'cracking' && (
                  <svg className="absolute inset-0 w-24 h-32" viewBox="0 0 96 128">
                    <path
                      d="M45 40 L50 55 L42 65 L52 75"
                      stroke="#3a3028"
                      strokeWidth="1.5"
                      fill="none"
                      className="animate-fade-in"
                    />
                  </svg>
                )}
              </div>
            )}
          </div>

          {/* Hint text */}
          {stage === 'egg' && tapCount < 2 && (
            <p className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-warm-200/40 text-xs font-serif whitespace-nowrap animate-fade-in">
              Tap to begin
            </p>
          )}
          {stage === 'wobbling' && (
            <p className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-warm-200/40 text-xs font-serif whitespace-nowrap">
              Something moves inside
            </p>
          )}
          {stage === 'cracking' && (
            <p className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-warm-200/40 text-xs font-serif whitespace-nowrap">
              Almost there...
            </p>
          )}
        </div>
      )}

      {stage === 'naming' && (
        <div className="animate-fade-in text-center px-6">
          <p className="text-warm-100/80 text-sm font-serif mb-2">A creature has emerged.</p>
          <p className="text-warm-200/50 text-xs mb-6">What will you call it?</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name..."
            maxLength={12}
            className="bg-room-mid/50 border border-warm-200/20 rounded-xl px-4 py-3 text-warm-100 text-center text-lg font-serif w-48 focus:outline-none focus:border-warm-300/40"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitName()}
          />
          <button
            onClick={handleSubmitName}
            disabled={!name.trim()}
            className="block mx-auto mt-4 px-6 py-2 bg-warm-300/20 text-warm-100 rounded-xl text-sm font-serif disabled:opacity-30 active:scale-95 transition-transform"
          >
            Begin
          </button>
        </div>
      )}
    </div>
  );
};

export default EggHatching;
