import React from 'react';
import { ObjectType } from '../types';

interface ObjectIconProps {
  type: ObjectType;
  size?: number;
  status?: unknown;
  className?: string;
}

const ink = '#2b2824';
const highlight = '#f1e5d1';
const shadow = '#1b1915';
const peat = '#5a4c3d';
const clay = '#8a5f4e';
const bone = '#d3cbb8';
const boneWarm = '#c4b395';
const lichen = '#6f7a62';
const moss = '#5d6a51';
const olive = '#8a8a5f';
const plum = '#6c596b';
const plumSoft = '#9b87a0';
const amber = '#c2a06a';
const amberSoft = '#d9b989';
const stone = '#7c766c';
const stoneSoft = '#a39b8d';
const glass = '#c7c2b4';
const water = '#5f7772';
const waterLight = '#93a8a1';
const ember = '#9a5a58';

const ObjectIcon: React.FC<ObjectIconProps> = ({ type, size = 48, status, className = '' }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 64 64',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true,
    className,
  } as const;

  if (type === 'food_bowl') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="46" rx="23" ry="6" fill={shadow} opacity=".3" />
        <path d="M10 25h44l-5 20c-1 5-6 8-11 8H26c-5 0-10-3-11-8l-5-20Z" fill={clay} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="32" cy="25" rx="22" ry="7" fill={boneWarm} stroke={ink} strokeWidth="3" />
        <ellipse cx="32" cy="26" rx="16" ry="3.5" fill={peat} />
      </svg>
    );
  }

  if (type === 'water_bowl') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="49" rx="23" ry="6" fill={shadow} opacity=".3" />
        <path d="M10 27h44l-5 18c-1 5-6 8-11 8H26c-5 0-10-3-11-8l-5-18Z" fill={water} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="32" cy="27" rx="22" ry="7" fill={waterLight} stroke={ink} strokeWidth="3" />
        <path d="M17 27c7 3 23 3 30 0" stroke={highlight} strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
        <path d="M32 11c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11Z" fill={waterLight} stroke={ink} strokeWidth="2.5" />
      </svg>
    );
  }

  if (type === 'litter_box') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="54" rx="25" ry="5" fill={shadow} opacity=".3" />
        <path d="M8 24h48l-4 27H12L8 24Z" fill={peat} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="32" cy="25" rx="23" ry="7" fill={boneWarm} stroke={ink} strokeWidth="3" />
        <path d="M16 26c8-4 25-4 33 0-9 4-24 4-33 0Z" fill={clay} opacity=".55" />
        <path d="m22 22 3 3m14-4 3 3m-11-2 2 3" stroke={bone} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'wash_basin') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="53" rx="23" ry="5" fill={shadow} opacity=".3" />
        <path d="M10 29h44l-5 17c-2 5-6 7-11 7H26c-5 0-9-2-11-7l-5-17Z" fill={boneWarm} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="32" cy="29" rx="22" ry="7" fill={bone} stroke={ink} strokeWidth="3" />
        <ellipse cx="32" cy="29" rx="15" ry="3.5" fill={water} />
        <circle cx="20" cy="16" r="5" fill={glass} stroke={ink} strokeWidth="2" />
        <circle cx="32" cy="11" r="4" fill={glass} stroke={ink} strokeWidth="2" />
        <circle cx="42" cy="18" r="3" fill={glass} stroke={ink} strokeWidth="2" />
      </svg>
    );
  }

  if (type === 'apple') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="52" rx="20" ry="5" fill={shadow} opacity=".28" />
        <path d="M32 21c-5-7-15-5-19 2-6 11 2 29 15 31 2 .3 3-1 4-1s2 1 4 1c13-2 21-20 15-31-4-7-14-9-19-2Z" fill={ember} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M32 21c-1-6 1-10 5-13" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        <path d="M36 12c5-4 11-3 14 1-4 4-10 5-14-1Z" fill={lichen} stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M21 27c-2 4-2 8-1 11" stroke={highlight} strokeWidth="3" strokeLinecap="round" opacity=".55" />
      </svg>
    );
  }

  if (type === 'broccoli') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="54" rx="20" ry="4" fill={shadow} opacity=".28" />
        <path d="m28 29-5 25h18l-5-25h-8Z" fill={olive} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M31 35 21 27m13 8 9-9" stroke={ink} strokeWidth="3" strokeLinecap="round" />
        <circle cx="21" cy="24" r="10" fill={moss} stroke={ink} strokeWidth="3" />
        <circle cx="32" cy="18" r="12" fill={lichen} stroke={ink} strokeWidth="3" />
        <circle cx="44" cy="24" r="10" fill={moss} stroke={ink} strokeWidth="3" />
        <circle cx="31" cy="29" r="10" fill={lichen} stroke={ink} strokeWidth="3" />
      </svg>
    );
  }

  if (type === 'ball') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="54" rx="20" ry="4" fill={shadow} opacity=".28" />
        <circle cx="32" cy="31" r="22" fill={boneWarm} stroke={ink} strokeWidth="3" />
        <path d="m32 18 8 6-3 10H27l-3-10 8-6Zm-8 6-10-1m13 11-6 9m16-9 6 9m-2-19 10-1M21 43l-2 8m24-8 2 8" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M15 24c2-5 6-9 11-12m23 12c-2-5-6-9-11-12" stroke={stoneSoft} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'blanket') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="53" rx="23" ry="4" fill={shadow} opacity=".28" />
        <path d="M10 20c8-5 36-5 44 0v29c-10 5-34 5-44 0V20Z" fill={plum} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M10 27c11 4 33 4 44 0M18 17v35m28-35v35" stroke={plumSoft} strokeWidth="2" opacity=".75" />
        <path d="M15 51v5m6-4v5m22-5v5m6-6v5" stroke={ink} strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === 'paper') {
    const paperStatus = typeof status === 'string' ? status : '';
    return (
      <svg {...common}>
        <ellipse cx="32" cy="54" rx="21" ry="4" fill={shadow} opacity=".25" />
        <path d="M15 9h27l8 8v35H15V9Z" fill={bone} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M42 9v9h8" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        {paperStatus === 'written' ? (
          <path d="M24 29c0-5 7-6 8-1 1-5 8-4 8 1 0 6-8 10-8 10s-8-4-8-10Z" fill={ember} stroke={ink} strokeWidth="2" />
        ) : paperStatus === 'drawn' ? (
          <><path d="m21 43 8-10 5 5 4-6 7 11H21Z" fill={lichen} stroke={ink} strokeWidth="2" /><circle cx="25" cy="24" r="3" fill={amber} /></>
        ) : (
          <><path d="M22 25h20M22 32h16M22 39h20" stroke={stoneSoft} strokeWidth="2.5" strokeLinecap="round" /><path d="m22 46 6-2 5 2 8-3" stroke={ember} strokeWidth="2" strokeLinecap="round" /></>
        )}
      </svg>
    );
  }

  if (type === 'pencil') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="52" rx="22" ry="4" fill={shadow} opacity=".25" />
        <g transform="rotate(-38 32 32)">
          <path d="M26 7h12v40H26V7Z" fill={amber} stroke={ink} strokeWidth="3" />
          <path d="m26 47 6 11 6-11H26Z" fill={bone} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="m30 54 2 4 2-4h-4Z" fill={ink} />
          <path d="M26 8c0-3 3-5 6-5s6 2 6 5v5H26V8Z" fill={clay} stroke={ink} strokeWidth="3" />
          <path d="M31 14v31" stroke={amberSoft} strokeWidth="2" opacity=".7" />
        </g>
      </svg>
    );
  }

  if (type === 'box') {
    const opened = status === 'opened';
    const occupied = status === 'hiding' || status === 'den';
    return (
      <svg {...common}>
        <ellipse cx="32" cy="54" rx="24" ry="5" fill={shadow} opacity=".3" />
        <path d="M12 24h40v29H12V24Z" fill={peat} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="m12 24 11-9h18l11 9-20 8-20-8Z" fill={amber} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        {opened ? (
          <><path d="m12 24-8-8 18-6 10 7-20 7Zm40 0 8-8-18-6-10 7 20 7Z" fill={amberSoft} stroke={ink} strokeWidth="3" strokeLinejoin="round" /><path d="M23 31h18" stroke={peat} strokeWidth="2.5" /></>
        ) : (
          <><path d="M32 32v21M23 15l9 17 9-17" stroke={peat} strokeWidth="2.5" /><path d="M27 38h10" stroke={amberSoft} strokeWidth="2.5" /></>
        )}
        {occupied && <path d="M44 48c6 1 10 4 11 8" stroke={ink} strokeWidth="3" strokeLinecap="round" />}
      </svg>
    );
  }

  if (type === 'stone') {
    const kept = status === 'treasured' || status === 'keepsake';
    return (
      <svg {...common}>
        <ellipse cx="32" cy="52" rx="23" ry="5" fill={shadow} opacity=".3" />
        <path d="M9 45 17 23l13-10 18 8 8 24-10 8H20L9 45Z" fill={kept ? stoneSoft : stone} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="m17 23 14 8 17-10M31 31l-3 22" stroke={stoneSoft} strokeWidth="2.5" opacity=".8" />
        <path d="m42 33 6 4" stroke={peat} strokeWidth="2.5" strokeLinecap="round" />
        {kept && <path d="M24 38c3-4 8-5 12-2" stroke={amber} strokeWidth="2" strokeLinecap="round" />}
      </svg>
    );
  }

  if (type === 'cushion') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="54" rx="23" ry="5" fill={shadow} opacity=".3" />
        <path d="M12 20c3-6 9-9 20-9s17 3 20 9v16c-3 6-9 9-20 9s-17-3-20-9V20Z" fill={plum} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        <path d="M12 26c8 5 32 5 40 0M18 19c2 8 2 18 0 27m28-27c-2 8-2 18 0 27" stroke={plumSoft} strokeWidth="2" opacity=".8" />
        <circle cx="32" cy="33" r="2.6" fill={bone} stroke={ink} strokeWidth="1.6" />
      </svg>
    );
  }

  if (type === 'brush') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="54" rx="22" ry="5" fill={shadow} opacity=".3" />
        <g transform="rotate(24 32 32)">
          <path d="M28 44h8v10c0 3-2 5-4 5s-4-2-4-5V44Z" fill={clay} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M22 24h20v20H22V24Z" fill={bone} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M24 28h16M24 34h16M24 40h16" stroke={stoneSoft} strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  if (type === 'jingle_toy') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="54" rx="22" ry="5" fill={shadow} opacity=".3" />
        <circle cx="32" cy="32" r="19" fill={boneWarm} stroke={ink} strokeWidth="3" />
        <path d="M32 21c-3-3-4-6-4-9h8c0 3-1 6-4 9Z" fill={amber} stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="32" cy="10" r="3.5" fill={amberSoft} stroke={ink} strokeWidth="2" />
        <path d="M18 26c4 3 8 4 14 4s10-1 14-4" stroke={highlight} strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
        <path d="M20 38c3 4 7 6 12 6s9-2 12-6" stroke={stoneSoft} strokeWidth="2" strokeLinecap="round" opacity=".8" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <ellipse cx="32" cy="56" rx="19" ry="4" fill={shadow} opacity=".3" />
      <path d="M29 46h6v9h-6v-9Zm-9 9h24" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      <path d="M32 7c-12 0-20 9-20 21s8 21 20 21 20-9 20-21S44 7 32 7Z" fill={clay} stroke={ink} strokeWidth="3" />
      <ellipse cx="32" cy="28" rx="15" ry="17" fill={glass} stroke={highlight} strokeWidth="2" />
      <path d="M22 21c4-6 13-9 20-3" stroke={highlight} strokeWidth="2.5" strokeLinecap="round" opacity=".65" />
    </svg>
  );
};

export default ObjectIcon;
