import React from 'react';
import { RoomMessType } from '../types';

interface CareMarkProps {
  type: RoomMessType;
  size?: number;
  className?: string;
}

// Bodily traces should be immediately understandable without becoming comic
// emoji. These small floor-native marks share the room's ink-and-clay palette.
const CareMark: React.FC<CareMarkProps> = ({ type, size = 54, className = '' }) => {
  if (type === 'pee') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
        <path d="M8 40c1-8 10-10 16-9 3-8 15-10 21-4 8-1 13 4 11 10 4 4 1 10-6 11-9 3-31 4-39-1-3-2-4-5-3-7Z" fill="#8f8668" fillOpacity=".46" stroke="#c7b98f" strokeOpacity=".42" strokeWidth="1.6" />
        <path d="M18 39c7-4 16-5 24-2M28 31c3-2 8-2 11 0" fill="none" stroke="#ece4ca" strokeOpacity=".34" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <ellipse cx="32" cy="50" rx="20" ry="5" fill="#090b08" opacity=".28" />
      <path d="M18 43c-1-7 5-11 11-10-2-7 4-12 10-10 5 1 7 6 5 10 7 0 10 5 8 10-2 6-10 7-17 7-8 0-16-1-17-7Z" fill="#665044" stroke="#29231f" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M27 36c4-2 9-2 13 0" fill="none" stroke="#9b7860" strokeWidth="1.8" strokeLinecap="round" opacity=".7" />
    </svg>
  );
};

export default CareMark;
