import React from 'react';
import { GameState } from '../types';
import {
  getLifePathClues,
  getLifePathDescription,
  getLifePathMilestoneDetail,
  getLifePathMilestoneTitle,
  getLifePathTitle,
  getLifePathVisual,
  getLivedClockNote,
  getRankedLifePaths,
} from '../systems/lifePathSystem';
import { getInterestStage, getRankedInterests, getSelfAwarenessStageLabel } from '../systems/innerLifeSystem';
import { getCreationMastery } from '../systems/creationSystem';
import { getVisiblePersonalitySignature } from '../systems/relationshipSystem';
import { uiLanguage, uiText } from '../systems/uiLanguage';
import GlyphIcon from './GlyphIcon';

interface BecomingViewProps {
  state: GameState;
  onClose: () => void;
}

const BecomingView: React.FC<BecomingViewProps> = ({ state, onClose }) => {
  const ui = uiLanguage(state.conversation.language);
  const polish = ui === 'pl';
  const t = (english: string, polishText: string) => uiText(ui, english, polishText);
  const title = getLifePathTitle(state, ui);
  const description = getLifePathDescription(state, ui);
  const clockNote = getLivedClockNote(state, ui);
  const visual = getLifePathVisual(state);
  const clues = getLifePathClues(state, 3, ui);
  const signature = getVisiblePersonalitySignature(state);
  const interests = getRankedInterests(state, 4, ui);
  const dream = state.innerLife.dreams[state.innerLife.dreams.length - 1];
  const activeRoads = getRankedLifePaths(state, 4, ui).filter(path => path.score >= 10).slice(0, 4);
  const firsts = [...state.development.experience.firsts].slice(-4).reverse();
  const artBase = import.meta.env.BASE_URL;
  const phaseCopy = {
    unformed: t('Still open. Habits have not settled into a shape.', 'Wciąż otwarte. Nawyki nie ułożyły się jeszcze w jeden kształt.'),
    leaning: t('A direction is appearing in repeated choices.', 'W powtarzanych wyborach zaczyna pojawiać się kierunek.'),
    committed: t('Some patterns now feel familiar enough to return on their own.', 'Niektóre wzorce są już tak znajome, że wracają samodzielnie.'),
    embodied: t('The inside has begun to leave a visible mark on the outside.', 'To, co wewnętrzne, zaczęło zostawiać widoczny ślad na zewnątrz.'),
    recovering: t('An old shape is loosening. Something else has room to grow.', 'Stary kształt się rozluźnia. Coś innego zyskuje miejsce, by rosnąć.'),
  }[state.lifePath.phase];
  const recoveryCopy = state.lifePath.recovery >= 55
    ? t('Old patterns are losing their authority.', 'Stare wzorce tracą swoją władzę.')
    : state.lifePath.recovery >= 25
      ? t('A different response is beginning to repeat.', 'Inna reakcja zaczyna się powtarzać.')
      : null;

  return (
    <section className="becoming-sheet safe-top safe-bottom safe-x animate-fade-in" aria-label={t('Becoming', 'Stawanie się')}>
      <div className="absolute inset-0 ambient-grain" aria-hidden="true" />
      <div className="sheet-inner relative z-10">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-[#8d987c]/72">{t('Not a type. A direction.', 'Nie typ. Kierunek.')}</p>
            <h1 className="display-title text-[2.15rem] text-[#ece8da] mt-2">{state.identity.name || t('This creature', 'Ten stworek')}</h1>
          </div>
          <button onClick={onClose} aria-label={t('Close Becoming view', 'Zamknij widok Stawanie się')} className="tap-target grid place-items-center text-[#d8d2bf]/60 rounded-full">
            <GlyphIcon name="close" size={21} />
          </button>
        </header>

        <section className="relative mt-5 min-h-[230px] overflow-hidden rounded-[1.7rem_.55rem_1.7rem_1.7rem] border border-white/[.08] bg-[#1b1e18]/88 p-5" style={{ boxShadow: `0 24px 80px ${visual.aura}` }}>
          <img src={`${artBase}art/becoming-motif.png`} alt="" className="motif-art absolute -right-10 -bottom-8 w-64 opacity-60" />
          <div className="relative z-10 max-w-[72%]">
            <div className="flex items-center gap-2 text-[#c7a66c]/72"><GlyphIcon name="becoming" size={18} /><p className="eyebrow">{t('Current shape', 'Obecny kształt')}</p></div>
            <h2 className="display-title text-[1.65rem] text-[#ece8da] mt-4">{title}</h2>
            <p className="text-[#d8d2bf]/66 text-xs font-serif leading-relaxed mt-3">{description}</p>
            <p className="text-[#c7a66c]/70 text-[10px] font-serif leading-relaxed mt-3">{clockNote}</p>
            <p className="text-[#a8ad91]/88 text-[10px] font-serif leading-relaxed mt-3">{phaseCopy}</p>
            {recoveryCopy && <p className="text-[#c7a66c]/62 text-[10px] font-serif italic mt-2">{recoveryCopy}</p>}
          </div>
        </section>

        <section className="mt-7">
          <p className="eyebrow text-[#a8ad91]/90">{t('Temperament in motion', 'Temperament w ruchu')}</p>
          <h2 className="display-title text-xl text-[#ece8da]/92 mt-3">{polish ? signature.titlePl : signature.titleEn}</h2>
          <p className="text-[#d8d2bf]/65 text-xs font-serif leading-relaxed mt-2 max-w-sm">{polish ? signature.descriptionPl : signature.descriptionEn}</p>
        </section>

        <section className="mt-7 border-t border-white/[.07] pt-5">
          <p className="eyebrow text-[#a8ad91]/90">{t('Signs you can notice', 'Ślady, które można zauważyć')}</p>
          <div className="mt-3 grid gap-3">
            {clues.length > 0 ? clues.map(clue => (
              <p key={clue} className="border-l border-[#c7a66c]/28 pl-3 text-[#ece8da]/72 text-xs font-serif leading-relaxed">{clue}</p>
            )) : <p className="text-[#d8d2bf]/58 text-xs font-serif italic">{t('The shape is still soft. Watch what it repeats when nobody asks.', 'Kształt jest jeszcze miękki. Obserwuj, co powtarza, kiedy nikt nie prosi.')}</p>}
          </div>
        </section>

        {(interests.length > 0 || dream || state.innerLife.selfAwareness.stage !== 'unaware' || state.creations.length > 0 || state.touchBoundaries.boundariesShown > 0) && (
          <section className="mt-7 ink-card p-4">
            <p className="eyebrow text-[#a8ad91]/90">{t('Inner weather', 'Wewnętrzna pogoda')}</p>
            {interests.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {interests.map(interest => (
                  <span key={interest.type} className="text-[#ece8da]/72 text-xs font-serif">{interest.label} <span className="text-[#8d987c]/55">· {getInterestStage(interest.level, ui)}</span></span>
                ))}
              </div>
            )}
            {dream && <p className="mt-4 border-l border-[#6c596b]/55 pl-3 text-[#d8d2bf]/58 text-[10px] font-serif italic leading-relaxed">{t('Dreaming lately:', 'Ostatnio śni:')} “{dream.title}”</p>}
            {state.innerLife.selfAwareness.stage !== 'unaware' && <p className="mt-2 text-[#d8d2bf]/58 text-[10px] font-serif">{t('In the mirror:', 'W lustrze:')} {getSelfAwarenessStageLabel(state.innerLife.selfAwareness.stage, ui)}</p>}
            {state.creations.length > 0 && <p className="mt-2 text-[#d8d2bf]/58 text-[10px] font-serif">{t('With its hands:', 'Własnymi łapkami:')} {getCreationMastery(state, ui)}</p>}
            {state.touchBoundaries.boundariesShown > 0 && <p className="mt-2 text-[#d8d2bf]/58 text-[10px] font-serif">{t('It has learned that closeness can include asking for space.', 'Nauczyło się, że bliskość może też oznaczać prośbę o przestrzeń.')}</p>}
          </section>
        )}

        {activeRoads.length > 0 && (
          <section className="mt-7">
            <p className="eyebrow text-[#a8ad91]/90">{t('Roads currently tugging', 'Drogi, które teraz przyciągają')}</p>
            <p className="text-[#d8d2bf]/58 text-[10px] font-serif leading-relaxed mt-2">{t('These are possibilities visible in repetition, not permanent labels.', 'To możliwości widoczne w powtórzeniach, nie trwałe etykiety.')}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {activeRoads.map(path => (
                <span key={path.id} className={`rounded-full border px-3 py-1.5 text-[10px] font-serif ${path.id === state.lifePath.primary ? 'border-[#c7a66c]/35 bg-[#c7a66c]/10 text-[#ece8da]/82' : 'border-white/[.09] text-[#d8d2bf]/62'}`}>{path.label}</span>
              ))}
            </div>
          </section>
        )}

        {firsts.length > 0 && (
          <section className="mt-7 border-t border-white/[.07] pt-5">
            <p className="eyebrow text-[#a8ad91]/90">{t('Evidence of a self', 'Dowody własnego „ja”')}</p>
            <div className="mt-3 grid gap-3">
              {firsts.map(first => <p key={first.id} className="text-[#d8d2bf]/62 text-[11px] font-serif">{polish ? first.titlePl : first.titleEn}</p>)}
            </div>
          </section>
        )}

        {state.lifePath.history.length > 0 && (
          <section className="mt-7 border-t border-white/[.07] pt-5">
            <p className="eyebrow text-[#a8ad91]/90">{t('Turns in the road', 'Zakręty na drodze')}</p>
            <div className="mt-3 grid gap-4">
              {[...state.lifePath.history].reverse().slice(0, 6).map(item => (
                <article key={item.id} className="border-l border-[#c7a66c]/24 pl-3">
                  <h3 className="text-[#ece8da]/78 text-xs font-serif">{getLifePathMilestoneTitle(item, ui)}</h3>
                  <p className="text-[#d8d2bf]/58 text-[10px] font-serif leading-relaxed mt-1">{getLifePathMilestoneDetail(item, ui)}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <p className="mt-9 text-center text-[#d8d2bf]/60 text-[9px] font-serif leading-relaxed">{t('Nothing here is a score. Repetition leaves traces; new choices can bend them.', 'Nic tutaj nie jest wynikiem. Powtórzenia zostawiają ślady, a nowe wybory mogą je zmienić.')}</p>
      </div>
    </section>
  );
};

export default BecomingView;
