import React from 'react';
import { GameState, ObjectType } from '../types';
import { getDevelopmentLabel } from '../systems/developmentSystem';
import { getDreamMoodLabel, getInterestLabel, getInterestStage, getRankedInterests } from '../systems/innerLifeSystem';
import { getAbsenceSummary, getVisitRitual } from '../systems/presenceSystem';
import { getCreationMastery } from '../systems/creationSystem';
import { getAdoptedSharedPhrases } from '../systems/sharedLanguageSystem';
import { getVisiblePersonalitySignature } from '../systems/relationshipSystem';
import { formatLearnedBehaviour, formatStoredMemory, getOpenLoopKindLabel, uiLanguage, uiText } from '../systems/uiLanguage';
import GlyphIcon from './GlyphIcon';
import ObjectIcon from './ObjectIcon';

interface MemoryBookViewProps {
  state: GameState;
  version?: string;
  onClose: () => void;
}

const labels: Record<ObjectType, { en: string; pl: string }> = {
  food_bowl: { en: 'bowl', pl: 'miska' },
  apple: { en: 'apple', pl: 'jabłko' },
  broccoli: { en: 'broccoli', pl: 'brokuł' },
  ball: { en: 'ball', pl: 'piłka' },
  blanket: { en: 'blanket', pl: 'koc' },
  paper: { en: 'paper', pl: 'papier' },
  pencil: { en: 'pencil', pl: 'ołówek' },
  box: { en: 'box', pl: 'pudełko' },
  stone: { en: 'stone', pl: 'kamień' },
  mirror: { en: 'mirror', pl: 'lustro' },
};

const MemoryBookView: React.FC<MemoryBookViewProps> = ({ state, version, onClose }) => {
  const ui = uiLanguage(state.conversation.language);
  const polish = ui === 'pl';
  const t = (english: string, polishText: string) => uiText(ui, english, polishText);
  const locale = polish ? 'pl-PL' : 'en-GB';
  const developmentLabel = getDevelopmentLabel(state.development.stage, ui);
  const signature = getVisiblePersonalitySignature(state);
  const interests = getRankedInterests(state, 4, ui);
  const latestDream = state.innerLife.dreams[state.innerLife.dreams.length - 1];
  const opinions = [...state.innerLife.opinions].filter(opinion => opinion.confidence >= 28).sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  const firsts = [...state.development.experience.firsts].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
  const creations = [...state.creations].reverse().slice(0, 4);
  const absences = [...state.presence.absenceEpisodes].reverse().slice(0, 3);
  const phrases = getAdoptedSharedPhrases(state).slice(0, 5);
  const ritual = getVisitRitual(state);
  const openLoops = [...state.continuity.openLoops].filter(loop => !loop.resolvedAt).slice(-4).reverse();
  const chapters = [...state.continuity.chapters].slice(-3).reverse();
  const strongMemories = state.memories.filter(memory => memory.importance >= 6 && !memory.tags.includes('dream')).slice(-10).reverse();
  const preferences = (Object.entries(state.objectPreferences) as Array<[ObjectType, GameState['objectPreferences'][ObjectType]]>)
    .filter(([, preference]) => preference.interactions >= 2 && (preference.affinity >= 12 || preference.affinity <= -8))
    .sort((a, b) => Math.abs(b[1].affinity) - Math.abs(a[1].affinity))
    .slice(0, 4);
  const developmentCopy = polish ? {
    egg: 'Jeszcze czeka.', newborn: 'Głos jest prosty, ale jego ton już się różni.', animal: 'Rozpoznaje rytm, nastrój i znajome rzeczy.', communicating: 'Próbuje zamieniać reakcje w znaczenie.', first_words: 'Kilka słów naprawdę należy już do niego.', combining: 'Łączy słowa ze wspomnieniami i upodobaniami.', sentences: 'Buduje własne zdania i wraca do dawnych tematów.', mature: 'Mówi głosem ukształtowanym przez wspólną historię.',
  }[state.development.stage] : {
    egg: 'Still waiting.', newborn: 'The voice is simple, but its tone already differs.', animal: 'It recognizes rhythm, mood and familiar things.', communicating: 'It is turning reactions into meaning.', first_words: 'A few words now truly belong to it.', combining: 'It connects words with memories and preferences.', sentences: 'It builds its own sentences and returns to old subjects.', mature: 'It speaks with a voice shaped by shared history.',
  }[state.development.stage];
  const artBase = import.meta.env.BASE_URL;

  return (
    <section className="archive-sheet safe-top safe-bottom safe-x animate-fade-in" aria-label={t('Memory Book', 'Księga wspomnień')}>
      <div className="sheet-inner relative z-10">
        <header className="flex items-start justify-between gap-4 pb-5 border-b border-[#403a2d]/15">
          <div>
            <p className="eyebrow text-[#424735]">{t('Kept on this device', 'Zachowane na tym urządzeniu')}</p>
            <h1 className="display-title text-[2rem] text-[#27291f] mt-2">{t('Memory Book', 'Księga wspomnień')}</h1>
            <p className="text-[#3e4034]/85 text-xs font-serif mt-2">{state.identity.name || t('This creature', 'Ten stworek')} · {developmentLabel}</p>
          </div>
          <button onClick={onClose} aria-label={t('Close Memory Book', 'Zamknij Księgę wspomnień')} className="tap-target grid place-items-center text-[#36382d]/65 rounded-full">
            <GlyphIcon name="close" size={21} />
          </button>
        </header>

        <div className="relative mt-5 min-h-[132px] overflow-hidden paper-card pl-6 pr-4 py-4">
          <img src={`${artBase}art/memory-motif.png`} alt="" className="motif-art absolute -right-5 -bottom-7 w-40 opacity-55" />
          <div className="relative z-10 max-w-[68%]">
            <p className="eyebrow text-[#4c513f]">{t('The person appearing', 'Osoba, która się pojawia')}</p>
            <h2 className="display-title text-xl text-[#282a21] mt-2">{polish ? signature.titlePl : signature.titleEn}</h2>
            <p className="text-[#373a2e]/82 text-[11px] font-serif leading-relaxed mt-2">{polish ? signature.descriptionPl : signature.descriptionEn}</p>
          </div>
        </div>

        {firsts.length > 0 && (
          <section className="mt-7">
            <p className="eyebrow text-[#474c3b]">{t('First things', 'Pierwsze razy')}</p>
            <div className="mt-3 grid gap-3">
              {firsts.map(first => (
                <article key={first.id} className="archive-entry">
                  <time className="text-[9px] uppercase tracking-[.14em] text-[#4a4e3e]">{new Date(first.timestamp).toLocaleDateString(locale)}</time>
                  <h3 className="text-[#27291f] text-sm font-serif mt-0.5">{polish ? first.titlePl : first.titleEn}</h3>
                  <p className="text-[#3e4034]/82 text-[10px] font-serif leading-relaxed mt-1">{polish ? first.detailPl : first.detailEn}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mt-7 paper-card pl-6 pr-4 py-4">
          <p className="eyebrow text-[#474c3b]">{t('Growing voice', 'Rosnący głos')}</p>
          <h2 className="display-title text-lg text-[#27291f] mt-2">{developmentLabel}</h2>
          <p className="text-[#3e4034]/82 text-[11px] font-serif leading-relaxed mt-2">{developmentCopy}</p>
          {state.conversation.facts.length > 0 && (
            <p className="text-[#4b4e3f]/78 text-[10px] font-serif mt-3 leading-relaxed">
              {t('Things carried from your conversations:', 'Rzeczy niesione z waszych rozmów:')} {[...state.conversation.facts].sort((a, b) => b.confidence - a.confidence).slice(0, 4).map(fact => fact.value).join(' · ')}
            </p>
          )}
          {state.socialLearning.imitated.length > 0 && (
            <p className="text-[#4b4e3f]/78 text-[10px] font-serif mt-2">{t('Learning from you:', 'Uczy się od ciebie:')} {state.socialLearning.imitated.slice(-3).map(habit => formatLearnedBehaviour(habit.action, habit.target, ui)).join(' · ')}</p>
          )}
        </section>

        {(interests.length > 0 || latestDream || opinions.length > 0) && (
          <section className="relative mt-7 overflow-hidden rounded-[1.4rem_.45rem_1.4rem_1.4rem] bg-[#1c2019] p-5 text-[#ece8da] shadow-xl">
            <img src={`${artBase}art/dreams-motif.png`} alt="" className="motif-art absolute -right-8 -top-8 w-48 opacity-50" />
            <div className="relative z-10 max-w-[78%]">
              <div className="flex items-center gap-2 text-[#a8ad91]"><GlyphIcon name="dream" size={18} /><p className="eyebrow">{t('Inner weather', 'Wewnętrzna pogoda')}</p></div>
              {interests.length > 0 && <p className="text-[#d8d2bf]/70 text-xs font-serif leading-relaxed mt-3">{t('Pulled toward', 'Ciągnie je do')}: {interests.map(interest => `${interest.label} (${getInterestStage(interest.level, ui)})`).join(' · ')}</p>}
              {latestDream && (
                <blockquote className="mt-4 border-l border-[#c7a66c]/35 pl-3">
                  <p className="text-[#c7a66c]/85 text-[9px] uppercase tracking-[.16em]">{t('Latest dream', 'Ostatni sen')} · {getDreamMoodLabel(latestDream.mood, ui)}</p>
                  <p className="text-[#ece8da]/78 text-xs font-serif italic leading-relaxed mt-1.5">{latestDream.fragment}</p>
                </blockquote>
              )}
              {opinions.length > 0 && <p className="text-[#d8d2bf]/62 text-[10px] font-serif leading-relaxed mt-4">{t('Opinions beginning to hold:', 'Poglądy, które zaczynają się utrzymywać:')} {opinions.map(opinion => getInterestLabel(opinion.topic, ui)).join(' · ')}</p>}
            </div>
          </section>
        )}

        {creations.length > 0 && (
          <section className="mt-7">
            <p className="eyebrow text-[#474c3b]">{t('Made by them', 'Zrobione przez niego')}</p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              {creations.map(creation => (
                <article key={creation.id} className="paper-card min-h-32 pl-6 pr-3 py-3">
                  <div className="text-[#303229] text-xl whitespace-pre-wrap">{creation.glyph}</div>
                  <h3 className="text-[#27291f] text-[11px] font-serif mt-3">{creation.title}</h3>
                  <p className="text-[#45483a]/80 text-[9px] font-serif leading-relaxed mt-1 line-clamp-3">{creation.description}</p>
                </article>
              ))}
            </div>
            <p className="text-[#4b4e3e]/78 text-[9px] font-serif mt-2">{getCreationMastery(state, ui)}</p>
          </section>
        )}

        {(ritual || absences.length > 0 || phrases.length > 0) && (
          <section className="mt-7 grid gap-4">
            {ritual && <div className="archive-entry"><p className="eyebrow text-[#474c3b]">{t('Our rhythm', 'Nasz rytm')}</p><p className="text-[#303229] text-xs font-serif mt-2">{ritual}</p></div>}
            {absences.length > 0 && (
              <div>
                <p className="eyebrow text-[#474c3b]">{t('While you were away', 'Kiedy cię nie było')}</p>
                <div className="mt-3 grid gap-2">
                  {absences.map(episode => (
                    <article key={episode.id} className="paper-card pl-6 pr-3 py-3">
                      <p className="text-[#303229] text-[11px] font-serif leading-relaxed">{episode.trace ? (polish ? episode.trace.captionPl : episode.trace.captionEn) : getAbsenceSummary(state, episode)}</p>
                      <p className="text-[#4b4e3e]/78 text-[9px] mt-1.5">{new Date(episode.returnedAt).toLocaleDateString(locale)}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}
            {phrases.length > 0 && <div><p className="eyebrow text-[#474c3b]">{t('Our language', 'Nasz język')}</p><div className="flex flex-wrap gap-2 mt-3">{phrases.map(phrase => <span key={phrase.id} className="rounded-full border border-[#444839]/18 bg-white/10 px-3 py-1 text-[10px] font-serif text-[#303229]">“{phrase.text}”</span>)}</div></div>}
          </section>
        )}

        {(openLoops.length > 0 || chapters.length > 0) && (
          <section className="mt-7 border-t border-[#403a2d]/15 pt-5">
            <p className="eyebrow text-[#474c3b]">{t('Threads between us', 'Nici między nami')}</p>
            <div className="mt-3 grid gap-3">
              {openLoops.map(loop => <p key={loop.id} className="archive-entry text-[#303229] text-[10px] font-serif"><span className="uppercase tracking-wider text-[#59604b]/80">{getOpenLoopKindLabel(loop.kind, ui)}</span> · {loop.subject}</p>)}
              {chapters.map(chapter => <article key={chapter.id} className="archive-entry"><h3 className="text-[#303229] text-xs font-serif">{chapter.title}</h3><p className="text-[#45483a]/80 text-[10px] font-serif leading-relaxed mt-1">{chapter.summary}</p></article>)}
            </div>
          </section>
        )}

        {(preferences.length > 0 || strongMemories.length > 0) && (
          <section className="mt-7 border-t border-[#403a2d]/15 pt-5">
            <p className="eyebrow text-[#474c3b]">{t('Other traces', 'Pozostałe ślady')}</p>
            {preferences.length > 0 && <div className="flex flex-wrap gap-2 mt-3">{preferences.map(([type, preference]) => <span key={type} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-[#444839]/15 px-2.5 py-1 text-[10px] text-[#303229]"><ObjectIcon type={type} size={18} />{polish ? labels[type].pl : labels[type].en} · {preference.affinity >= 12 ? t('favorite', 'ulubione') : t('uncertain', 'niepewne')}</span>)}</div>}
            <div className="mt-4 grid gap-3">{strongMemories.map(memory => <article key={memory.id} className="archive-entry"><time className="text-[9px] text-[#4b4e3e]/78">{new Date(memory.timestamp).toLocaleDateString(locale)}</time><p className="text-[#303229] text-[11px] font-serif mt-0.5">{formatStoredMemory(memory.content, ui)}</p></article>)}</div>
          </section>
        )}

        {version && <p className="mt-10 pt-5 border-t border-[#403a2d]/15 text-center text-[#414437]/72 text-[9px] font-serif">Becoming v{version}</p>}
      </div>
    </section>
  );
};

export default MemoryBookView;
