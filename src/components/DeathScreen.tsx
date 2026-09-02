import { authoritativeNow } from '../systems/authoritativeTime';
import React, { useState } from 'react';
import { GameState } from '../types';
import CreatureCanvas from './CreatureCanvas';
import MemoryBookView from './MemoryBookView';
import GlyphIcon from './GlyphIcon';
import { serializeGameState } from '../systems/persistence';
import { uiLanguage, uiText } from '../systems/uiLanguage';
import { getRoomLighting, getTimeOfDay } from '../systems/timeSystem';

interface DeathScreenProps {
  state: GameState;
  version?: string;
  onReset?: () => void;
}

/**
 * A completed life, told quietly. There is no score, no second chance, no
 * timer pressure, no guilt. The saved life stays in IndexedDB and survives
 * reload and backup; only the explicit Start over contract begins another life.
 */
const DeathScreen: React.FC<DeathScreenProps> = ({ state, version, onReset }) => {
  const ui = uiLanguage(state.conversation.language);
  const polish = ui === 'pl';
  const t = (english: string, polishText: string) => uiText(ui, english, polishText);
  const name = state.identity.name || t('the creature', 'stworek');
  const [showMemoryBook, setShowMemoryBook] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const now = authoritativeNow();
  const timeOfDay = getTimeOfDay(now, state.world);
  const lighting = getRoomLighting(timeOfDay, state.world, now);

  const saveBackup = () => {
    const json = serializeGameState(state);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'creature';
    link.href = url;
    link.download = `becoming-${safeName}.json`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setBackupStatus(polish ? 'Zapisano backup na tym urządzeniu.' : 'Backup saved to this device.');
  };

  if (showMemoryBook) {
    return <MemoryBookView state={state} version={version} onClose={() => setShowMemoryBook(false)} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* The same nocturnal room, one degree quieter. */}
      <div
        className="absolute inset-0"
        style={{ filter: `brightness(${lighting.brightness * 0.74})`, transition: 'filter 1800ms ease' }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[66%]"
          style={{ background: `linear-gradient(180deg, ${lighting.wallTop} 0%, ${lighting.wallBottom} 82%, ${lighting.floorBottom} 100%)`, transition: 'background 30s linear' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-[35%]"
          style={{ background: `linear-gradient(180deg, ${lighting.floorTop} 0%, ${lighting.floorBottom} 100%)`, transition: 'background 30s linear' }}
        />
        <div className="absolute top-[64.7%] left-0 right-0 h-[2px] bg-[#100f0d]/70" />
        <div className="absolute bottom-0 left-0 right-0 h-[35%] opacity-25" style={{ background: 'repeating-linear-gradient(102deg, transparent 0 46px, rgba(8,7,6,.45) 47px 49px)' }} />
        <div className="absolute inset-0 transition-colors duration-[1800ms]" style={{ background: lighting.veil }} />
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 48%, transparent 42%, rgba(0,0,0,.46) 100%)' }} />
      <div className="absolute inset-0 ambient-grain" aria-hidden="true" />

      {/* The creature rests where the room left it. Decorative, not interactive. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <CreatureCanvas
          state={state}
          lighting={lighting}
          onTap={() => undefined}
          onStroke={() => undefined}
          onHoldStart={() => undefined}
          onHoldEnd={() => undefined}
        />
      </div>

      {/* A quiet panel, not a screen with scores. */}
      <div className="absolute inset-x-0 top-[16%] bottom-0 z-20 flex flex-col items-center px-6 text-center">
        <p className="eyebrow text-[#8d987c]/65">{t('QUIET NOW', 'TERAZ CICHO')}</p>
        <h1 className="display-title mt-3 text-[#ece8da]/90 text-2xl">
          {t(`${name} is gone.`, `${name} odszedł.`)}
        </h1>
        <p className="mt-4 max-w-xs text-xs font-serif leading-relaxed text-[#d8d2bf]/62">
          {t('Its life ended in this room. Nothing here can undo it, and the room asks nothing of you.', 'Jego życie skończyło się w tym pokoju. Nic tutaj tego nie cofnie i pokój niczego od ciebie nie oczekuje.')}
        </p>
        <p className="mt-3 max-w-xs text-[10px] font-serif leading-relaxed text-[#d8d2bf]/40">
          {t('The memories remain. If you want, you can begin another life.', 'Wspomnienia zostały. Jeśli chcesz, możesz zacząć inne życie.')}
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowMemoryBook(true)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-warm-300/25 bg-warm-300/10 px-4 py-2.5 text-xs font-serif text-warm-100 active:scale-[0.99] transition-transform"
          >
            <GlyphIcon name="memory" size={17} />
            {t('Memory Book', 'Księga wspomnień')}
          </button>
          <button
            type="button"
            onClick={saveBackup}
            className="flex min-h-11 items-center justify-center rounded-xl border border-warm-200/12 px-4 py-2.5 text-xs font-serif text-warm-100/70 active:scale-[0.99] transition-transform"
          >
            {t('Save backup', 'Zapisz backup')}
          </button>

          {onReset && (
            <div className="mt-2 rounded-2xl border border-red-200/10 bg-room-mid/25 p-3">
              <p className="text-[10px] font-serif text-warm-200/55">{t('Begin another life', 'Zacznij inne życie')}</p>
              {resetArmed ? (
                <div className="mt-2.5 space-y-2">
                  <p className="text-[10px] font-serif text-red-100/75">{t('Really start over? This life cannot be restored.', 'Na pewno zacząć od nowa? Tego życia nie da się przywrócić.')}</p>
                  <button
                    type="button"
                    onClick={onReset}
                    className="min-h-11 w-full rounded-xl border border-red-200/30 bg-red-200/10 px-3 py-2 text-xs font-serif text-red-100 active:scale-[0.99] transition-transform"
                  >
                    {t('Yes, start over', 'Tak, zacznij od nowa')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetArmed(false)}
                    className="min-h-11 w-full rounded-xl border border-warm-200/12 px-3 py-2 text-xs font-serif text-warm-100/70 active:scale-[0.99] transition-transform"
                  >
                    {t('Stay here', 'Zostań tutaj')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setResetArmed(true)}
                  className="mt-2.5 min-h-11 w-full rounded-xl border border-red-200/15 px-3 py-2 text-xs font-serif text-red-100/55 active:scale-[0.99] transition-transform"
                >
                  {t('Start over', 'Zacznij od nowa')}
                </button>
              )}
            </div>
          )}
        </div>

        {backupStatus && <p className="mt-5 text-[10px] font-serif text-warm-100/55">{backupStatus}</p>}
        {version && (
          <p className="mt-auto pb-6 pt-8 text-[9px] font-serif text-warm-200/25">Becoming v{version}</p>
        )}
      </div>
    </div>
  );
};

export default DeathScreen;
