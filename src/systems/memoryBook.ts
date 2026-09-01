import { authoritativeNow } from './authoritativeTime';
import { GameState, MemoryBookEntry } from '../types';
import { addMemoryBookEntry } from './persistence';

export async function generateMemoryBookEntry(state: GameState): Promise<MemoryBookEntry | null> {
  const day = Math.floor(state.development.chronologicalAge / (24 * 60 * 60 * 1000)) + 1;
  
  // Check for significant events in recent memories
  const recentMemories = state.memories.filter(m => authoritativeNow() - m.timestamp < 24 * 60 * 60 * 1000);
  
  if (recentMemories.length === 0) return null;

  // Find the most significant recent event
  const mostSignificant = recentMemories.reduce((a, b) => a.importance > b.importance ? a : b);
  
  if (mostSignificant.importance < 5) return null;

  let text = '';
  if (mostSignificant.tags.includes('language') && mostSignificant.content.includes('learned word')) {
    const match = mostSignificant.content.match(/"([^"]+)"/);
    text = match ? `First word: "${match[1]}"` : 'Learned a new word';
  } else if (mostSignificant.tags.includes('development')) {
    text = `Reached ${mostSignificant.content.replace('reached ', '')}`;
  } else if (mostSignificant.tags.includes('food')) {
    text = mostSignificant.content;
  } else {
    text = mostSignificant.content;
  }

  const entry: MemoryBookEntry = {
    day,
    text,
    timestamp: authoritativeNow(),
  };

  await addMemoryBookEntry(entry);
  return entry;
}

export function getReadableAge(state: GameState): string {
  const totalMs = state.development.chronologicalAge;
  const days = Math.floor(totalMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((totalMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  
  if (days === 0) {
    if (hours === 0) return 'just born';
    return `${hours} hour${hours > 1 ? 's' : ''} old`;
  }
  return `Day ${days}`;
}
