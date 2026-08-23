import { ConversationLanguage } from '../types';

export type SupportedUiLanguage = 'en' | 'pl';

export function detectUiLanguage(): SupportedUiLanguage {
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('pl')) return 'pl';
  return 'en';
}

export function uiLanguage(language: ConversationLanguage): SupportedUiLanguage {
  return language === 'pl' ? 'pl' : language === 'en' ? 'en' : detectUiLanguage();
}

export function uiText(language: SupportedUiLanguage, english: string, polish: string): string {
  return language === 'pl' ? polish : english;
}
