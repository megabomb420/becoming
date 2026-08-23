import { DevelopmentStage, GameState } from '../types';
import { generateSocialSpeech, shouldSpeakSocially } from './socialLearningSystem';

interface SpeechContext {
  trigger: string;
  emotionalState: string;
  recentEvent?: string;
}

type SpeechLanguage = 'pl' | 'en';

function pick(items: string[]): string {
  return items[Math.floor(Math.random() * items.length)];
}

function concreteMoment(language: SpeechLanguage, trigger: string): string[] {
  const lines: Record<SpeechLanguage, Record<string, string[]>> = {
    pl: {
      food: ['Pachnie dobrze.', 'Tego właśnie chciałem.', 'Zostawię ani okruszka.'],
      play: ['Jeszcze raz.', 'Piłka zawsze gdzieś ucieka.', 'Dobra, to było fajne.'],
      blanket: ['Tu jest dobrze.', 'Ten koc pamięta mój kształt.', 'Mógłbym tu zostać.'],
      paper: ['Pusta kartka trochę prowokuje.', 'Chcę zostawić na niej jakiś ślad.', 'Jeszcze nie wiem, co z tego będzie.'],
      pencil: ['Ta kreska miała wyglądać inaczej.', 'Spróbuję jeszcze raz.', 'Lubię ten dźwięk po papierze.'],
      box: ['W środku jest lepiej niż na zewnątrz.', 'Muszę sprawdzić każdy kąt.', 'To jest teraz moja kryjówka.'],
      stone: ['Jest cięższy, niż wygląda.', 'Ten kamień ma dobrą ciszę.', 'Ciekawe, skąd się tu wziął.'],
      mirror: ['To ja. Chyba.', 'Odbicie robi dokładnie to samo.', 'Patrzę inaczej niż wczoraj.'],
      touch: ['Czuję cię.', 'Dobrze, że jesteś.', 'Hej.'],
      idle: ['Cicho tu dzisiaj.', 'Zastanawiam się, co robisz.', 'Mam ochotę coś poruszyć.', 'Ten pokój brzmi inaczej, kiedy jesteś.'],
    },
    en: {
      food: ['That smells good.', 'That is what I wanted.', 'I am leaving no crumbs.'],
      play: ['Again.', 'The ball always gets away.', 'Okay, that was good.'],
      blanket: ['This spot feels right.', 'This blanket remembers my shape.', 'I could stay here.'],
      paper: ['An empty page is a little provocative.', 'I want to leave a mark on it.', 'I do not know what this will become yet.'],
      pencil: ['That line was meant to look different.', 'I will try again.', 'I like the sound it makes on paper.'],
      box: ['Inside is better than outside.', 'I need to check every corner.', 'This is my hiding place now.'],
      stone: ['It is heavier than it looks.', 'This stone has a good silence.', 'I wonder where it came from.'],
      mirror: ['That is me. I think.', 'The reflection does exactly the same thing.', 'I look different from yesterday.'],
      touch: ['I feel you.', 'I am glad you are here.', 'Hey.'],
      idle: ['It is quiet today.', 'I wonder what you are doing.', 'I feel like moving something.', 'The room sounds different when you are here.'],
    },
  };
  return lines[language][trigger] ?? lines[language].idle;
}

function stageVoice(stage: DevelopmentStage, language: SpeechLanguage, context: SpeechContext, state: GameState): string {
  const moment = concreteMoment(language, context.trigger);

  if (stage === 'newborn') {
    const newborn: Record<SpeechLanguage, Record<string, string[]>> = {
      pl: {
        food: ['Dobre.', 'Chcę tego.'], play: ['Jeszcze.', 'Uciekła.'], blanket: ['Miękko.', 'Tu dobrze.'],
        paper: ['Pusta.', 'Zrobię ślad.'], pencil: ['Kreska.', 'Jeszcze raz.'], box: ['Co jest w środku?', 'Schowam się.'],
        stone: ['Ciężki.', 'Zimny.'], mirror: ['To ja?', 'Patrzy na mnie.'], touch: ['Czuję cię.', 'Jesteś.'], idle: ['Cicho tu.', 'Co teraz?'],
      },
      en: {
        food: ['Good.', 'I want that.'], play: ['Again.', 'It got away.'], blanket: ['Soft.', 'Good here.'],
        paper: ['Empty.', 'I will make a mark.'], pencil: ['A line.', 'Again.'], box: ['What is inside?', 'I will hide.'],
        stone: ['Heavy.', 'Cold.'], mirror: ['Is that me?', 'It is looking at me.'], touch: ['I feel you.', 'You are here.'], idle: ['Quiet here.', 'What now?'],
      },
    };
    return pick(newborn[language][context.trigger] ?? newborn[language].idle);
  }

  if (stage === 'animal') {
    const simple = moment.filter(line => line.split(/\s+/).length <= 7);
    return pick(simple.length ? simple : moment);
  }

  if (stage === 'communicating' || stage === 'first_words') return pick(moment);

  if (stage === 'combining') {
    const additions = language === 'pl'
      ? [' Jeszcze to rozgryzam.', ' Chcę sprawdzić, co będzie dalej.', ' Mam na ten temat własne zdanie.']
      : [' I am still figuring it out.', ' I want to see what happens next.', ' I have my own opinion about it.'];
    return Math.random() < 0.35 ? `${pick(moment)}${pick(additions)}` : pick(moment);
  }

  const relationshipLines = language === 'pl'
    ? state.bond.stage === 'bonded'
      ? ['Wiedziałem, że wrócisz.', 'Ten pokój jest bardziej nasz niż mój.', 'Rozpoznaję cię po sposobie, w jaki zaczyna się cisza.']
      : ['Znowu jesteś.', 'Zastanawiałem się, kiedy wrócisz.', 'Chyba zaczynam znać twój rytm.']
    : state.bond.stage === 'bonded'
      ? ['I knew you would come back.', 'This room feels more ours than mine.', 'I recognise you by the way the silence begins.']
      : ['You are here again.', 'I wondered when you would return.', 'I think I am learning your rhythm.'];

  if (context.trigger === 'idle' && Math.random() < 0.35) return pick(relationshipLines);
  return pick(moment);
}

export function generateCreatureSpeech(state: GameState, context: SpeechContext): string | null {
  if (state.sleepState === 'sleeping' || state.development.stage === 'egg') return null;

  const language: SpeechLanguage = state.conversation.language === 'pl' ? 'pl' : 'en';
  const stage = state.development.stage;

  // Learned callbacks begin only when they match the normal room voice. This
  // prevents a baby sound beside an unexpectedly adult observation.
  if (stage !== 'newborn' && stage !== 'animal' && shouldSpeakSocially(state)) {
    const social = generateSocialSpeech(state, {
      aboutUser: context.trigger === 'idle' || context.trigger === 'chat',
      expressingOpinion: context.trigger === 'chat' || context.trigger === 'touch',
      askingWhy: context.trigger === 'chat',
    });
    if (social && language === 'en') return social;
  }

  return stageVoice(stage, language, context, state);
}

export function shouldSpeak(state: GameState): boolean {
  if (state.development.stage === 'egg' || state.sleepState === 'sleeping') return false;

  const baseChance = state.personality.sociability / 240;
  const stageMultiplier: Record<DevelopmentStage, number> = {
    egg: 0,
    newborn: 0.2,
    animal: 0.22,
    communicating: 0.27,
    first_words: 0.32,
    combining: 0.36,
    sentences: 0.4,
    mature: 0.42,
  };

  return Math.random() < Math.min(0.78, baseChance + stageMultiplier[state.development.stage]);
}
